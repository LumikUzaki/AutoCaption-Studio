const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');

// GET /api/video/stream/:id - Stream de vídeo para o player (suporta range requests)
router.get('/stream/:id', videoController.streamVideo);

// GET /api/video/download/:tipo/:id - Download de arquivo (video ou legenda)
// tipo: 'video' ou 'legenda'
router.get('/download/:tipo/:id', videoController.downloadArquivo);

module.exports = router;
