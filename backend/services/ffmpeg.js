const { spawn } = require('child_process');
const path = require('path');

/**
 * Service para operações com FFmpeg.
 * Usado para extrair áudio, obter duração e converter formatos.
 */
class FFmpegService {

    /**
     * Obtém a duração de um arquivo de vídeo/áudio em segundos.
     * @param {string} filePath - Caminho do arquivo.
     * @returns {Promise<number>} Duração em segundos.
     */
    async getDuration(filePath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', filePath,
                '-f', 'null', '-'
            ];

            const ffmpeg = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format', '-show_streams',
                filePath
            ]);
            
            let stdout = '';
            ffmpeg.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    try {
                        const parsed = JSON.parse(stdout);
                        const duration = parseFloat(parsed.format.duration);
                        resolve(duration);
                    } catch (e) {
                        reject(new Error('Não foi possível determinar a duração do vídeo.'));
                    }
                } else {
                    reject(new Error(`ffprobe falhou com código ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Extrai o áudio de um vídeo para processamento com otimizações.
     * @param {string} videoPath - Caminho do vídeo.
     * @param {string} outputPath - Caminho de saída do áudio.
     * @returns {Promise<void>}
     */
    async extractAudio(videoPath, outputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', videoPath,
                '-vn',  // Sem vídeo
                '-acodec', 'pcm_s16le',  // PCM para melhor qualidade
                '-ar', '16000',  // Sample rate do Whisper
                '-ac', '1',  // Mono
                '-threads', '0',  // Auto threads
                '-y',  // Sobrescrever
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg falhou com código ${code}: ${stderr.substring(0, 200)}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Extrai áudio com progresso em tempo real.
     * @param {string} videoPath - Caminho do vídeo.
     * @param {string} outputPath - Caminho de saída do áudio.
     * @param {Function} onProgress - Callback de progresso (0-100).
     * @returns {Promise<void>}
     */
    async extractAudioWithProgress(videoPath, outputPath, onProgress) {
        return new Promise(async (resolve, reject) => {
            try {
                // Primeiro obtém a duração total
                const duration = await this.getDuration(videoPath);
                
                const args = [
                    '-i', videoPath,
                    '-vn',
                    '-acodec', 'pcm_s16le',
                    '-ar', '16000',
                    '-ac', '1',
                    '-threads', '0',
                    '-y',
                    outputPath
                ];

                const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

                let stderr = '';
                const timeRegex = /time=(\d+):(\d+):(\d+)\.(\d+)/;

                ffmpeg.stderr.on('data', (data) => {
                    const str = data.toString();
                    stderr += str;
                    
                    const match = str.match(timeRegex);
                    if (match && onProgress) {
                        const currentTime = 
                            parseInt(match[1]) * 3600 + 
                            parseInt(match[2]) * 60 + 
                            parseInt(match[3]) + 
                            parseInt(match[4]) / 100;
                        const progress = Math.min(100, Math.round((currentTime / duration) * 100));
                        onProgress(progress);
                    }
                });

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        if (onProgress) onProgress(100);
                        resolve();
                    } else {
                        reject(new Error(`FFmpeg falhou: ${stderr.substring(0, 200)}`));
                    }
                });

                ffmpeg.on('error', (err) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = new FFmpegService();
