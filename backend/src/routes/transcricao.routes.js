const express = require('express');
const router = express.Router();
const transcricaoController = require('../controllers/transcricao.controller');

/**
 * @route   POST /api/transcricoes/:videoId/iniciar
 * @desc    Iniciar transcrição de um vídeo
 * @access  Public
 */
router.post('/:videoId/iniciar', async (req, res, next) => {
  try {
    const { engine, model, device, language } = req.body;
    
    const transcricao = await transcricaoController.iniciarTranscricao(
      req.params.videoId,
      { engine, model, device, language }
    );
    
    res.status(201).json({ success: true, data: transcricao });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transcricoes
 * @desc    Listar todas as transcrições
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const transcricoes = await transcricaoController.getAllTranscricoes(limit, offset);
    
    res.json({ success: true, data: transcricoes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transcricoes/:id
 * @desc    Buscar transcrição por ID com segmentos
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const transcricao = await transcricaoController.getTranscricaoById(req.params.id);
    
    if (!transcricao) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }
    
    res.json({ success: true, data: transcricao });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/transcricoes/:id/status
 * @desc    Atualizar status da transcrição
 * @access  Public
 */
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status, progress } = req.body;
    
    const result = await transcricaoController.updateStatus(req.params.id, status, progress);
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/transcricoes/:id
 * @desc    Deletar transcrição e seus segmentos
 * @access  Public
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await transcricaoController.deleteTranscricao(req.params.id);
    res.json({ success: true, message: 'Transcrição deletada com sucesso' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
