const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar configurações
const config = require('./config/app.config');

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
  }
});

// Middleware global
app.use(cors());
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota principal - servir o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500
    }
  });
});

// Configurar handler de WebSockets
socketHandler(io);

// Iniciar servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    🎬 LEGENDAS PRO                        ║');
  console.log('║         Sistema Profissional de Legendagem                ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Servidor rodando em http://localhost:${PORT}              `);
  console.log(`║  📁 Ambiente: ${process.env.NODE_ENV || 'development'}                              `);
  console.log(`║  🗄️  Banco de dados: ${process.env.DATABASE_PATH || './database/legendas_pro.db'}   `);
  console.log('╚═══════════════════════════════════════════════════════════╝');
});

// Tratamento graceful de shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, fechando servidor...');
  server.close(() => {
    console.log('✅ Servidor fechado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, fechando servidor...');
  server.close(() => {
    console.log('✅ Servidor fechado com sucesso');
    process.exit(0);
  });
});

module.exports = { app, server, io };
