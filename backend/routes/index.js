const express = require('express');
const router = express.Router();

const configuracaoRoutes = require('./configuracao.routes');
const jobRoutes = require('./job.routes');
const transcricaoRoutes = require('./transcricao.routes');
const videoRoutes = require('./video.routes');

// Monta as rotas sob o prefixo /api
router.use('/configuracoes', configuracaoRoutes);
router.use('/jobs', jobRoutes);
router.use('/transcricao', transcricaoRoutes);
router.use('/video', videoRoutes);

// Rota de saúde da API
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
