const { db } = require('../models/database');

/**
 * Controller de Jobs
 * Gerencia o ciclo de vida das transcrições (criação, status, histórico)
 */
class JobController {

    // Lista todos os jobs com paginação e filtros
    static getAllJobs(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Busca total de registros para paginação
            const totalStmt = db.prepare('SELECT COUNT(*) as count FROM jobs');
            const total = totalStmt.get().count;

            // Busca os jobs com paginação
            const stmt = db.prepare(`
                SELECT 
                    id, filename, original_name, status, engine, model, language, 
                    progress, created_at, updated_at, error_message
                FROM jobs 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `);
            
            const jobs = stmt.all(limit, offset);

            return res.json({
                success: true,
                data: {
                    jobs,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        totalRecords: total
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao listar jobs:', error);
            return res.status(500).json({ success: false, error: 'Erro ao buscar histórico de jobs.' });
        }
    }

    // Obtém detalhes de um job específico
    static getJobById(req, res) {
        try {
            const { id } = req.params;
            
            const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
            const job = stmt.get(id);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Job não encontrado.' });
            }

            // Busca segmentos associados se o job estiver concluído
            let segments = [];
            if (job.status === 'completed') {
                const segStmt = db.prepare('SELECT * FROM segments WHERE job_id = ? ORDER BY start_time ASC');
                segments = segStmt.all(id);
            }

            return res.json({
                success: true,
                data: { ...job, segments }
            });
        } catch (error) {
            console.error('Erro ao buscar job:', error);
            return res.status(500).json({ success: false, error: 'Erro ao buscar detalhes do job.' });
        }
    }

    // Deleta um job e seus segmentos
    static deleteJob(req, res) {
        try {
            const { id } = req.params;
            
            // Verifica existência
            const checkStmt = db.prepare('SELECT id FROM jobs WHERE id = ?');
            if (!checkStmt.get(id)) {
                return res.status(404).json({ success: false, error: 'Job não encontrado.' });
            }

            // Deleta segmentos primeiro (chave estrangeira)
            const delSegStmt = db.prepare('DELETE FROM segments WHERE job_id = ?');
            delSegStmt.run(id);

            // Deleta o job
            const delJobStmt = db.prepare('DELETE FROM jobs WHERE id = ?');
            delJobStmt.run(id);

            // Nota: A limpeza do arquivo físico seria feita aqui ou via serviço

            return res.json({ success: true, message: 'Job removido com sucesso.' });
        } catch (error) {
            console.error('Erro ao deletar job:', error);
            return res.status(500).json({ success: false, error: 'Erro ao remover job.' });
        }
    }

    // Cancela um job em processamento
    static cancelJob(req, res) {
        try {
            const { id } = req.params;
            
            const stmt = db.prepare('SELECT status FROM jobs WHERE id = ?');
            const job = stmt.get(id);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Job não encontrado.' });
            }

            if (job.status !== 'pending' && job.status !== 'processing') {
                return res.status(400).json({ success: false, error: 'Só é possível cancelar jobs pendentes ou em processamento.' });
            }

            // Atualiza status
            const updateStmt = db.prepare(`
                UPDATE jobs 
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            updateStmt.run(id);

            // Aqui entraria a lógica para remover da fila do BullMQ se necessário

            return res.json({ success: true, message: 'Job cancelado com sucesso.' });
        } catch (error) {
            console.error('Erro ao cancelar job:', error);
            return res.status(500).json({ success: false, error: 'Erro ao cancelar job.' });
        }
    }
}

module.exports = JobController;
