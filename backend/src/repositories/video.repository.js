/**
 * Repository Pattern - Acesso a dados de vídeos
 * Todo acesso ao banco de dados para vídeos passa por aqui
 */

const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');

class VideoRepository {
  /**
   * Criar um novo vídeo
   * @param {Object} videoData - Dados do vídeo
   * @returns {Object} Vídeo criado
   */
  create(videoData) {
    const stmt = db.prepare(`
      INSERT INTO videos (id, filename, original_name, filepath, filesize, mimetype, duration, width, height, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    
    const id = videoData.id || uuidv4();
    stmt.run(
      id,
      videoData.filename,
      videoData.originalName,
      videoData.filepath,
      videoData.filesize,
      videoData.mimetype,
      videoData.duration || null,
      videoData.width || null,
      videoData.height || null
    );
    
    return this.findById(id);
  }
  
  /**
   * Buscar vídeo por ID
   * @param {string} id - ID do vídeo
   * @returns {Object|null} Vídeo encontrado
   */
  findById(id) {
    const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
    return stmt.get(id);
  }
  
  /**
   * Listar todos os vídeos com paginação
   * @param {number} limit - Limite de registros
   * @param {number} offset - Offset para paginação
   * @returns {Array} Lista de vídeos
   */
  findAll(limit = 50, offset = 0) {
    const stmt = db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }
  
  /**
   * Contar total de vídeos
   * @returns {number} Total de vídeos
   */
  count() {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM videos');
    return stmt.get().total;
  }
  
  /**
   * Atualizar status do vídeo
   * @param {string} id - ID do vídeo
   * @param {string} status - Novo status
   * @returns {Object} Resultado da atualização
   */
  updateStatus(id, status) {
    const stmt = db.prepare(`
      UPDATE videos 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }
  
  /**
   * Atualizar metadados do vídeo (duração, dimensões)
   * @param {string} id - ID do vídeo
   * @param {Object} metadata - Metadados para atualizar
   * @returns {Object} Resultado da atualização
   */
  updateMetadata(id, metadata) {
    const stmt = db.prepare(`
      UPDATE videos 
      SET duration = ?, width = ?, height = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(
      metadata.duration || null,
      metadata.width || null,
      metadata.height || null,
      id
    );
  }
  
  /**
   * Deletar vídeo
   * @param {string} id - ID do vídeo
   * @returns {Object} Resultado da deleção
   */
  delete(id) {
    const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
    return stmt.run(id);
  }
  
  /**
   * Buscar vídeos por status
   * @param {string} status - Status para filtrar
   * @returns {Array} Lista de vídeos
   */
  findByStatus(status) {
    const stmt = db.prepare('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status);
  }
  
  /**
   * Buscar vídeo com transcrição associada
   * @param {string} id - ID do vídeo
   * @returns {Object|null} Vídeo com dados da transcrição
   */
  findByIdWithTranscricao(id) {
    const stmt = db.prepare(`
      SELECT v.*, t.id as transcricao_id, t.status as transcricao_status, t.progress
      FROM videos v
      LEFT JOIN transcricoes t ON v.id = t.video_id
      WHERE v.id = ?
    `);
    return stmt.get(id);
  }
  
  /**
   * Buscar vídeos incompletos (para recovery)
   * @returns {Array} Lista de vídeos incompletos
   */
  findIncomplete() {
    const stmt = db.prepare(`
      SELECT * FROM videos 
      WHERE status IN ('processing', 'pending') 
      ORDER BY created_at ASC
    `);
    return stmt.all();
  }
}

module.exports = new VideoRepository();
