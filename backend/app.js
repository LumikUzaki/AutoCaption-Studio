const express = require('express');
const path = require('path');
const cors = require('cors');

// Importação de Rotas
const routes = require('./routes');

// Importação de Serviços e Configuração
const { initDatabase } = require('./models/database');
const queueService = require('./services/queue');

// Inicialização do Express
const app = express();

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
async function initializeSystem(io) {
    try {
        initDatabase();
        console.log('✅ Banco de dados inicializado com sucesso.');

        await queueService.init();
        console.log('✅ Processador de filas iniciado.');

        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar o sistema:', error);
        throw error;
    }
}

// Exporta apenas a aplicação e a função de inicialização
module.exports = { app, initializeSystem };
