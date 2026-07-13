const express = require('express');
const router = express.Router();
const configuracaoController = require('../controllers/configuracao.controller');

// GET /api/configuracoes - Obtém as configurações atuais
router.get('/', configuracaoController.getSettings);

// PUT /api/configuracoes - Atualiza as configurações
router.put('/', configuracaoController.updateSettings);

module.exports = router;
