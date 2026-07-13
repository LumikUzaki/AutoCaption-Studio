const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { io } = require('../server');

/**
 * Service para gerenciar a ponte com Python
 * Responsável por executar scripts Python e retornar resultados
 */

class PythonBridgeService {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.enginesPath = path.join(__dirname, '../../../python/engines');
  }

  /**
   * Executa script Python de transcrição
   * @param {Object} options - Opções de transcrição
   * @returns {Promise<Object>} - Resultado da transcrição
   */
  async transcribe(options) {
    const { transcricaoId, videoPath, engine, model, device, language } = options;

    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.enginesPath, 'transcribe.py');
      
      const args = [
        scriptPath,
        '--transcricao-id', transcricaoId,
        '--video-path', videoPath,
        '--engine', engine,
        '--model', model,
        '--device', device,
        '--language', language
      ];

      console.log(`\n🐍 [PYTHON BRIDGE] Iniciando execução Python`);
      console.log(`   Script: ${scriptPath}`);
      console.log(`   Engine: ${engine}`);
      console.log(`   Modelo: ${model}`);
      console.log(`   Dispositivo: ${device}`);
      console.log(`   Idioma: ${language}`);
      console.log(`   Args: ${args.join(' ')}`);

      const pythonProcess = spawn(this.pythonPath, args);

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutData += output;
        console.log(`[PYTHON STDOUT] ${output.trim()}`);
        
        // Emitir progresso via WebSocket
        if (output.includes('Progresso:') || output.includes('%')) {
          const progressMatch = output.match(/(\d+)%/);
          if (progressMatch) {
            io.emit('progress-update', {
              transcricaoId,
              progress: parseInt(progressMatch[1]),
              message: output.trim()
            });
          }
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        stderrData += errorOutput;
        console.error(`[PYTHON STDERR] ${errorOutput.trim()}`);
        
        // Emitir erros via WebSocket
        io.emit('progress-update', {
          transcricaoId,
          progress: 0,
          message: `Erro: ${errorOutput.trim()}`,
          error: true
        });
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`\n✅ [PYTHON BRIDGE] Execução concluída com sucesso (código: ${code})`);
          
          // Tentar parsear JSON do output
          try {
            // Encontrar JSON no output (pode ter texto antes/depois)
            const jsonMatch = stdoutData.match(/\{[\s\S]*"segmentos"[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              resolve(result);
            } else {
              resolve({ raw: stdoutData });
            }
          } catch (e) {
            console.warn('[PYTHON BRIDGE] Não foi possível parsear JSON, retornando raw');
            resolve({ raw: stdoutData });
          }
        } else {
          console.error(`\n❌ [PYTHON BRIDGE] Execução falhou (código: ${code})`);
          reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`[PYTHON BRIDGE] Erro ao executar processo: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Verifica se Python está disponível
   * @returns {Promise<boolean>}
   */
  async checkPython() {
    return new Promise((resolve) => {
      const test = spawn(this.pythonPath, ['--version']);
      
      test.on('error', () => {
        resolve(false);
      });
      
      test.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }

  /**
   * Verifica se uma engine específica está instalada
   * @param {string} engineName - Nome da engine
   * @returns {Promise<boolean>}
   */
  async checkEngine(engineName) {
    const checks = {
      'faster-whisper': 'faster_whisper',
      'stable-ts': 'stable_whisper',
      'whisperx': 'whisperx'
    };

    const moduleName = checks[engineName];
    if (!moduleName) return false;

    return new Promise((resolve) => {
      const test = spawn(this.pythonPath, ['-c', `import ${moduleName}`]);
      
      test.on('error', () => {
        resolve(false);
      });
      
      test.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }
}

module.exports = new PythonBridgeService();
