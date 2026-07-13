const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const videoController = require('../controllers/video.controller');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './backend/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4',
    'video/x-matroska',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2147483648 // 2GB
  }
});

// Middleware de tratamento de erros do multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 2GB' });
    }
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

/**
 * @route   POST /api/videos/upload
 * @desc    Upload de vídeo ou áudio
 * @access  Public
 */
router.post('/upload', handleMulterError, upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const videoData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      filesize: req.file.size,
      mimetype: req.file.mimetype
    };
    
    const video = await videoController.createVideo(videoData);
    res.status(201).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/videos
 * @desc    Listar todos os vídeos
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const videos = await videoController.getAllVideos(limit, offset);
    const total = await videoController.getVideoCount();
    
    res.json({
      success: true,
      data: videos,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/videos/:id
 * @desc    Buscar vídeo por ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const video = await videoController.getVideoById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }
    
    res.json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/videos/:id
 * @desc    Deletar vídeo e seus arquivos associados
 * @access  Public
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await videoController.deleteVideo(req.params.id);
    res.json({ success: true, message: 'Vídeo deletado com sucesso' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/videos/:id/transcricao
 * @desc    Buscar transcrição associada ao vídeo
 * @access  Public
 */
router.get('/:id/transcricao', async (req, res, next) => {
  try {
    const transcricao = await videoController.getTranscricaoByVideoId(req.params.id);
    
    if (!transcricao) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }
    
    res.json({ success: true, data: transcricao });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
