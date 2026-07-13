const express = require('express');
const router = express.Router();
const configuracaoController = require('../controllers/configuracao.controller');

// GET /api/configuracoes - Obtém as configurações atuais
router.get('/', configuracaoController.getConfiguracoes);

// PUT /api/configuracoes - Atualiza as configurações
router.put('/', configuracaoController.atualizarConfiguracoes);

module.exports = router;
