const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

// GET /api/jobs - Lista todos os jobs com paginação e filtros
router.get('/', jobController.listarJobs);

// GET /api/jobs/:id - Obtém detalhes de um job específico
router.get('/:id', jobController.obterJob);

// POST /api/jobs/:id/cancelar - Cancela um job em andamento
router.post('/:id/cancelar', jobController.cancelarJob);

// DELETE /api/jobs/:id - Exclui um job (e seus arquivos associados)
router.delete('/:id', jobController.excluirJob);

module.exports = router;
