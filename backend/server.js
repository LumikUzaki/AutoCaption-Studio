/**
 * Server Entry Point
 * Responsável por inicializar o servidor HTTP/HTTPS e montar a aplicação Express.
 */

const http = require('http');
const app = require('./app');
const { initDatabase } = require('./models/database');
const { initializeSocket } = require('./sockets/progress.socket');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Inicializa o banco de dados sincronamente (Better-SQLite3)
try {
    initDatabase();
    console.log('✅ Banco de dados inicializado com sucesso.');
} catch (error) {
    console.error('❌ Erro ao inicializar o banco de dados:', error);
    process.exit(1);
}

// Cria o servidor HTTP
const server = http.createServer(app);

// Inicializa o Socket.io ligado ao servidor HTTP
initializeSocket(server);

// Inicia o servidor
server.listen(PORT, HOST, () => {
    console.log(`\n🚀 Servidor Legendas Pro iniciado em http://${HOST}:${PORT}`);
    console.log(`📁 Diretório de uploads: ${process.env.UPLOAD_PATH || './backend/uploads'}`);
    console.log(`🧠 Engine padrão: ${process.env.DEFAULT_ENGINE || 'stable-ts'}`);
    console.log(`🤖 Modelo padrão: ${process.env.DEFAULT_MODEL || 'medium'}\n`);
});

// Tratamento de erros globais
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    server.close(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});

module.exports = server;
