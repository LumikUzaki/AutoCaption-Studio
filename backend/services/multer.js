const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Garantir que o diretório de uploads existe
const uploadDir = process.env.UPLOAD_DIR || './backend/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gera um nome único para o arquivo
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Filtro de arquivos (apenas vídeos e áudio)
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'video/mp4',
    'video/x-matroska',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado. Envie apenas vídeos ou áudios.'), false);
  }
};

// Limites de upload
const limits = {
  fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_GB) * 1024 * 1024 * 1024 || 10 * 1024 * 1024 * 1024, // 10GB padrão
  files: 50 // Limite para uploads em lote
};

// Middleware multer configurado
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

// Middleware para tratamento de erros do multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Arquivo muito grande',
        message: `O tamanho máximo permitido é ${process.env.UPLOAD_MAX_SIZE_GB || 10}GB`
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Muitos arquivos',
        message: `O limite máximo é ${limits.files} arquivos por vez`
      });
    }
    return res.status(400).json({
      error: 'Erro no upload',
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      error: 'Erro no upload',
      message: err.message
    });
  }
  next();
};

module.exports = {
  upload,
  handleMulterError,
  uploadDir
};
