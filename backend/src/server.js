const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Importar logger
const logger = require('./utils/logger');

// Importar rotas
const videoRoutes = require('./routes/video.routes');
const transcricaoRoutes = require('./routes/transcricao.routes');
const exportRoutes = require('./routes/export.routes');
const configRoutes = require('./routes/config.routes');

// Importar WebSocket
const socketHandler = require('./sockets/socket.handler');

// Criar servidor Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket'] // Apenas WebSocket, sem polling fallback
});

// Middleware global
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir outputs
app.use('/outputs', express.static(path.join(__dirname, '../outputs')));

// Rotas da API
app.use('/api/videos', videoRoutes);
app.use('/api/transcricoes', transcricaoRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/config', configRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  logger.api('Health check request');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota principal - servir o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
  logger.apiError(err.message, { 
    stack: err.stack, 
    path: req.path, 
    method: req.method 
  });
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : err.message,
      status: err.status || 500
    }
  });
});

// Configurar handler de WebSockets
socketHandler(io);

// Inicializar banco de dados
try {
  require('./database/init');
  logger.db('Banco de dados inicializado com sucesso');
} catch (error) {
  logger.dbError('Falha ao inicializar banco de dados', { error: error.message });
}

// Verificar FFmpeg
const ffmpegService = require('./services/ffmpeg.service');
ffmpegService.checkFFmpeg().then((available) => {
  if (available) {
    logger.ffmpeg('FFmpeg disponível');
  } else {
    logger.ffmpegError('FFmpeg não encontrado no PATH do sistema');
  }
});

// Verificar Python
const pythonBridge = require('./services/python-bridge.service');
pythonBridge.checkPython().then((available) => {
  if (available) {
    logger.python('Python disponível');
    
    const engines = ['faster-whisper', 'stable-ts', 'whisperx'];
    engines.forEach(async (engine) => {
      const available = await pythonBridge.checkEngine(engine);
      if (available) {
        logger.python(`Engine ${engine} disponível`);
      } else {
        logger.python.warn(`Engine ${engine} não encontrada`);
      }
    });
  } else {
    logger.pythonError('Python não encontrado no PATH do sistema');
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.server('Servidor iniciado', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_PATH || './database/legendas_pro.db'
  });
  
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    🎬 LEGENDAS PRO                        ║');
  console.log('║         Sistema Profissional de Legendagem                ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Servidor rodando em http://localhost:${PORT.toString().padEnd(24)}║`);
  console.log(`║  📁 Ambiente: ${(process.env.NODE_ENV || 'development').padEnd(26)}║`);
  console.log(`║  🗄️  Banco de dados: ${(process.env.DATABASE_PATH || './database/legendas_pro.db').substring(0, 22).padEnd(22)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
});

// Tratamento graceful de shutdown
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.server(`Recebido sinal ${signal}, iniciando shutdown graceful...`);
  
  server.close(() => {
    logger.server('Servidor HTTP fechado');
    
    io.close(() => {
      logger.websocket('Socket.IO fechado');
    });
    
    setTimeout(() => {
      logger.server('Shutdown completado');
      process.exit(0);
    }, 30000);
  });
  
  setTimeout(() => {
    logger.error('Shutdown forçado após timeout');
    process.exit(1);
  }, 35000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
});

module.exports = { app, server, io };
