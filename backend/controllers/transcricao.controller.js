const db = require('../models/database');
const path = require('path');
const fs = require('fs');

/**
 * Controller de Transcrição
 * Responsável por iniciar o processo de transcrição e gerenciar os dados brutos
 */
class TranscricaoController {

    // Inicia um novo processo de transcrição
    static async createTranscription(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
            }

            const { engine, model, language, outputFormat } = req.body;
            const file = req.file;

            // Validações básicas
            const validEngines = ['faster-whisper', 'stable-ts', 'whisperx'];
            if (engine && !validEngines.includes(engine)) {
                // Limpa o arquivo uploadado se a validação falhar
                fs.unlinkSync(file.path);
                return res.status(400).json({ success: false, error: 'Engine inválida.' });
            }

            // Cria o registro do Job no banco
            const stmt = db.prepare(`
                INSERT INTO jobs (filename, original_name, file_path, engine, model, language, status, progress)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
            `);
            
            const info = stmt.run(
                file.filename,
                file.originalname,
                file.path,
                engine || process.env.WHISPER_ENGINE || 'stable-ts',
                model || process.env.WHISPER_MODEL || 'medium',
                language || 'pt'
            );

            const jobId = info.lastInsertRowid;

            // Aqui seria chamado o Service/Queue para processar em background
            // const jobProcessor = require('../services/job.processor');
            // await jobProcessor.addJob(jobId);

            return res.status(201).json({
                success: true,
                message: 'Transcrição iniciada com sucesso.',
                data: { id: jobId, filename: file.originalname, status: 'pending' }
            });

        } catch (error) {
            console.error('Erro ao criar transcrição:', error);
            
            // Limpeza em caso de erro
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({ success: false, error: 'Erro interno ao iniciar transcrição.' });
        }
    }

    // Obtém o conteúdo bruto de uma transcrição (para o editor)
    static getTranscriptionData(req, res) {
        try {
            const { id } = req.params;

            const jobStmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
            const job = jobStmt.get(id);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Transcrição não encontrada.' });
            }

            if (job.status !== 'completed') {
                return res.status(400).json({ 
                    success: false, 
                    error: `Transcrição ainda não está pronta. Status atual: ${job.status}` 
                });
            }

            const segStmt = db.prepare('SELECT * FROM segments WHERE job_id = ? ORDER BY start_time ASC');
            const segments = segStmt.all(id);

            return res.json({
                success: true,
                data: {
                    jobId: job.id,
                    filename: job.original_name,
                    engine: job.engine,
                    model: job.model,
                    segments: segments
                }
            });

        } catch (error) {
            console.error('Erro ao buscar dados da transcrição:', error);
            return res.status(500).json({ success: false, error: 'Erro ao carregar dados da transcrição.' });
        }
    }

    // Atualiza segmentos editados pelo usuário
    static updateSegments(req, res) {
        try {
            const { id } = req.params;
            const { segments } = req.body;

            if (!Array.isArray(segments)) {
                return res.status(400).json({ success: false, error: 'Formato de segmentos inválido.' });
            }

            // Verifica se o job existe e está completo
            const jobStmt = db.prepare('SELECT id, status FROM jobs WHERE id = ?');
            const job = jobStmt.get(id);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Job não encontrado.' });
            }

            // Inicia transação para garantir integridade
            const transaction = db.transaction(() => {
                // Deleta segmentos antigos
                const deleteStmt = db.prepare('DELETE FROM segments WHERE job_id = ?');
                deleteStmt.run(id);

                // Insere novos segmentos
                const insertStmt = db.prepare(`
                    INSERT INTO segments (job_id, start_time, end_time, text, speaker, words)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                for (const seg of segments) {
                    insertStmt.run(
                        id,
                        seg.start_time,
                        seg.end_time,
                        seg.text,
                        seg.speaker || null,
                        seg.words ? JSON.stringify(seg.words) : null
                    );
                }
            });

            transaction();

            return res.json({ success: true, message: 'Segmentos atualizados com sucesso.' });

        } catch (error) {
            console.error('Erro ao atualizar segmentos:', error);
            return res.status(500).json({ success: false, error: 'Erro ao salvar edições.' });
        }
    }
}

module.exports = TranscricaoController;
