const express = require('express');
const router = express.Router();
const db = require('../database/init');

/**
 * @route   GET /api/config
 * @desc    Obter todas as configurações
 * @access  Public
 */
router.get('/', (req, res) => {
  const configs = db.prepare('SELECT * FROM configuracoes').all();
  res.json({ success: true, data: configs });
});

/**
 * @route   GET /api/config/:key
 * @desc    Obter configuração por chave
 * @access  Public
 */
router.get('/:key', (req, res, next) => {
  try {
    const config = db.prepare('SELECT * FROM configuracoes WHERE key = ?').get(req.params.key);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/config/:key
 * @desc    Atualizar configuração
 * @access  Public
 */
router.put('/:key', (req, res, next) => {
  try {
    const { value, description } = req.body;
    
    const stmt = db.prepare(`
      UPDATE configuracoes 
      SET value = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `);
    
    const result = stmt.run(value, description, req.params.key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    
    const config = db.prepare('SELECT * FROM configuracoes WHERE key = ?').get(req.params.key);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/config
 * @desc    Criar nova configuração
 * @access  Public
 */
router.post('/', (req, res, next) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Chave e valor são obrigatórios' });
    }
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO configuracoes (key, value, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(key, value, description || null);
    
    const config = db.prepare('SELECT * FROM configuracoes WHERE key = ?').get(key);
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
