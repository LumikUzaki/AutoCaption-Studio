/**
 * Página: Configurações
 */

import { getConfiguracoes, saveConfiguracoes } from '../api.js';

export default {
    render() {
        return `
            <div class="card" style="max-width: 600px;">
                <h3>Configurações da Aplicação</h3>
                <p class="text-muted mb-2">Ajuste as preferências padrão para transcrições.</p>
                
                <form id="config-form">
                    <div class="form-group">
                        <label for="cfg-engine">Engine Padrão</label>
                        <select id="cfg-engine" name="engine" class="form-control">
                            <option value="stable-ts">Stable TS (Recomendado)</option>
                            <option value="faster-whisper">Faster Whisper</option>
                            <option value="whisperx">WhisperX</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="cfg-model">Modelo Padrão</label>
                        <select id="cfg-model" name="model" class="form-control">
                            <option value="tiny">Tiny (Mais rápido, menos preciso)</option>
                            <option value="base">Base</option>
                            <option value="small">Small</option>
                            <option value="medium">Medium (Equilibrado)</option>
                            <option value="large-v3">Large v3 (Mais preciso, mais lento)</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="cfg-language">Idioma Padrão</label>
                        <select id="cfg-language" name="language" class="form-control">
                            <option value="">Detectar Automaticamente</option>
                            <option value="pt">Português</option>
                            <option value="en">Inglês</option>
                            <option value="es">Espanhol</option>
                            <option value="fr">Francês</option>
                            <option value="de">Alemão</option>
                            <option value="it">Italiano</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="cfg-device">Dispositivo</label>
                        <select id="cfg-device" name="device" class="form-control">
                            <option value="cuda">GPU (CUDA)</option>
                            <option value="cpu">CPU</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="cfg-word-timestamps" name="wordTimestamps">
                            Habilitar timestamps de nível de palavra
                        </label>
                    </div>
                    
                    <button type="submit" class="btn btn-primary mt-2">
                        <i class="ph ph-floppy-disk"></i> Salvar Configurações
                    </button>
                </form>
            </div>
        `;
    },

    async init() {
        await loadConfig();
        
        const form = document.getElementById('config-form');
        if (form) {
            form.addEventListener('submit', handleSave);
        }
    }
};

async function loadConfig() {
    try {
        const config = await getConfiguracoes();
        
        if (config.engine) {
            document.getElementById('cfg-engine').value = config.engine;
        }
        if (config.model) {
            document.getElementById('cfg-model').value = config.model;
        }
        if (config.language) {
            document.getElementById('cfg-language').value = config.language;
        }
        if (config.device) {
            document.getElementById('cfg-device').value = config.device;
        }
        if (config.wordTimestamps !== undefined) {
            document.getElementById('cfg-word-timestamps').checked = config.wordTimestamps;
        }
    } catch (err) {
        window.showNotification('Erro ao carregar configurações: ' + err.message, 'error');
    }
}

async function handleSave(e) {
    e.preventDefault();
    
    const config = {
        engine: document.getElementById('cfg-engine').value,
        model: document.getElementById('cfg-model').value,
        language: document.getElementById('cfg-language').value,
        device: document.getElementById('cfg-device').value,
        wordTimestamps: document.getElementById('cfg-word-timestamps').checked
    };
    
    try {
        await saveConfiguracoes(config);
        window.showNotification('Configurações salvas com sucesso!', 'success');
    } catch (err) {
        window.showNotification('Erro ao salvar: ' + err.message, 'error');
    }
}
