const path = require('path');
const { getDb } = require('../models/database');
const whisperBridge = require('./whisperBridge');
const ffmpegService = require('./ffmpeg');
const subtitleService = require('./subtitle');

/**
 * Service de fila de processamento simplificado (SEM REDIS).
 * Gerencia a fila de transcrições em segundo plano usando processamento nativo.
 */
class QueueService {
    constructor() {
        this.queue = null;
        this.worker = null;
    }

    /**
     * Inicializa o serviço de fila (modo simplificado sem Redis).
     */
    async init() {
        console.log('✅ Modo de fila simplificado iniciado (sem dependência do Redis).');
        // Fallback: processamento direto sem fila real
        this.queue = { add: this.addJobDirect.bind(this) };
    }

    /**
     * Adiciona um job diretamente (processamento imediato em background).
     */
    async addJobDirect(data, opts) {
        const jobId = data.jobId;
        // Processa imediatamente em background
        setImmediate(() => {
            this.processarJob({ data, updateProgress: (progress) => this.updateProgress(jobId, progress) })
                .catch(err => console.error('Erro no job direto:', err));
        });
        return { id: jobId };
    }

    /**
     * Adiciona um job à fila de transcrição.
     */
    async adicionarJob(jobData) {
        return this.queue.add('transcrever', jobData, {
            attempts: 1,
            removeOnComplete: false,
            removeOnFail: false
        });
    }

    /**
     * Processa um job de transcrição.
     */
    async processarJob(job) {
        const { jobId, videoPath, engine, model, language, device } = job.data;
        const db = getDb();

        try {
            // Atualiza status para processando
            db.exec(`
                UPDATE jobs 
                SET status = 'processing', updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, jobId);

            if (this.updateProgress) {
                this.updateProgress(jobId, 5, 'Iniciando processamento...');
            }

            // Extrai áudio se necessário (opcional, depende da engine)
            // const audioPath = videoPath.replace(/\.[^/.]+$/, '.wav');
            // await ffmpegService.extractAudio(videoPath, audioPath);

            if (this.updateProgress) {
                this.updateProgress(jobId, 10, 'Carregando modelo e transcrevendo...');
            }

            // Chama a ponte Python para transcrição
            const resultado = await whisperBridge.transcrever({
                videoPath,
                engine,
                model,
                language,
                deviceId: device,
                jobId,
                onProgress: (id, progress, msg, isError) => {
                    if (isError) {
                        db.exec(`UPDATE jobs SET error_message = ?, status = 'failed' WHERE id = ?`, [msg, id]);
                    } else {
                        db.exec(`UPDATE jobs SET progresso = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [progress, id]);
                    }
                }
            });

            if (!resultado.success) {
                throw new Error(resultado.error || 'Falha na transcrição');
            }

            // Salva os segmentos no banco
            const segmentos = resultado.data.segments || [];
            subtitleService.salvarSegmentos(jobId, segmentos);

            // Atualiza job como concluído
            db.exec(`
                UPDATE jobs 
                SET status = 'completed', progresso = 100, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, jobId);

            console.log(`Job ${jobId} concluído com ${segmentos.length} segmentos.`);

        } catch (error) {
            console.error(`Erro ao processar job ${jobId}:`, error);
            db.exec(`
                UPDATE jobs 
                SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [error.message, jobId]);
            throw error;
        }
    }

    /**
     * Atualiza o progresso via Socket.io (injetado externamente).
     */
    setProgressHandler(handler) {
        this.updateProgress = handler;
    }

    /**
     * Fecha conexões da fila (simplificado, sem Redis).
     */
    async close() {
        // Nada para fechar no modo simplificado
        console.log('Serviço de fila fechado.');
    }
}

module.exports = new QueueService();
