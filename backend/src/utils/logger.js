/**
 * Logger configurável com Winston
 * Sistema de logs estruturados para o Legendas Pro
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Garantir diretório de logs existe
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../backend/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato customizado de logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    if (stack) {
      msg += `\n${stack}`;
    }
    
    return msg;
  })
);

// Criar instância do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'legendas-pro' },
  transports: [
    // Console (sempre ativo)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // Arquivo de erros
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Arquivo de warnings
    new winston.transports.File({
      filename: path.join(logDir, 'warn.log'),
      level: 'warn',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Arquivo combinado (todos os níveis)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Logger para desenvolvimento (mais verboso)
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'debug.log'),
    level: 'debug',
    maxsize: 10485760,
    maxFiles: 3
  }));
}

// Funções utilitárias
const logTypes = {
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
  
  // Logs específicos do sistema
  server: (message, meta) => logger.info(`[SERVER] ${message}`, meta),
  api: (message, meta) => logger.info(`[API] ${message}`, meta),
  db: (message, meta) => logger.info(`[DATABASE] ${message}`, meta),
  queue: (message, meta) => logger.info(`[QUEUE] ${message}`, meta),
  python: (message, meta) => logger.info(`[PYTHON] ${message}`, meta),
  ffmpeg: (message, meta) => logger.info(`[FFMPEG] ${message}`, meta),
  websocket: (message, meta) => logger.info(`[WEBSOCKET] ${message}`, meta),
  
  // Erros específicos
  apiError: (message, meta) => logger.error(`[API ERROR] ${message}`, meta),
  dbError: (message, meta) => logger.error(`[DATABASE ERROR] ${message}`, meta),
  queueError: (message, meta) => logger.error(`[QUEUE ERROR] ${message}`, meta),
  pythonError: (message, meta) => logger.error(`[PYTHON ERROR] ${message}`, meta),
  ffmpegError: (message, meta) => logger.error(`[FFMPEG ERROR] ${message}`, meta)
};

module.exports = logTypes;
