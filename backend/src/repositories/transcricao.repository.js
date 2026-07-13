/**
 * Repository Pattern - Acesso a dados de transcrições e segmentos
 * Todo acesso ao banco de dados para transcrições passa por aqui
 */

const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');

class TranscricaoRepository {
  /**
   * Criar nova transcrição
   * @param {Object} transcricaoData - Dados da transcrição
   * @returns {Object} Transcrição criada
   */
  create(transcricaoData) {
    const stmt = db.prepare(`
      INSERT INTO transcricoes (id, video_id, engine, model, device, language, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);
    
    const id = transcricaoData.id || uuidv4();
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
  
  /**
   * Buscar transcrição por ID
   * @param {string} id - ID da transcrição
   * @returns {Object|null} Transcrição encontrada
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM transcricoes WHERE id = ?');
    return stmt.get(id);
  }
  
  /**
   * Buscar transcrição por vídeo
   * @param {string} videoId - ID do vídeo
   * @returns {Object|null} Transcrição encontrada
   */
  findByVideoId(videoId) {
    const stmt = db.prepare('SELECT * FROM transcricoes WHERE video_id = ? ORDER BY created_at DESC LIMIT 1');
    return stmt.get(videoId);
  }
  
  /**
   * Atualizar status e progresso
   * @param {string} id - ID da transcrição
   * @param {string} status - Novo status
   * @param {number|null} progress - Progresso (0-100)
   * @returns {Object} Resultado da atualização
   */
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
  
  /**
   * Atualizar com erro
   * @param {string} id - ID da transcrição
   * @param {string} errorMessage - Mensagem de erro
   * @returns {Object} Resultado da atualização
   */
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
  
  /**
   * Deletar transcrição
   * @param {string} id - ID da transcrição
   * @returns {Object} Resultado da deleção
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM transcricoes WHERE id = ?');
    return stmt.run(id);
  }
  
  /**
   * Listar transcrições com vídeos associados
   * @param {number} limit - Limite de registros
   * @param {number} offset - Offset para paginação
   * @returns {Array} Lista de transcrições
   */
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
  
  /**
   * Buscar transcrições por status
   * @param {string} status - Status para filtrar
   * @returns {Array} Lista de transcrições
   */
  findByStatus(status) {
    const stmt = db.prepare('SELECT * FROM transcricoes WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status);
  }
  
  /**
   * Buscar transcrições incompletas (para recovery)
   * @returns {Array} Lista de transcrições incompletas
   */
  findIncomplete() {
    const stmt = db.prepare(`
      SELECT * FROM transcricoes 
      WHERE status IN ('processing', 'pending') 
      ORDER BY created_at ASC
    `);
    return stmt.all();
  }
}

class SegmentoRepository {
  /**
   * Criar segmento
   * @param {Object} segmentoData - Dados do segmento
   * @returns {Object} Segmento criado
   */
  create(segmentoData) {
    const stmt = db.prepare(`
      INSERT INTO segmentos (id, transcricao_id, start_time, end_time, text, speaker, confidence, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = segmentoData.id || uuidv4();
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
  
  /**
   * Criar múltiplos segmentos em lote (transação)
   * @param {Array} segmentos - Lista de segmentos
   * @returns {boolean} true se sucesso
   */
  createBatch(segmentos) {
    const insertStmt = db.prepare(`
      INSERT INTO segmentos (id, transcricao_id, start_time, end_time, text, speaker, confidence, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((segmentos) => {
      for (const seg of segmentos) {
        const id = seg.id || uuidv4();
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
  
  /**
   * Buscar segmento por ID
   * @param {string} id - ID do segmento
   * @returns {Object|null} Segmento encontrado
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM segmentos WHERE id = ?');
    return stmt.get(id);
  }
  
  /**
   * Buscar todos os segmentos de uma transcrição
   * @param {string} transcricaoId - ID da transcrição
   * @returns {Array} Lista de segmentos ordenados por posição
   */
  findByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('SELECT * FROM segmentos WHERE transcricao_id = ? ORDER BY position ASC');
    return stmt.all(transcricaoId);
  }
  
  /**
   * Atualizar segmento
   * @param {string} id - ID do segmento
   * @param {Object} segmentoData - Dados para atualizar
   * @returns {Object} Resultado da atualização
   */
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
  
  /**
   * Deletar segmento
   * @param {string} id - ID do segmento
   * @returns {Object} Resultado da deleção
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM segmentos WHERE id = ?');
    return stmt.run(id);
  }
  
  /**
   * Deletar todos os segmentos de uma transcrição
   * @param {string} transcricaoId - ID da transcrição
   * @returns {Object} Resultado da deleção
   */
  deleteByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('DELETE FROM segmentos WHERE transcricao_id = ?');
    return stmt.run(transcricaoId);
  }
  
  /**
   * Contar segmentos de uma transcrição
   * @param {string} transcricaoId - ID da transcrição
   * @returns {number} Total de segmentos
   */
  countByTranscricaoId(transcricaoId) {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM segmentos WHERE transcricao_id = ?');
    return stmt.get(transcricaoId).total;
  }
  
  /**
   * Atualizar posições dos segmentos (reordenar)
   * @param {string} transcricaoId - ID da transcrição
   * @param {Array} segmentIds - Lista de IDs na nova ordem
   * @returns {boolean} true se sucesso
   */
  reorderSegments(transcricaoId, segmentIds) {
    const updateStmt = db.prepare(`
      UPDATE segmentos SET position = ? WHERE id = ? AND transcricao_id = ?
    `);
    
    const updateMany = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.position, item.id, transcricaoId);
      }
    });
    
    const items = segmentIds.map((id, index) => ({
      id,
      position: index
    }));
    
    updateMany(items);
    return true;
  }
}

module.exports = {
  transcricao: new TranscricaoRepository(),
  segmento: new SegmentoRepository()
};
