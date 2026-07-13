/**
 * Página: Upload de Vídeo
 */

import { startTranscription, getConfiguracoes } from '../api.js';

export default {
    render() {
        return `
            <div class="card">
                <h3>Upload de Novo Vídeo</h3>
                <p class="text-muted mb-2">Selecione um arquivo de vídeo para transcrição automática.</p>
                
                <form id="upload-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="video-file">Arquivo de Vídeo</label>
                        <input type="file" id="video-file" name="video" accept="video/*" required class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label for="engine-select">Engine de Transcrição</label>
                        <select id="engine-select" name="engine" class="form-control">
                            <option value="stable-ts">Stable TS (Recomendado)</option>
                            <option value="faster-whisper">Faster Whisper</option>
                            <option value="whisperx">WhisperX</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="model-select">Modelo</label>
                        <select id="model-select" name="model" class="form-control">
                            <option value="tiny">Tiny</option>
                            <option value="base">Base</option>
                            <option value="small">Small</option>
                            <option value="medium" selected>Medium</option>
                            <option value="large-v3">Large v3</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="language-select">Idioma (Opcional)</label>
                        <select id="language-select" name="language" class="form-control">
                            <option value="">Detectar Automaticamente</option>
                            <option value="pt">Português</option>
                            <option value="en">Inglês</option>
                            <option value="es">Espanhol</option>
                            <option value="fr">Francês</option>
                            <option value="de">Alemão</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-primary mt-2">
                        <i class="ph ph-upload-simple"></i> Iniciar Transcrição
                    </button>
                </form>
            </div>
            
            <div id="upload-progress" class="card mt-2 hidden">
                <h4>Processando...</h4>
                <div class="progress-bar" style="background:var(--bg-hover); border-radius:8px; height:20px; overflow:hidden;">
                    <div id="progress-fill" style="background:var(--primary); height:100%; width:0%; transition:width 0.3s;"></div>
                </div>
                <p id="progress-text" class="text-muted mt-2">Aguardando início...</p>
            </div>
        `;
    },

    init() {
        const form = document.getElementById('upload-form');
        if (form) {
            form.addEventListener('submit', handleUpload);
        }

        // Carrega configurações salvas
        loadSavedConfig();
    }
};

async function loadSavedConfig() {
    try {
        const config = await getConfiguracoes();
        if (config.engine) {
            document.getElementById('engine-select').value = config.engine;
        }
        if (config.model) {
            document.getElementById('model-select').value = config.model;
        }
        if (config.language) {
            document.getElementById('language-select').value = config.language;
        }
    } catch (err) {
        console.log('Não foi possível carregar configurações salvas');
    }
}

async function handleUpload(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const progressDiv = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    progressDiv.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = 'Enviando arquivo...';

    try {
        const result = await startTranscription(formData);
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Upload concluído! Processamento iniciado.';
        
        window.showNotification('Transcrição iniciada com sucesso!', 'success');
        
        // Redireciona para página de processamento após breve delay
        setTimeout(() => {
            if (window.navigateToPage) {
                window.navigateToPage('processamento', result.jobId);
            } else {
                window.location.hash = `#processamento/${result.jobId}`;
            }
        }, 1500);
        
    } catch (err) {
        progressText.textContent = `Erro: ${err.message}`;
        progressFill.style.background = 'var(--danger)';
        window.showNotification(err.message, 'error');
    }
}
