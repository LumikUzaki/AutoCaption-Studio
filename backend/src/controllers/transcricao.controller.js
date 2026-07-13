const { transcricao: transcricaoModel, segmento: segmentoModel } = require('../models/transcricao.model');
const videoModel = require('../models/video.model');

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
    
    return transcricaoModel.create(transcricaoData);
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
