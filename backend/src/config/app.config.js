const path = require('path');

module.exports = {
  // Porta do servidor
  port: process.env.PORT || 3000,
  
  // Ambiente
  env: process.env.NODE_ENV || 'development',
  
  // Caminhos
  paths: {
    database: process.env.DATABASE_PATH || path.join(__dirname, '../../database/legendas_pro.db'),
    uploads: process.env.UPLOAD_DIR || path.join(__dirname, '../../backend/uploads'),
    outputs: process.env.OUTPUT_DIR || path.join(__dirname, '../../backend/outputs'),
    python: process.env.PYTHON_DIR || path.join(__dirname, '../../python')
  },
  
  // Python
  python: {
    interpreter: process.env.PYTHON_PATH || 'python3',
    engines: (process.env.AVAILABLE_ENGINES || 'faster-whisper,stable-ts,whisperx').split(','),
    defaultModel: process.env.DEFAULT_MODEL || 'base',
    defaultDevice: process.env.DEFAULT_DEVICE || 'cuda'
  },
  
  // Upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 2147483648, // 2GB
    allowedMimeTypes: [
      'video/mp4',
      'video/x-matroska',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm'
    ]
  },
  
  // Fila de processamento
  queue: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 2,
    maxAttempts: 3,
    jobTimeout: 3600000 // 1 hora
  }
};
