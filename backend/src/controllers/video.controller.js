const videoModel = require('../models/video.model');
const { transcricao: transcricaoModel, segmento: segmentoModel } = require('../models/transcricao.model');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class VideoController {
  // Criar novo vídeo
  async createVideo(videoData) {
    const video = videoModel.create(videoData);
    
    // Registrar no histórico
    this.logHistory('create', 'video', video.id, { filename: video.original_name });
    
    return video;
  }
  
  // Obter todos os vídeos
  async getAllVideos(limit = 50, offset = 0) {
    return videoModel.findAll(limit, offset);
  }
  
  // Obter vídeo por ID
  async getVideoById(id) {
    return videoModel.findByIdWithTranscricao(id);
  }
  
  // Deletar vídeo
  async deleteVideo(id) {
    const video = videoModel.findById(id);
    
    if (!video) {
      throw new Error('Vídeo não encontrado');
    }
    
    // Deletar arquivo físico
    if (fs.existsSync(video.filepath)) {
      fs.unlinkSync(video.filepath);
    }
    
    // Deletar do banco (cascade deleta transcrição e segmentos)
    videoModel.delete(id);
    
    // Registrar no histórico
    this.logHistory('delete', 'video', id, { filename: video.original_name });
  }
  
  // Obter contagem de vídeos
  async getVideoCount() {
    return videoModel.count();
  }
  
  // Obter transcrição por vídeo
  async getTranscricaoByVideoId(videoId) {
    const transcricao = transcricaoModel.findByVideoId(videoId);
    
    if (!transcricao) {
      return null;
    }
    
    // Buscar segmentos associados
    const segmentos = segmentoModel.findByTranscricaoId(transcricao.id);
    
    return {
      ...transcricao,
      segmentos
    };
  }
  
  // Iniciar transcrição
  async startTranscricao(videoId, options = {}) {
    const video = videoModel.findById(videoId);
    
    if (!video) {
      throw new Error('Vídeo não encontrado');
    }
    
    // Criar registro de transcrição
    const transcricaoData = {
      videoId,
      engine: options.engine || process.env.DEFAULT_ENGINE || 'faster-whisper',
      model: options.model || process.env.DEFAULT_MODEL || 'base',
      device: options.device || process.env.DEFAULT_DEVICE || 'cuda',
      language: options.language || 'pt'
    };
    
    const transcricao = transcricaoModel.create(transcricaoData);
    
    // Atualizar status do vídeo
    videoModel.updateStatus(videoId, 'processing');
    
    // Chamar script Python para transcrição
    await this.runPythonTranscription(transcricao, video);
    
    return transcricao;
  }
  
  // Executar transcrição Python
  async runPythonTranscription(transcricao, video) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../../python/engines/transcribe.py');
      const args = [
        pythonScript,
        '--transcricao-id', transcricao.id,
        '--video-path', video.filepath,
        '--engine', transcricao.engine,
        '--model', transcricao.model,
        '--device', transcricao.device,
        '--language', transcricao.language
      ];
      
      const pythonProcess = spawn(process.env.PYTHON_PATH || 'python3', args);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(`[Python stdout] ${data}`);
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[Python stderr] ${data}`);
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          transcricaoModel.updateStatus(transcricao.id, 'completed', 100);
          videoModel.updateStatus(video.id, 'completed');
          resolve({ success: true, transcricao });
        } else {
          transcricaoModel.updateWithError(transcricao.id, errorOutput || 'Erro desconhecido na transcrição');
          videoModel.updateStatus(video.id, 'failed');
          reject(new Error(errorOutput || 'Falha na transcrição'));
        }
      });
      
      pythonProcess.on('error', (err) => {
        transcricaoModel.updateWithError(transcricao.id, err.message);
        videoModel.updateStatus(video.id, 'failed');
        reject(err);
      });
    });
  }
  
  // Registrar no histórico
  logHistory(action, entityType, entityId, details = {}) {
    const db = require('../database/init');
    const stmt = db.prepare(`
      INSERT INTO historico (id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const id = require('uuid').v4();
    stmt.run(id, action, entityType, entityId, JSON.stringify(details));
  }
}

module.exports = new VideoController();
