const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');

// GET /api/jobs - Lista todos os jobs com paginação e filtros
router.get('/', jobController.getAllJobs);

// GET /api/jobs/:id - Obtém detalhes de um job específico
router.get('/:id', jobController.getJobById);

// POST /api/jobs/:id/cancelar - Cancela um job em andamento
router.post('/:id/cancelar', jobController.cancelJob);

// DELETE /api/jobs/:id - Exclui um job (e seus arquivos associados)
router.delete('/:id', jobController.deleteJob);

module.exports = router;
