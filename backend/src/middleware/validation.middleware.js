/**
 * Middleware de Validação
 * Valida inputs de requisições HTTP
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Validar UUID
 */
function isValidUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validar ID na URL
 */
function validateId(req, res, next) {
  const { id } = req.params;
  
  if (!id || !isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'ID inválido. Deve ser um UUID válido.'
      }
    });
  }
  
  next();
}

/**
 * Validar upload de vídeo
 */
function validateVideoUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_FILE',
        message: 'Nenhum arquivo enviado'
      }
    });
  }
  
  const allowedMimeTypes = [
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
  
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MIME_TYPE',
        message: `Tipo de arquivo não permitido. Tipos aceitos: ${allowedMimeTypes.join(', ')}`,
        details: {
          received: req.file.mimetype,
          allowed: allowedMimeTypes
        }
      }
    });
  }
  
  next();
}

/**
 * Validar opções de transcrição
 */
function validateTranscricaoOptions(req, res, next) {
  const { engine, model, device, language } = req.body;
  
  const enginesValidas = ['faster-whisper', 'stable-ts', 'whisperx'];
  const modelosValidos = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'];
  const devicesValidos = ['cuda', 'cpu'];
  
  if (engine && !enginesValidas.includes(engine)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ENGINE',
        message: `Engine inválida. Opções válidas: ${enginesValidas.join(', ')}`,
        details: { received: engine, allowed: enginesValidas }
      }
    });
  }
  
  if (model && !modelosValidos.includes(model)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MODEL',
        message: `Modelo inválido. Opções válidas: ${modelosValidos.join(', ')}`,
        details: { received: model, allowed: modelosValidos }
      }
    });
  }
  
  if (device && !devicesValidos.includes(device)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_DEVICE',
        message: `Dispositivo inválido. Opções válidas: ${devicesValidos.join(', ')}`,
        details: { received: device, allowed: devicesValidos }
      }
    });
  }
  
  if (language && typeof language !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_LANGUAGE',
        message: 'Idioma deve ser uma string (código ISO)',
        details: { received: language }
      }
    });
  }
  
  next();
}

/**
 * Validar formato de exportação
 */
function validateExportFormat(req, res, next) {
  const { formato } = req.params;
  
  const formatosValidos = ['srt', 'vtt', 'txt', 'json', 'ass'];
  
  if (!formatosValidos.includes(formato.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: `Formato não suportado. Formatos disponíveis: ${formatosValidos.join(', ')}`,
        details: { received: formato, allowed: formatosValidos }
      }
    });
  }
  
  next();
}

/**
 * Validar atualização de segmento
 */
function validateSegmentoUpdate(req, res, next) {
  const { start_time, end_time, text } = req.body;
  
  if (start_time !== undefined && (typeof start_time !== 'number' || start_time < 0)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_START_TIME',
        message: 'Tempo inicial deve ser um número positivo',
        details: { received: start_time }
      }
    });
  }
  
  if (end_time !== undefined && (typeof end_time !== 'number' || end_time < 0)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_END_TIME',
        message: 'Tempo final deve ser um número positivo',
        details: { received: end_time }
      }
    });
  }
  
  if (start_time !== undefined && end_time !== undefined && start_time >= end_time) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TIME_RANGE',
        message: 'Tempo inicial deve ser menor que tempo final',
        details: { start_time, end_time }
      }
    });
  }
  
  if (text !== undefined && (typeof text !== 'string' || text.trim() === '')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TEXT',
        message: 'Texto não pode ser vazio',
        details: { received: text }
      }
    });
  }
  
  next();
}

/**
 * Middleware global de tratamento de erros assíncronos
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  isValidUUID,
  validateId,
  validateVideoUpload,
  validateTranscricaoOptions,
  validateExportFormat,
  validateSegmentoUpdate,
  asyncHandler
};
