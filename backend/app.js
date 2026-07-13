const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

// Importação de Rotas
const routes = require('./routes');

// Importação de Serviços e Configuração
const { initDatabase } = require('./models/database');
const queueService = require('./services/queue');
const setupSocketIO = require('./sockets/progress.socket');

// Inicialização do Express
const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, restringir ao domínio real
        methods: ["GET", "POST"]
    }
});

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (Frontend SPA)
app.use(express.static(path.join(__dirname, '../public')));

// Montagem das Rotas da API
app.use('/api', routes);

// Rota fallback para SPA (retorna index.html para qualquer rota não encontrada na API)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});


// Inicialização do Banco de Dados e Filas (assíncrono)
async function initializeSystem() {
    try {
        initDatabase();
        console.log('✅ Banco de dados inicializado com sucesso.');

        await queueService.init();
        console.log('✅ Processador de filas iniciado.');

        // Configuração dos Sockets
        setupSocketIO(io);

        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar o sistema:', error);
        process.exit(1);
    }
}

// Configuração dos Sockets
initializeSystem();

// Constantes de Ambiente
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Iniciar Servidor
server.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`📁 Diretório raiz: ${__dirname}`);
});

// Tratamento de erros globais
process.on('uncaughtException', (err) => {
    console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição de promessa não tratada:', reason);
});

module.exports = { app, server, io };
