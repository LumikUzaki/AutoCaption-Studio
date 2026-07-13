/**
 * Worker de Processamento de Transcrição
 * Processa jobs de transcrição da fila BullMQ
 */

const Queue = require('bull');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Criar fila de transcrição
const transcricaoQueue = new Queue('transcricao', redisConfig);

// Importar services
const ffmpegService = require('../services/ffmpeg.service');
const pythonBridge = require('../services/python-bridge.service');

// Importar repositories
const videoRepository = require('../repositories/video.repository');
const { transcricao: transcricaoRepository, segmento: segmentoRepository } = require('../repositories/transcricao.repository');

// Configurar worker
const maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;

transcricaoQueue.process(maxConcurrentJobs, async (job) => {
  const { transcricaoId, videoId } = job.data;
  
  console.log(`\n🔨 [WORKER] Iniciando job ${job.id} para transcrição ${transcricaoId}`);
  
  try {
    // Atualizar status para processing
    transcricaoRepository.updateStatus(transcricaoId, 'processing', 10);
    
    // Buscar dados do vídeo e transcrição
    const video = videoRepository.findById(videoId);
    const transcricao = transcricaoRepository.findById(transcricaoId);
    
    if (!video || !transcricao) {
      throw new Error('Vídeo ou transcrição não encontrados');
    }
    
    // Caminho do vídeo
    const videoPath = path.join(__dirname, '../../uploads', video.filename);
    
    // Validar arquivo
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
    }
    
    // Converter para WAV usando FFmpeg
    job.progress(20);
    console.log(`[WORKER] Convertendo áudio para WAV...`);
    const wavPath = await ffmpegService.convertToWav(videoPath, transcricaoId);
    console.log(`[WORKER] WAV gerado: ${wavPath}`);
    
    // Executar transcrição com Python
    job.progress(30);
    console.log(`[WORKER] Iniciando transcrição com Python...`);
    
    const resultado = await pythonBridge.transcribe({
      transcricaoId,
      videoPath: wavPath,
      engine: transcricao.engine,
      model: transcricao.model,
      device: transcricao.device,
      language: transcricao.language
    });
    
    console.log(`[WORKER] Transcrição concluída! Segmentos: ${resultado.total_segmentos || 0}`);
    
    // Salvar segmentos no banco
    if (resultado.segmentos && resultado.segmentos.length > 0) {
      job.progress(90);
      
      const segmentosParaSalvar = resultado.segmentos.map((seg, index) => ({
        transcricaoId,
        startTime: seg.start_time,
        endTime: seg.end_time,
        text: seg.text,
        confidence: seg.confidence,
        position: index
      }));
      
      segmentoRepository.createBatch(segmentosParaSalvar);
      console.log(`[WORKER] ${segmentosParaSalvar.length} segmentos salvos no banco`);
    }
    
    // Atualizar status para completed
    transcricaoRepository.updateStatus(transcricaoId, 'completed', 100);
    videoRepository.updateStatus(videoId, 'completed');
    
    console.log(`✅ [WORKER] Job ${job.id} concluído com sucesso!`);
    
    return { success: true, totalSegmentos: resultado.total_segmentos || 0 };
    
  } catch (error) {
    console.error(`❌ [WORKER] Erro no job ${job.id}:`, error.message);
    
    // Atualizar status para failed
    transcricaoRepository.updateWithError(transcricaoId, error.message);
    videoRepository.updateStatus(videoId, 'failed');
    
    throw error; // Re-throw para BullMQ lidar com retry
  }
});

// Eventos da fila
transcricaoQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado:`, result);
});

transcricaoQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job ? job.id : 'unknown'} falhou:`, err.message);
});

transcricaoQueue.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progresso: ${progress}%`);
});

module.exports = transcricaoQueue;
