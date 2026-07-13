/**
 * Handler de conexões WebSocket
 * Gerencia comunicação em tempo real com o frontend
 */

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);
    
    // Cliente entra em uma sala específica (por exemplo, sala de um vídeo)
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Cliente ${socket.id} entrou na sala ${roomId}`);
    });
    
    // Cliente sai de uma sala
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      console.log(`Cliente ${socket.id} saiu da sala ${roomId}`);
    });
    
    // Solicitar status de um job
    socket.on('request-job-status', (jobId) => {
      // Buscar status do job no banco e enviar de volta
      const db = require('../database/init');
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
      
      if (job) {
        socket.emit('job-status', job);
      }
    });
    
    // Solicitar progresso de transcrição
    socket.on('request-progress', (transcricaoId) => {
      const db = require('../database/init');
      const transcricao = db.prepare('SELECT * FROM transcricoes WHERE id = ?').get(transcricaoId);
      
      if (transcricao) {
        socket.emit('progress-update', {
          transcricaoId,
          status: transcricao.status,
          progress: transcricao.progress
        });
      }
    });
    
    // Evento de desconexão
    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
    
    // Erro no socket
    socket.on('error', (error) => {
      console.error(`Erro no socket ${socket.id}:`, error);
    });
  });
  
  console.log('✅ WebSocket handler inicializado');
}

/**
 * Emitir evento para todos os clientes em uma sala
 */
function emitToRoom(io, roomId, event, data) {
  io.to(roomId).emit(event, data);
}

/**
 * Emitir evento para todos os clientes
 */
function emitToAll(io, event, data) {
  io.emit(event, data);
}

module.exports = socketHandler;
module.exports.emitToRoom = emitToRoom;
module.exports.emitToAll = emitToAll;
