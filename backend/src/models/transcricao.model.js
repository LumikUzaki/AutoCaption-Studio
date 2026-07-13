const db = require('../database/init');

class TranscricaoModel {
  // Criar nova transcrição
  create(transcricaoData) {
    const stmt = db.prepare(`
      INSERT INTO transcricoes (id, video_id, engine, model, device, language, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);
    
    const id = transcricaoData.id || require('uuid').v4();
    stmt.run(
      id,
      transcricaoData.videoId,
      transcricaoData.engine,
      transcricaoData.model,
      transcricaoData.device,
      transcricaoData.language || 'pt'
    );
    
    return this.findById(id);
  }
  
  // Buscar transcrição por ID
  findById(id) {
    const stmt = db.prepare('SELECT * FROM transcricoes WHERE id = ?');
    return stmt.get(id);
  }
  
  // Buscar transcrição por vídeo
  findByVideoId(videoId) {
    const stmt = db.prepare('SELECT * FROM transcricoes WHERE video_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(videoId);
  }
  
  // Atualizar status e progresso
  updateStatus(id, status, progress = null) {
    const stmt = db.prepare(`
      UPDATE transcricoes 
      SET status = ?, 
          progress = COALESCE(?, progress),
          started_at = CASE WHEN status = 'pending' THEN CURRENT_TIMESTAMP ELSE started_at END,
          completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(status, progress, status, id);
  }
  
  // Atualizar com erro
  updateWithError(id, errorMessage) {
    const stmt = db.prepare(`
      UPDATE transcricoes 
      SET status = 'failed', 
          error_message = ?,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(errorMessage, id);
  }
  
  // Deletar transcrição
  delete(id) {
    const stmt = db.prepare('DELETE FROM transcricoes WHERE id = ?');
    return stmt.run(id);
  }
  
  // Listar transcrições com vídeos associados
  findAll(limit = 50, offset = 0) {
    const stmt = db.prepare(`
      SELECT t.*, v.filename, v.original_name
      FROM transcricoes t
      JOIN videos v ON t.video_id = v.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }
}

class SegmentoModel {
  // Criar segmento
  create(segmentoData) {
    const stmt = db.prepare(`
      INSERT INTO segmentos (id, transcricao_id, start_time, end_time, text, speaker, confidence, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = segmentoData.id || require('uuid').v4();
    stmt.run(
      id,
      segmentoData.transcricaoId,
      segmentoData.startTime,
      segmentoData.endTime,
      segmentoData.text,
      segmentoData.speaker || null,
      segmentoData.confidence || null,
      segmentoData.position
    );
    
    return this.findById(id);
  }
  
  // Criar múltiplos segmentos em lote
  createBatch(segmentos) {
    const insertStmt = db.prepare(`
      INSERT INTO segmentos (id, transcricao_id, start_time, end_time, text, speaker, confidence, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((segmentos) => {
      for (const seg of segmentos) {
        const id = seg.id || require('uuid').v4();
        insertStmt.run(
          id,
          seg.transcricaoId,
          seg.startTime,
          seg.endTime,
          seg.text,
          seg.speaker || null,
          seg.confidence || null,
          seg.position
        );
      }
    });
    
    insertMany(segmentos);
    return true;
  }
  
  // Buscar segmento por ID
  findById(id) {
    const stmt = db.prepare('SELECT * FROM segmentos WHERE id = ?');
    return stmt.get(id);
  }
  
  // Buscar todos os segmentos de uma transcrição
  findByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('SELECT * FROM segmentos WHERE transcricao_id = ? ORDER BY position ASC');
    return stmt.all(transcricaoId);
  }
  
  // Atualizar segmento
  update(id, segmentoData) {
    const stmt = db.prepare(`
      UPDATE segmentos 
      SET start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          text = COALESCE(?, text),
          speaker = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      segmentoData.startTime,
      segmentoData.endTime,
      segmentoData.text,
      segmentoData.speaker !== undefined ? segmentoData.speaker : null,
      id
    );
  }
  
  // Deletar segmento
  delete(id) {
    const stmt = db.prepare('DELETE FROM segmentos WHERE id = ?');
    return stmt.run(id);
  }
  
  // Deletar todos os segmentos de uma transcrição
  deleteByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('DELETE FROM segmentos WHERE transcricao_id = ?');
    return stmt.run(transcricaoId);
  }
  
  // Contar segmentos de uma transcrição
  countByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM segmentos WHERE transcricao_id = ?');
    return stmt.get(transcricaoId).total;
  }
}

module.exports = {
  transcricao: new TranscricaoModel(),
  segmento: new SegmentoModel()
};
