const { db } = require('../models/database');

/**
 * Service para manipulação e formatação de legendas.
 * Converte entre formatos (SRT, VTT, JSON) e salva no banco.
 */
class SubtitleService {

    /**
     * Converte segmentos JSON para formato SRT.
     * @param {Array} segments - Array de objetos { start, end, text }.
     * @returns {string} Conteúdo no formato SRT.
     */
    toSRT(segments) {
        return segments.map((seg, index) => {
            const startTime = this.formatTimeSRT(seg.start);
            const endTime = this.formatTimeSRT(seg.end);
            return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
        }).join('\n');
    }

    /**
     * Converte segmentos JSON para formato VTT otimizado.
     * @param {Array} segments - Array de objetos { start, end, text }.
     * @returns {string} Conteúdo no formato VTT.
     */
    toVTT(segments) {
        let vtt = 'WEBVTT\nKind: captions\nLanguage: pt-BR\n\n';
        vtt += segments.map((seg, index) => {
            const startTime = this.formatTimeVTT(seg.start);
            const endTime = this.formatTimeVTT(seg.end);
            return `${startTime} --> ${endTime}\n${seg.text}`;
        }).join('\n\n');
        return vtt;
    }

    /**
     * Formata tempo em segundos para string SRT (HH:MM:SS,ms).
     */
    formatTimeSRT(seconds) {
        const date = new Date(0, 0, 0, 0, 0, 0, seconds * 1000);
        const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss},${ms}`;
    }

    /**
     * Formata tempo em segundos para string VTT (HH:MM:SS.ms).
     */
    formatTimeVTT(seconds) {
        const date = new Date(0, 0, 0, 0, 0, 0, seconds * 1000);
        const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss}.${ms}`;
    }

    /**
     * Salva segmentos de legenda no banco de dados com transação otimizada.
     * @param {number} jobId - ID do job.
     * @param {Array} segments - Array de segmentos.
     */
    salvarSegmentos(jobId, segments) {
        const insertSegment = db.prepare(`
            INSERT INTO segments (job_id, start_time, end_time, text, words)
            VALUES (?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((segments) => {
            // Deleta segmentos existentes primeiro
            db.prepare('DELETE FROM segments WHERE job_id = ?').run(jobId);
            
            for (const seg of segments) {
                const wordsJson = seg.words ? JSON.stringify(seg.words) : null;
                insertSegment.run(jobId, seg.start, seg.end, seg.text, wordsJson);
            }
        });

        transaction(segments);
    }

    /**
     * Obtém segmentos de um job ordenados por tempo inicial.
     * @param {number} jobId - ID do job.
     * @returns {Array} Array de segmentos.
     */
    obterSegmentos(jobId) {
        const stmt = db.prepare(`
            SELECT id, start_time as start, end_time as end, text, words
            FROM segments
            WHERE job_id = ?
            ORDER BY start_time ASC
        `);
        
        const rows = stmt.all(jobId);
        return rows.map(row => ({
            ...row,
            words: row.words ? JSON.parse(row.words) : null
        }));
    }

    /**
     * Atualiza múltiplos segmentos de uma vez (bulk update).
     * @param {number} jobId - ID do job.
     * @param {Array} segments - Array de segmentos atualizados.
     */
    atualizarSegmentosBulk(jobId, segments) {
        const updateStmt = db.prepare(`
            UPDATE segments 
            SET start_time = ?, end_time = ?, text = ?, words = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        const transaction = db.transaction((segments) => {
            for (const seg of segments) {
                const wordsJson = seg.words ? JSON.stringify(seg.words) : null;
                updateStmt.run(seg.start, seg.end, seg.text, wordsJson, seg.id);
            }
        });

        transaction(segments);
    }

    /**
     * Atualiza um segmento específico.
     * @param {number} segmentId - ID do segmento.
     * @param {object} data - Dados a atualizar { start?, end?, text? }.
     */
    atualizarSegmento(segmentId, data) {
        const fields = [];
        const values = [];

        if (data.start !== undefined) {
            fields.push('start_time = ?');
            values.push(data.start);
        }
        if (data.end !== undefined) {
            fields.push('end_time = ?');
            values.push(data.end);
        }
        if (data.text !== undefined) {
            fields.push('text = ?');
            values.push(data.text);
        }
        if (data.words !== undefined) {
            fields.push('words = ?');
            values.push(JSON.stringify(data.words));
        }

        if (fields.length === 0) return;

        fields.push('atualizado_em = CURRENT_TIMESTAMP');
        values.push(segmentId);

        const stmt = db.prepare(`
            UPDATE segments SET ${fields.join(', ')} WHERE id = ?
        `);

        stmt.run(...values);
    }

    /**
     * Exporta legendas para arquivo físico.
     * @param {number} jobId - ID do job.
     * @param {string} format - Formato de exportação (srt, vtt, txt, json).
     * @param {string} outputPath - Caminho de saída do arquivo.
     * @returns {string} Caminho do arquivo gerado.
     */
    exportToFile(jobId, format, outputPath) {
        const segments = this.obterSegmentos(jobId);
        let content = '';

        switch (format.toLowerCase()) {
            case 'srt':
                content = this.toSRT(segments);
                break;
            case 'vtt':
                content = this.toVTT(segments);
                break;
            case 'txt':
                content = segments.map(s => s.text).join('\n\n');
                break;
            case 'json':
                content = JSON.stringify(segments, null, 2);
                break;
            default:
                throw new Error(`Formato não suportado: ${format}`);
        }

        const fs = require('fs');
        fs.writeFileSync(outputPath, content, 'utf-8');
        return outputPath;
    }
}

module.exports = new SubtitleService();
