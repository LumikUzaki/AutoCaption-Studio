const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/export/:transcricaoId/:formato
 * @desc    Exportar transcrição em formato específico
 * @access  Public
 */
router.get('/:transcricaoId/:formato', async (req, res, next) => {
  try {
    const { transcricaoId, formato } = req.params;
    
    // Formatos suportados
    const formatosSuportados = ['srt', 'vtt', 'txt', 'json', 'ass'];
    
    if (!formatosSuportados.includes(formato.toLowerCase())) {
      return res.status(400).json({ 
        error: `Formato não suportado. Use: ${formatosSuportados.join(', ')}` 
      });
    }
    
    // Buscar transcrição e segmentos
    const db = require('../database/init');
    const transcricao = db.prepare('SELECT * FROM transcricoes WHERE id = ?').get(transcricaoId);
    
    if (!transcricao) {
      return res.status(404).json({ error: 'Transcrição não encontrada' });
    }
    
    const segmentos = db.prepare('SELECT * FROM segmentos WHERE transcricao_id = ? ORDER BY position ASC')
      .all(transcricaoId);
    
    // Gerar conteúdo baseado no formato
    let conteudo;
    let mimeType;
    let extensao;
    
    switch (formato.toLowerCase()) {
      case 'srt':
        conteudo = gerarSRT(segmentos);
        mimeType = 'application/x-subrip';
        extensao = 'srt';
        break;
      case 'vtt':
        conteudo = gerarVTT(segmentos);
        mimeType = 'text/vtt';
        extensao = 'vtt';
        break;
      case 'txt':
        conteudo = gerarTXT(segmentos);
        mimeType = 'text/plain';
        extensao = 'txt';
        break;
      case 'json':
        conteudo = JSON.stringify({ transcricao, segmentos }, null, 2);
        mimeType = 'application/json';
        extensao = 'json';
        break;
      case 'ass':
        conteudo = gerarASS(segmentos);
        mimeType = 'text/x-ssa';
        extensao = 'ass';
        break;
    }
    
    // Enviar arquivo
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="legendas.${extensao}"`);
    res.send(conteudo);
  } catch (error) {
    next(error);
  }
});

// Funções de formatação

function formatTimeSRT(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const time = date.toISOString().substr(11, 12);
  return time.replace('.', ',');
}

function formatTimeVTT(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  return date.toISOString().substr(11, 12);
}

function gerarSRT(segmentos) {
  return segmentos.map((seg, index) => {
    return `${index + 1}\n${formatTimeSRT(seg.start_time)} --> ${formatTimeSRT(seg.end_time)}\n${seg.text}\n`;
  }).join('\n');
}

function gerarVTT(segmentos) {
  let vtt = 'WEBVTT\n\n';
  vtt += segmentos.map((seg, index) => {
    return `${formatTimeVTT(seg.start_time)} --> ${formatTimeVTT(seg.end_time)}\n${seg.text}\n`;
  }).join('\n');
  return vtt;
}

function gerarTXT(segmentos) {
  return segmentos.map(seg => seg.text).join('\n\n');
}

function gerarASS(segmentos) {
  let ass = `[Script Info]
Title: Legendas Pro
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  
  for (const seg of segmentos) {
    const start = formatTimeASS(seg.start_time);
    const end = formatTimeASS(seg.end_time);
    const text = seg.text.replace(/\n/g, '\\N');
    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
  }
  
  return ass;
}

function formatTimeASS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

module.exports = router;
