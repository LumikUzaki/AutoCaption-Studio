/**
 * Server Entry Point
 * Responsável por inicializar o servidor HTTP, Socket.io e montar a aplicação Express.
 */

const http = require('http');
const { Server } = require('socket.io');
const appModule = require('./app');
const { initDatabase } = require('./models/database');
const setupSocketIO = require('./sockets/progress.socket');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Cria o servidor HTTP
const server = http.createServer(appModule.app);

// Configura o Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Inicializa o sistema (DB + Filas + Sockets)
async function startServer() {
    try {
        // Inicializa DB e Filas
        await appModule.initializeSystem(io);
        
        // Configura os Sockets
        setupSocketIO(io);
        
        // Inicia o servidor HTTP
        server.listen(PORT, HOST, () => {
            console.log(`\n🚀 Servidor Legendas Pro iniciado em http://${HOST}:${PORT}`);
            console.log(`📁 Diretório de uploads: ${process.env.UPLOAD_PATH || './backend/uploads'}`);
            console.log(`🧠 Engine padrão: ${process.env.DEFAULT_ENGINE || 'stable-ts'}`);
            console.log(`🤖 Modelo padrão: ${process.env.DEFAULT_MODEL || 'medium'}\n`);
        });
    } catch (error) {
        console.error('❌ Erro fatal ao iniciar o servidor:', error);
        process.exit(1);
    }
}

startServer();

// Tratamento de erros globais
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    server.close(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    server.close(() => process.exit(1));
});

module.exports = { server, io };
