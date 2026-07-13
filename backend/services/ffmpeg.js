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

            const ffmpeg = spawn('ffmpeg', args, { stderr: 'pipe' });
            
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', () => {
                const durationMatch = stderr.match(/Duration:\s*([\d:.]+),/);
                if (durationMatch) {
                    const timeParts = durationMatch[1].split(':').map(Number);
                    const duration = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                    resolve(duration);
                } else {
                    reject(new Error('Não foi possível determinar a duração do vídeo.'));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Extrai o áudio de um vídeo para processamento.
     * @param {string} videoPath - Caminho do vídeo.
     * @param {string} outputPath - Caminho de saída do áudio.
     * @returns {Promise<void>}
     */
    async extractAudio(videoPath, outputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', videoPath,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-y',
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg falhou com código ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }
}

module.exports = new FFmpegService();
