const { transcricao: transcricaoModel, segmento: segmentoModel } = require('../models/transcricao.model');
const videoModel = require('../models/video.model');
const pythonBridge = require('../services/python-bridge.service');
const ffmpegService = require('../services/ffmpeg.service');
const path = require('path');
const fs = require('fs');

class TranscricaoController {
  // Iniciar transcrição
  async iniciarTranscricao(videoId, options = {}) {
    const video = videoModel.findById(videoId);
    
    if (!video) {
      throw new Error('Vídeo não encontrado');
    }
    
    // Verificar se já existe transcrição
    const existing = transcricaoModel.findByVideoId(videoId);
    if (existing && existing.status === 'completed') {
      throw new Error('Vídeo já possui transcrição completa');
    }
    
    const transcricaoData = {
      videoId,
      engine: options.engine || 'faster-whisper',
      model: options.model || 'base',
      device: options.device || 'cuda',
      language: options.language || 'pt'
    };
    
    // Criar registro de transcrição
    const transcricao = transcricaoModel.create(transcricaoData);
    
    // Iniciar processamento em background
    this.processarTranscricao(transcricao.id, video, transcricaoData);
    
    return transcricao;
  }
  
  /**
   * Processa transcrição em background
   */
  async processarTranscricao(transcricaoId, video, options) {
    try {
      console.log(`\n🎯 [TRANSCRIÇÃO] Iniciando processamento para ID: ${transcricaoId}`);
      
      // Atualizar status para processing
      transcricaoModel.updateStatus(transcricaoId, 'processing', 10);
      
      // Caminho do vídeo
      const videoPath = path.join(__dirname, '../../uploads', video.filename);
      
      // Validar arquivo
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
      }
      
      console.log(`[TRANSCRIÇÃO] Vídeo: ${videoPath}`);
      console.log(`[TRANSCRIÇÃO] Engine: ${options.engine}`);
      
      // Converter para WAV usando FFmpeg
      transcricaoModel.updateStatus(transcricaoId, 'processing', 20);
      console.log(`[TRANSCRIÇÃO] Convertendo áudio para WAV...`);
      
      const wavPath = await ffmpegService.convertToWav(videoPath, transcricaoId);
      console.log(`[TRANSCRIÇÃO] WAV gerado: ${wavPath}`);
      
      // Executar transcrição com Python
      transcricaoModel.updateStatus(transcricaoId, 'processing', 30);
      console.log(`[TRANSCRIÇÃO] Iniciando transcrição com Python...`);
      
      const resultado = await pythonBridge.transcribe({
        transcricaoId,
        videoPath: wavPath,
        engine: options.engine,
        model: options.model,
        device: options.device,
        language: options.language
      });
      
      console.log(`[TRANSCRIÇÃO] Transcrição concluída! Segmentos: ${resultado.total_segmentos || 0}`);
      
      // Salvar segmentos no banco
      if (resultado.segmentos && resultado.segmentos.length > 0) {
        transcricaoModel.updateStatus(transcricaoId, 'processing', 90);
        
        resultado.segmentos.forEach((seg, index) => {
          segmentoModel.create({
            transcricaoId,
            start_time: seg.start_time,
            end_time: seg.end_time,
            text: seg.text,
            confidence: seg.confidence,
            position: index
          });
        });
        
        console.log(`[TRANSCRIÇÃO] ${resultado.segmentos.length} segmentos salvos no banco`);
      }
      
      // Atualizar status para completed
      transcricaoModel.updateStatus(transcricaoId, 'completed', 100);
      videoModel.updateStatus(video.id, 'completed');
      
      console.log(`✅ [TRANSCRIÇÃO] Processo concluído com sucesso!`);
      
    } catch (error) {
      console.error(`❌ [TRANSCRIÇÃO] Erro no processamento:`, error.message);
      transcricaoModel.updateStatus(transcricaoId, 'failed', 0);
      videoModel.updateStatus(video.id, 'failed');
    }
  }
  
  // Obter todas as transcrições
  async getAllTranscricoes(limit = 50, offset = 0) {
    return transcricaoModel.findAll(limit, offset);
  }
  
  // Obter transcrição por ID com segmentos
  async getTranscricaoById(id) {
    const transcricao = transcricaoModel.findById(id);
    
    if (!transcricao) {
      return null;
    }
    
    const segmentos = segmentoModel.findByTranscricaoId(id);
    
    return {
      ...transcricao,
      segmentos,
      totalSegmentos: segmentos.length
    };
  }
  
  // Atualizar status
  async updateStatus(id, status, progress = null) {
    const transcricao = transcricaoModel.findById(id);
    
    if (!transcricao) {
      throw new Error('Transcrição não encontrada');
    }
    
    return transcricaoModel.updateStatus(id, status, progress);
  }
  
  // Deletar transcrição
  async deleteTranscricao(id) {
    const transcricao = transcricaoModel.findById(id);
    
    if (!transcricao) {
      throw new Error('Transcrição não encontrada');
    }
    
    // Deletar segmentos primeiro
    segmentoModel.deleteByTranscricaoId(id);
    
    // Deletar transcrição
    transcricaoModel.delete(id);
    
    // Atualizar status do vídeo
    videoModel.updateStatus(transcricao.video_id, 'pending');
  }
  
  // Atualizar segmento
  async updateSegmento(segmentoId, segmentoData) {
    const segmento = segmentoModel.findById(segmentoId);
    
    if (!segmento) {
      throw new Error('Segmento não encontrado');
    }
    
    return segmentoModel.update(segmentoId, segmentoData);
  }
  
  // Deletar segmento
  async deleteSegmento(segmentoId) {
    const segmento = segmentoModel.findById(segmentoId);
    
    if (!segmento) {
      throw new Error('Segmento não encontrado');
    }
    
    return segmentoModel.delete(segmentoId);
  }
  
  // Adicionar segmento
  async addSegmento(transcricaoId, segmentoData) {
    const transcricao = transcricaoModel.findById(transcricaoId);
    
    if (!transcricao) {
      throw new Error('Transcrição não encontrada');
    }
    
    // Calcular próxima posição
    const total = segmentoModel.countByTranscricaoId(transcricaoId);
    
    segmentoData.transcricaoId = transcricaoId;
    segmentoData.position = total;
    
    return segmentoModel.create(segmentoData);
  }
}

module.exports = new TranscricaoController();
