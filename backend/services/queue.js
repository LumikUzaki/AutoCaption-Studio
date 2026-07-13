const { Queue, Worker } = require('bullmq');
const path = require('path');
const { getDb } = require('../models/database');
const whisperBridge = require('./whisperBridge');
const ffmpegService = require('./ffmpeg');
const subtitleService = require('./subtitle');

/**
 * Service de fila de processamento usando BullMQ.
 * Gerencia a fila de transcrições em segundo plano.
 */
class QueueService {
    constructor() {
        this.queue = null;
        this.worker = null;
        this.connectionConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
        };
    }

    /**
     * Inicializa a fila e o worker.
     * Nota: Para ambientes sem Redis, podemos fallback para processamento síncrono simples.
     */
    async init() {
        try {
            // Tenta inicializar com Redis
            this.queue = new Queue('transcricao-queue', { connection: this.connectionConfig });
            
            this.worker = new Worker('transcricao-queue', async (job) => {
                await this.processarJob(job);
            }, { connection: this.connectionConfig });

            this.worker.on('completed', (job) => {
                console.log(`Job ${job.id} concluído.`);
            });

            this.worker.on('failed', (job, err) => {
                console.error(`Job ${job.id} falhou:`, err.message);
            });

            console.log('Fila BullMQ inicializada com sucesso.');
        } catch (error) {
            console.warn('Redis não disponível. Usando modo de fila simplificado (sem Redis).');
            // Fallback: processamento direto sem fila real
            this.queue = { add: this.addJobDirect.bind(this) };
        }
    }

    /**
     * Adiciona um job diretamente (fallback sem Redis).
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
     * Fecha conexões da fila.
     */
    async close() {
        if (this.worker) await this.worker.close();
        if (this.queue) await this.queue.close();
    }
}

module.exports = new QueueService();
