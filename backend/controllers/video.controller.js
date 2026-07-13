const { db } = require('../models/database');
const path = require('path');
const fs = require('fs');

/**
 * Controller de Vídeo
 * Gerencia upload, download e informações de arquivos de mídia
 */
class VideoController {

    // Lista vídeos disponíveis (jobs completados que possuem arquivo)
    static getVideos(req, res) {
        try {
            const stmt = db.prepare(`
                SELECT id, original_name, filename, duration, file_size, created_at
                FROM jobs
                WHERE status = 'completed' AND file_path IS NOT NULL
                ORDER BY created_at DESC
            `);
            
            const videos = stmt.all();

            return res.json({
                success: true,
                data: videos
            });
        } catch (error) {
            console.error('Erro ao listar vídeos:', error);
            return res.status(500).json({ success: false, error: 'Erro ao listar vídeos.' });
        }
    }

    // Stream de vídeo para o player do editor
    static streamVideo(req, res) {
        try {
            const { id } = req.params;

            const jobStmt = db.prepare('SELECT file_path, original_name FROM jobs WHERE id = ?');
            const job = jobStmt.get(id);

            if (!job || !job.file_path) {
                return res.status(404).json({ success: false, error: 'Vídeo não encontrado.' });
            }

            const filePath = job.file_path;
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: 'Arquivo de vídeo não encontrado no servidor.' });
            }

            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const range = req.headers.range;

            // Suporte a Range Requests para streaming eficiente
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                
                const file = fs.createReadStream(filePath, { start, end });
                
                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4', // Simplificação, idealmente detectar MIME type
                };
                
                res.writeHead(206, head);
                file.pipe(res);
            } else {
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                };
                res.writeHead(200, head);
                fs.createReadStream(filePath).pipe(res);
            }

        } catch (error) {
            console.error('Erro ao streamar vídeo:', error);
            return res.status(500).json({ success: false, error: 'Erro ao carregar vídeo.' });
        }
    }

    // Download do arquivo de legenda exportada
    static downloadSubtitle(req, res) {
        try {
            const { id, format } = req.params;
            
            const jobStmt = db.prepare('SELECT original_name FROM jobs WHERE id = ?');
            const job = jobStmt.get(id);

            if (!job) {
                return res.status(404).json({ success: false, error: 'Job não encontrado.' });
            }

            // Caminho hipotético do arquivo exportado
            // Na prática, o serviço de exportação geraria isso sob demanda ou cache
            const baseName = path.basename(job.original_name, path.extname(job.original_name));
            const fileName = `${baseName}.${format}`;
            const filePath = path.join(__dirname, '../exports', fileName);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: 'Arquivo de legenda não encontrado. Gere a exportação primeiro.' });
            }

            res.download(filePath, fileName);

        } catch (error) {
            console.error('Erro ao baixar legenda:', error);
            return res.status(500).json({ success: false, error: 'Erro ao preparar download.' });
        }
    }

    // Remove um arquivo de vídeo (e seus dados associados)
    static deleteVideo(req, res) {
        // Esta lógica geralmente reutiliza o deleteJob, mas pode ter comportamentos específicos
        // como limpeza de arquivos temporários de preview, etc.
        return res.status(501).json({ 
            success: false, 
            error: 'Use a rota de deletion de Jobs para remover vídeos e seus dados.' 
        });
    }
}

module.exports = VideoController;
