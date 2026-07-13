const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const transcricaoController = require('../controllers/transcricao.controller');

// Configuração do Multer para uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Gera um nome único baseado no timestamp e nome original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'video-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // Limite de 2GB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|avi|mov|mkv|webm|flv|wmv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de vídeo são permitidos (mp4, avi, mov, mkv, webm, flv, wmv)'));
        }
    }
});

// POST /api/transcricao/iniciar - Inicia uma nova transcrição (upload + processamento)
router.post('/iniciar', upload.single('video'), transcricaoController.iniciarTranscricao);

// GET /api/transcricao/:id - Obtém dados completos de uma transcrição para edição
router.get('/:id', transcricaoController.obterTranscricao);

// PUT /api/transcricao/:id/salvar - Salva alterações nos segmentos de legenda
router.put('/:id/salvar', transcricaoController.salvarLegenda);

// GET /api/transcricao/:id/exportar - Exporta legenda em formato específico
router.get('/:id/exportar', transcricaoController.exportarLegenda);

module.exports = router;
