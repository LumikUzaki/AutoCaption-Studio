/**
 * Translation Module - Gerenciamento de Tradução de Legendas
 * Suporte a múltiplos motores: Argos Translate, MarianMT, NLLB
 * Tradução em lote com progresso em tempo real
 */

import { store } from '../store/store.js';
import { api } from '../api/api.js';
import { socket } from '../socket/socket.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class TranslationManager extends EventEmitter {
  constructor() {
    super();
    
    this.supportedLanguages = [
      { code: 'en', name: 'Inglês', nativeName: 'English' },
      { code: 'es', name: 'Espanhol', nativeName: 'Español' },
      { code: 'fr', name: 'Francês', nativeName: 'Français' },
      { code: 'de', name: 'Alemão', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italiano', nativeName: 'Italiano' },
      { code: 'pt', name: 'Português', nativeName: 'Português' },
      { code: 'ru', name: 'Russo', nativeName: 'Русский' },
      { code: 'ja', name: 'Japonês', nativeName: '日本語' },
      { code: 'ko', name: 'Coreano', nativeName: '한국어' },
      { code: 'zh', name: 'Chinês', nativeName: '中文' },
      { code: 'ar', name: 'Árabe', nativeName: 'العربية' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'nl', name: 'Holandês', nativeName: 'Nederlands' },
      { code: 'pl', name: 'Polonês', nativeName: 'Polski' },
      { code: 'tr', name: 'Turco', nativeName: 'Türkçe' }
    ];

    this.translationEngines = [
      { id: 'argos', name: 'Argos Translate', description: 'Rápido e offline', recommended: true },
      { id: 'marian', name: 'MarianMT', description: 'Alta qualidade', recommended: false },
      { id: 'nllb', name: 'NLLB (Meta)', description: '200+ idiomas', recommended: false }
    ];

    this.currentJobId = null;
    this.isTranslating = false;

    this.init();
  }

  init() {
    this.setupSocketListeners();
    this.setupEventListeners();
  }

  setupSocketListeners() {
    socket.on('translation:progress', (data) => {
      this.emit('translation:progress', data);
      this.updateProgressUI(data);
    });

    socket.on('translation:completed', (data) => {
      this.isTranslating = false;
      this.currentJobId = null;
      this.emit('translation:completed', data);
      Toast.show('Tradução concluída com sucesso!', 'success');
      
      // Recarregar segmentos se estiver no editor
      if (window.location.hash.includes('/editor')) {
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('editor:refresh'));
        }, 500);
      }
    });

    socket.on('translation:failed', (data) => {
      this.isTranslating = false;
      this.currentJobId = null;
      this.emit('translation:failed', data);
      Toast.show(`Erro na tradução: ${data.error}`, 'error');
    });
  }

  setupEventListeners() {
    document.addEventListener('translation:show-modal', (e) => {
      this.showTranslationModal(e.detail?.videoId);
    });
  }

  async showTranslationModal(videoId) {
    const currentVideo = videoId 
      ? store.state.videos.list.find(v => v.id === videoId) || store.state.editor.currentVideo
      : store.state.editor.currentVideo;

    if (!currentVideo) {
      Toast.show('Nenhum vídeo selecionado', 'warning');
      return;
    }

    // Verificar se já existe tradução
    const hasTranslation = currentVideo.hasTranslatedTracks || 
                          store.state.editor.segments.some(s => s.translatedText);

    const modalContent = `
      <div class="translation-modal">
        <div class="modal-header">
          <h2><i class="fas fa-language"></i> Traduzir Legendas</h2>
          <p class="video-name">${currentVideo.name || currentVideo.filename}</p>
        </div>

        <div class="modal-body">
          ${hasTranslation ? `
            <div class="alert alert-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <p>Este vídeo já possui faixas traduzidas. A nova tradução será adicionada como uma faixa adicional.</p>
            </div>
          ` : ''}

          <div class="translation-settings">
            <div class="setting-group">
              <label>Idioma de Origem</label>
              <select id="translate-source-lang">
                <option value="auto">Detectar Automaticamente</option>
                ${this.supportedLanguages.map(lang => `
                  <option value="${lang.code}">${lang.name} (${lang.nativeName})</option>
                `).join('')}
              </select>
            </div>

            <div class="setting-group">
              <label>Idioma de Destino</label>
              <select id="translate-target-lang">
                ${this.supportedLanguages.map(lang => `
                  <option value="${lang.code}" ${lang.code === 'en' ? 'selected' : ''}>
                    ${lang.name} (${lang.nativeName})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="setting-group">
              <label>Motor de Tradução</label>
              <div class="engine-selector">
                ${this.translationEngines.map(engine => `
                  <div class="engine-card ${engine.recommended ? 'recommended' : ''}" data-engine="${engine.id}">
                    <div class="engine-info">
                      <h4>${engine.name}</h4>
                      <p>${engine.description}</p>
                    </div>
                    ${engine.recommended ? '<span class="badge badge-success">Recomendado</span>' : ''}
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="setting-group">
              <label>Opções Avançadas</label>
              <div class="advanced-options">
                <label class="checkbox-label">
                  <input type="checkbox" id="translate-keep-formatting" checked>
                  Manter formatação original
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="translate-preserve-names" checked>
                  Preservar nomes próprios
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="translate-review-mode">
                  Modo de revisão (não aplicar automaticamente)
                </label>
              </div>
            </div>
          </div>

          <div class="translation-preview">
            <h3>Exemplo de Tradução</h3>
            <div class="preview-comparison">
              <div class="preview-original">
                <strong>Original (PT)</strong>
                <p>Olá, bem-vindo ao nosso vídeo!</p>
              </div>
              <div class="preview-arrow">
                <i class="fas fa-arrow-right"></i>
              </div>
              <div class="preview-translated">
                <strong>Tradução (EN)</strong>
                <p>Hello, welcome to our video!</p>
              </div>
            </div>
          </div>

          <div class="translation-info">
            <i class="fas fa-info-circle"></i>
            <p>A tradução é processada localmente usando IA. O tempo varia conforme o tamanho das legendas.</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('modal:close'))">
            Cancelar
          </button>
          <button class="btn btn-primary" id="btn-translate">
            <i class="fas fa-language"></i> Iniciar Tradução
          </button>
        </div>
      </div>
    `;

    await Modal.showCustom(modalContent, { size: 'large' });

    // Setup engine selection
    const engineCards = document.querySelectorAll('.engine-card');
    let selectedEngine = 'argos';

    engineCards.forEach(card => {
      card.addEventListener('click', () => {
        engineCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedEngine = card.dataset.engine;
      });
    });

    // Select first engine by default
    if (engineCards.length > 0) {
      engineCards[0].classList.add('selected');
    }

    // Setup translate button
    const translateButton = document.getElementById('btn-translate');
    translateButton.addEventListener('click', async () => {
      const sourceLang = document.getElementById('translate-source-lang').value;
      const targetLang = document.getElementById('translate-target-lang').value;
      const keepFormatting = document.getElementById('translate-keep-formatting').checked;
      const preserveNames = document.getElementById('translate-preserve-names').checked;
      const reviewMode = document.getElementById('translate-review-mode').checked;

      if (sourceLang === targetLang && sourceLang !== 'auto') {
        Toast.show('Idiomas de origem e destino devem ser diferentes', 'warning');
        return;
      }

      const options = {
        sourceLang,
        targetLang,
        engine: selectedEngine,
        keepFormatting,
        preserveNames,
        reviewMode
      };

      await this.translate(currentVideo.id, options);
    });
  }

  async translate(videoId, options = {}) {
    try {
      if (this.isTranslating) {
        Toast.show('Uma tradução já está em andamento', 'warning');
        return;
      }

      const confirmed = await Modal.confirm(
        'Confirmar Tradução',
        `Traduzir legendas de ${options.sourceLang === 'auto' ? 'idioma detectado' : options.sourceLang} para ${options.targetLang}?`,
        'info'
      );

      if (!confirmed) return;

      this.isTranslating = true;
      Toast.show('Iniciando tradução...', 'info');

      const response = await api.translateSubtitles(videoId, options);

      if (response && response.jobId) {
        this.currentJobId = response.jobId;
        Toast.show('Tradução iniciada! Acompanhe o progresso.', 'success');
        this.emit('translation:started', { videoId, jobId: response.jobId, options });
        
        // Fechar modal
        document.dispatchEvent(new CustomEvent('modal:close'));
        
        // Mostrar modal de progresso
        this.showProgressModal(videoId, response.jobId);
      } else {
        throw new Error('Resposta inválida da API');
      }

    } catch (error) {
      console.error('Erro ao iniciar tradução:', error);
      Toast.show(`Erro na tradução: ${error.message}`, 'error');
      this.isTranslating = false;
      this.emit('translation:error', { videoId, error });
    }
  }

  showProgressModal(videoId, jobId) {
    const modalContent = `
      <div class="translation-progress-modal">
        <div class="modal-header">
          <h2><i class="fas fa-cog fa-spin"></i> Traduzindo...</h2>
        </div>

        <div class="modal-body">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" id="translation-progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">
              <span id="translation-progress-percent">0%</span>
              <span id="translation-progress-details">Iniciando...</span>
            </div>
          </div>

          <div class="progress-stats">
            <div class="stat">
              <span class="stat-label">Segmentos</span>
              <span class="stat-value" id="translation-progress-segments">0/0</span>
            </div>
            <div class="stat">
              <span class="stat-label">Tempo estimado</span>
              <span class="stat-value" id="translation-progress-time">--:--</span>
            </div>
            <div class="stat">
              <span class="stat-label">Velocidade</span>
              <span class="stat-value" id="translation-progress-speed">-- seg/s</span>
            </div>
          </div>

          <div class="progress-log" id="translation-progress-log">
            <p>Aguardando início do processamento...</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('modal:close'))">
            Fechar
          </button>
          <button class="btn btn-danger" id="btn-cancel-translation">
            <i class="fas fa-stop"></i> Cancelar
          </button>
        </div>
      </div>
    `;

    Modal.showCustom(modalContent, { size: 'medium', closable: false });

    // Setup cancel button
    const cancelButton = document.getElementById('btn-cancel-translation');
    cancelButton.addEventListener('click', async () => {
      const confirmed = await Modal.confirm(
        'Cancelar Tradução',
        'Tem certeza que deseja cancelar a tradução em andamento?',
        'warning'
      );

      if (confirmed) {
        await this.cancelTranslation(jobId);
      }
    });
  }

  updateProgressUI(data) {
    const progressFill = document.getElementById('translation-progress-fill');
    const progressPercent = document.getElementById('translation-progress-percent');
    const progressDetails = document.getElementById('translation-progress-details');
    const progressSegments = document.getElementById('translation-progress-segments');
    const progressTime = document.getElementById('translation-progress-time');
    const progressSpeed = document.getElementById('translation-progress-speed');
    const progressLog = document.getElementById('translation-progress-log');

    if (progressFill && data.percent !== undefined) {
      progressFill.style.width = `${data.percent}%`;
    }

    if (progressPercent && data.percent !== undefined) {
      progressPercent.textContent = `${Math.round(data.percent)}%`;
    }

    if (progressDetails && data.status) {
      progressDetails.textContent = data.status;
    }

    if (progressSegments && data.processed !== undefined && data.total !== undefined) {
      progressSegments.textContent = `${data.processed}/${data.total}`;
    }

    if (progressTime && data.estimatedTime) {
      progressTime.textContent = this.formatTime(data.estimatedTime);
    }

    if (progressSpeed && data.speed) {
      progressSpeed.textContent = `${data.speed.toFixed(1)} seg/s`;
    }

    if (progressLog && data.log) {
      const logEntry = document.createElement('p');
      logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${data.log}`;
      progressLog.appendChild(logEntry);
      progressLog.scrollTop = progressLog.scrollHeight;
    }
  }

  async cancelTranslation(jobId) {
    try {
      await api.cancelJob(jobId);
      this.isTranslating = false;
      this.currentJobId = null;
      Toast.show('Tradução cancelada', 'info');
      this.emit('translation:cancelled', { jobId });
      
      document.dispatchEvent(new CustomEvent('modal:close'));
    } catch (error) {
      console.error('Erro ao cancelar tradução:', error);
      Toast.show('Erro ao cancelar tradução', 'error');
    }
  }

  formatTime(seconds) {
    if (!seconds || seconds < 0) return '--:--';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getLanguageInfo(code) {
    return this.supportedLanguages.find(lang => lang.code === code);
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  getTranslationEngines() {
    return this.translationEngines;
  }

  isTranslationInProgress() {
    return this.isTranslating;
  }

  getCurrentJobId() {
    return this.currentJobId;
  }
}

// Exportar instância singleton
export const translationManager = new TranslationManager();
