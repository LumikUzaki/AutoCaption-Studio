const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../models/database');

/**
 * Ponte de comunicação com os scripts Python das engines de Whisper.
 * Executa o script transcribe.py passando os parâmetros necessários.
 */
class WhisperBridge {
    constructor() {
        this.pythonScript = path.join(__dirname, '../../python/scripts/transcribe.py');
        this.pythonEnv = process.env.VIRTUAL_ENV || process.env.CONDA_PREFIX || '/usr';
    }

    /**
     * Executa a transcrição usando a engine Python especificada.
     * @param {string} videoPath - Caminho absoluto do arquivo de vídeo/áudio.
     * @param {string} engine - Nome da engine ('faster-whisper', 'stable-ts', 'whisperx').
     * @param {string} model - Nome do modelo Whisper.
     * @param {string} language - Código do idioma (ex: 'pt', 'en').
     * @param {string} deviceId - Dispositivo ('cuda' ou 'cpu').
     * @param {number} jobId - ID do job no banco de dados para atualizar progresso.
     * @param {Function} onProgress - Callback para atualizações de progresso em tempo real.
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async transcrever({ videoPath, engine, model, language, deviceId, jobId, onProgress }) {
        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScript,
                '--video', videoPath,
                '--engine', engine,
                '--model', model,
                '--language', language,
                '--device', deviceId,
                '--job-id', jobId.toString()
            ];

            // Adiciona flags específicas para whisperx
            if (engine === 'whisperx') {
                args.push('--align', '--vad-filter', '--normalize');
            }

            // Adiciona flags específicas para stable-ts (word-level timestamps)
            if (engine === 'stable-ts') {
                args.push('--word-timestamps');
            }

            console.log(`Executando Python: python3 ${args.join(' ')}`);

            const pythonProcess = spawn('python3', args, {
                env: { ...process.env, PYTHONUNBUFFERED: '1' }
            });

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                outputData += line + '\n';
                console.log(`[Python STDOUT] ${line}`);

                // Tenta parsear progresso se houver callback
                if (onProgress && line.includes('PROGRESS:')) {
                    const progressMatch = line.match(/PROGRESS:\s*([\d.]+)/);
                    if (progressMatch) {
                        const progress = parseFloat(progressMatch[1]);
                        onProgress(jobId, progress, line);
                    }
                }

                // Tenta parsear resultado JSON final
                if (line.startsWith('RESULT_JSON:')) {
                    try {
                        const jsonStr = line.replace('RESULT_JSON:', '').trim();
                        const result = JSON.parse(jsonStr);
                        resolve({ success: true, data: result });
                    } catch (e) {
                        console.error('Erro ao parsear JSON do Python:', e);
                    }
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                const line = data.toString().trim();
                errorData += line + '\n';
                console.error(`[Python STDERR] ${line}`);

                // Atualiza mensagem de erro no job
                if (onProgress && (line.includes('Error') || line.includes('Exception'))) {
                    onProgress(jobId, 0, `Erro: ${line}`, true);
                }
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Se não recebeu JSON via stdout, tenta ler do arquivo de saída
                    const outputPath = videoPath.replace(/\.[^/.]+$/, '.json');
                    if (fs.existsSync(outputPath)) {
                        try {
                            const content = fs.readFileSync(outputPath, 'utf-8');
                            const result = JSON.parse(content);
                            resolve({ success: true, data: result });
                        } catch (e) {
                            resolve({ success: false, error: 'Erro ao ler arquivo de resultado JSON.' });
                        }
                    } else {
                        resolve({ success: false, error: 'Processo concluído sem arquivo de resultado.' });
                    }
                } else {
                    resolve({ 
                        success: false, 
                        error: `Processo Python falhou com código ${code}. Detalhes: ${errorData.substring(0, 500)}` 
                    });
                }
            });

            pythonProcess.on('error', (err) => {
                reject({ success: false, error: `Falha ao iniciar processo Python: ${err.message}` });
            });
        });
    }
}

module.exports = new WhisperBridge();
