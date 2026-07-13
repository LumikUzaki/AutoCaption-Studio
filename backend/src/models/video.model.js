const db = require('../database/init');

class VideoModel {
  // Criar um novo vídeo
  create(videoData) {
    const stmt = db.prepare(`
      INSERT INTO videos (id, filename, original_name, filepath, filesize, mimetype, duration, width, height, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    
    const id = videoData.id || require('uuid').v4();
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
  
  // Buscar vídeo por ID
  findById(id) {
    const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
    return stmt.get(id);
  }
  
  // Listar todos os vídeos
  findAll(limit = 50, offset = 0) {
    const stmt = db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }
  
  // Contar total de vídeos
  count() {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM videos');
    return stmt.get().total;
  }
  
  // Atualizar status do vídeo
  updateStatus(id, status) {
    const stmt = db.prepare(`
      UPDATE videos 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }
  
  // Atualizar metadados do vídeo (duração, dimensões)
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
  
  // Deletar vídeo
  delete(id) {
    const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
    return stmt.run(id);
  }
  
  // Buscar vídeos por status
  findByStatus(status) {
    const stmt = db.prepare('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status);
  }
  
  // Buscar vídeo com transcrição associada
  findByIdWithTranscricao(id) {
    const stmt = db.prepare(`
      SELECT v.*, t.id as transcricao_id, t.status as transcricao_status, t.progress
      FROM videos v
      LEFT JOIN transcricoes t ON v.id = t.video_id
      WHERE v.id = ?
    `);
    return stmt.get(id);
  }
}

module.exports = new VideoModel();
