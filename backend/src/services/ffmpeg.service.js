const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Service para gerenciar operações com FFmpeg
 * Responsável por conversão de áudio, extração e renderização
 */

class FFmpegService {
  constructor() {
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Criar diretório temp se não existir
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Converte vídeo/áudio para WAV (necessário para engines Whisper)
   * @param {string} inputPath - Caminho do arquivo de entrada
   * @param {string} outputId - ID para nomear arquivo de saída
   * @returns {Promise<string>} - Caminho do arquivo WAV gerado
   */
  async convertToWav(inputPath, outputId) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `${outputId}.wav`);
      
      // Se já existe, reutilizar
      if (fs.existsSync(outputPath)) {
        console.log(`[FFMPEG] Arquivo WAV já existe: ${outputPath}`);
        resolve(outputPath);
        return;
      }

      const command = `"${this.ffmpegPath}" -i "${inputPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputPath}" -y`;
      
      console.log(`\n🎬 [FFMPEG] Convertendo para WAV:`);
      console.log(`   Entrada: ${inputPath}`);
      console.log(`   Saída: ${outputPath}`);
      console.log(`   Comando: ${command}`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[FFMPEG] Erro na conversão: ${error.message}`);
          console.error(`[FFMPEG] STDERR: ${stderr}`);
          reject(new Error(`FFmpeg error: ${stderr || error.message}`));
          return;
        }

        console.log(`✅ [FFMPEG] Conversão concluída: ${outputPath}`);
        resolve(outputPath);
      });
    });
  }

  /**
   * Extrai informações do vídeo (duração, codec, etc)
   * @param {string} videoPath - Caminho do vídeo
   * @returns {Promise<Object>} - Informações do vídeo
   */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      const command = `"${this.ffmpegPath}" -i "${videoPath}" -print_format json -show_format -show_streams -hide_banner`;

      exec(command, (error, stdout, stderr) => {
        // FFmpeg envia info para stderr
        const infoOutput = stderr;
        
        try {
          // Tentar extrair JSON se disponível
          const jsonMatch = infoOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const info = JSON.parse(jsonMatch[0]);
            resolve(info);
          } else {
            // Parse manual básico
            const durationMatch = infoOutput.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            if (durationMatch) {
              const hours = parseInt(durationMatch[1]);
              const minutes = parseInt(durationMatch[2]);
              const seconds = parseFloat(durationMatch[3]);
              resolve({
                duration: hours * 3600 + minutes * 60 + seconds
              });
            } else {
              resolve({});
            }
          }
        } catch (e) {
          resolve({});
        }
      });
    });
  }

  /**
   * Renderiza legenda no vídeo (hardsub)
   * @param {string} videoPath - Caminho do vídeo original
   * @param {string} subtitlePath - Caminho do arquivo de legenda
   * @param {string} outputPath - Caminho de saída
   * @returns {Promise<string>} - Caminho do vídeo renderizado
   */
  async hardsub(videoPath, subtitlePath, outputPath) {
    return new Promise((resolve, reject) => {
      // Escapar caminho para FFmpeg
      const escapedSubtitlePath = subtitlePath.replace(/:/g, '\\:').replace(/'/g, "'\\''");
      
      const command = `"${this.ffmpegPath}" -i "${videoPath}" -vf "subtitles='${escapedSubtitlePath}'" "${outputPath}" -y`;
      
      console.log(`\n🎬 [FFMPEG] Renderizando hardsub:`);
      console.log(`   Vídeo: ${videoPath}`);
      console.log(`   Legenda: ${subtitlePath}`);
      console.log(`   Saída: ${outputPath}`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`[FFMPEG] Erro na renderização: ${error.message}`);
          reject(new Error(`FFmpeg error: ${stderr || error.message}`));
          return;
        }

        console.log(`✅ [FFMPEG] Hardsub concluído: ${outputPath}`);
        resolve(outputPath);
      });
    });
  }

  /**
   * Verifica se FFmpeg está disponível
   * @returns {Promise<boolean>}
   */
  async checkFFmpeg() {
    return new Promise((resolve) => {
      exec(`${this.ffmpegPath} -version`, (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Limpa arquivos temporários
   */
  cleanupTempFiles() {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`[FFMPEG] Arquivo temporário removido: ${file}`);
        } catch (e) {
          console.warn(`[FFMPEG] Não foi possível remover: ${file}`);
        }
      });
    }
  }
}

module.exports = new FFmpegService();
