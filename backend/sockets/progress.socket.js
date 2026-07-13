/**
 * Configuração dos Sockets para progresso em tempo real
 * Gerencia a comunicação entre o processador de filas e o frontend
 */

function setupSocketIO(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Cliente conectado: ${socket.id}`);

        // Entrar em uma sala específica de job (opcional, para otimização)
        socket.on('join-job', (jobId) => {
            socket.join(`job-${jobId}`);
            console.log(`Cliente ${socket.id} entrou na sala do job ${jobId}`);
        });

        // Sair da sala ao desconectar
        socket.on('leave-job', (jobId) => {
            socket.leave(`job-${jobId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Cliente desconectado: ${socket.id}`);
        });
    });

    console.log('✅ Socket.IO configurado.');
}

/**
 * Função auxiliar para emitir eventos de progresso
 * @param {Server} io - Instância do Socket.IO
 * @param {string} jobId - ID do job
 * @param {object} data - Dados de progresso (status, percentual, mensagem, etc)
 */
function emitProgress(io, jobId, data) {
    io.to(`job-${jobId}`).emit('progress', { jobId, ...data });
    // Fallback: emitir para todos se ninguém estiver na sala específica
    io.emit('progress', { jobId, ...data });
}

module.exports = setupSocketIO;
module.exports.emitProgress = emitProgress;
