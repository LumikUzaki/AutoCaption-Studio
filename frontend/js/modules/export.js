/**
 * Export Module - Gerenciamento de Exportação de Legendas e Vídeos
 * Formatos suportados: SRT, VTT, ASS, SSA, TXT, JSON, CSV
 * Renderização de hardsub via FFmpeg
 */

import { store } from '../store/store.js';
import { api } from '../api/api.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { formatTime, downloadFile } from '../utils/utils.js';

export class ExportManager extends EventEmitter {
  constructor() {
    super();
    this.exportFormats = [
      { id: 'srt', name: 'SRT', description: 'SubRip (mais compatível)', icon: 'fas fa-file-lines' },
      { id: 'vtt', name: 'VTT', description: 'WebVTT (para web)', icon: 'fas fa-globe' },
      { id: 'ass', name: 'ASS', description: 'Advanced SubStation Alpha', icon: 'fas fa-font' },
      { id: 'ssa', name: 'SSA', description: 'SubStation Alpha', icon: 'fas fa-text-height' },
      { id: 'txt', name: 'TXT', description: 'Texto simples', icon: 'fas fa-file-alt' },
      { id: 'json', name: 'JSON', description: 'Dados estruturados', icon: 'fas fa-code' },
      { id: 'csv', name: 'CSV', description: 'Planilha', icon: 'fas fa-table' }
    ];

    this.renderOptions = {
      fonts: [
        { id: 'Arial', name: 'Arial' },
        { id: 'Helvetica', name: 'Helvetica' },
        { id: 'Times New Roman', name: 'Times New Roman' },
        { id: 'Courier New', name: 'Courier New' },
        { id: 'Verdana', name: 'Verdana' },
        { id: 'Georgia', name: 'Georgia' },
        { id: 'Trebuchet MS', name: 'Trebuchet MS' }
      ],
      sizes: [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48],
      colors: [
        { id: '#ffffff', name: 'Branco' },
        { id: '#ffff00', name: 'Amarelo' },
        { id: '#00ff00', name: 'Verde' },
        { id: '#00ffff', name: 'Ciano' },
        { id: '#ff0000', name: 'Vermelho' },
        { id: '#ffa500', name: 'Laranja' }
      ],
      positions: [
        { id: 'bottom', name: 'Inferior' },
        { id: 'middle', name: 'Meio' },
        { id: 'top', name: 'Superior' }
      ]
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('export:show-modal', (e) => {
      this.showExportModal(e.detail?.videoId);
    });

    document.addEventListener('render:show-modal', (e) => {
      this.showRenderModal(e.detail?.videoId);
    });
  }

  async showExportModal(videoId) {
    const currentVideo = videoId 
      ? store.state.videos.list.find(v => v.id === videoId) || store.state.editor.currentVideo
      : store.state.editor.currentVideo;

    if (!currentVideo) {
      Toast.show('Nenhum vídeo selecionado', 'warning');
      return;
    }

    const modalContent = `
      <div class="export-modal">
        <div class="modal-header">
          <h2><i class="fas fa-download"></i> Exportar Legenda</h2>
          <p class="video-name">${currentVideo.name || currentVideo.filename}</p>
        </div>

        <div class="modal-body">
          <div class="export-formats">
            <h3>Selecione o Formato</h3>
            <div class="formats-grid">
              ${this.exportFormats.map(format => `
                <div class="format-card" data-format="${format.id}">
                  <i class="${format.icon}"></i>
                  <span class="format-name">${format.name}</span>
                  <span class="format-desc">${format.description}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="export-options" id="export-options" style="display: none;">
            <h3>Opções de Exportação</h3>
            
            <div class="option-group">
              <label>Faixa de Legenda</label>
              <select id="export-track">
                <option value="original">Original</option>
                <option value="translated">Traduzida</option>
              </select>
            </div>

            <div class="option-group">
              <label>Codificação</label>
              <select id="export-encoding">
                <option value="utf-8">UTF-8</option>
                <option value="iso-8859-1">ISO-8859-1 (Windows)</option>
              </select>
            </div>

            <div class="option-group">
              <label>
                <input type="checkbox" id="export-include-metadata" checked>
                Incluir metadados (quando suportado)
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('modal:close'))">
            Cancelar
          </button>
          <button class="btn btn-primary" id="btn-export" disabled>
            <i class="fas fa-download"></i> Exportar
          </button>
        </div>
      </div>
    `;

    await Modal.showCustom(modalContent, { size: 'large' });

    // Setup event listeners
    const formatCards = document.querySelectorAll('.format-card');
    const exportOptions = document.getElementById('export-options');
    const exportButton = document.getElementById('btn-export');
    let selectedFormat = null;

    formatCards.forEach(card => {
      card.addEventListener('click', () => {
        formatCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedFormat = card.dataset.format;
        exportOptions.style.display = 'block';
        exportButton.disabled = false;
      });
    });

    exportButton.addEventListener('click', async () => {
      if (!selectedFormat) return;

      const options = {
        track: document.getElementById('export-track').value,
        encoding: document.getElementById('export-encoding').value,
        includeMetadata: document.getElementById('export-include-metadata').checked
      };

      await this.exportSubtitle(currentVideo.id, selectedFormat, options);
    });
  }

  async showRenderModal(videoId) {
    const currentVideo = videoId 
      ? store.state.videos.list.find(v => v.id === videoId) || store.state.editor.currentVideo
      : store.state.editor.currentVideo;

    if (!currentVideo) {
      Toast.show('Nenhum vídeo selecionado', 'warning');
      return;
    }

    const modalContent = `
      <div class="render-modal">
        <div class="modal-header">
          <h2><i class="fas fa-film"></i> Renderizar Vídeo com Legendas (Hardsub)</h2>
          <p class="video-name">${currentVideo.name || currentVideo.filename}</p>
        </div>

        <div class="modal-body">
          <div class="render-settings">
            <div class="setting-row">
              <label>Faixa de Legenda</label>
              <select id="render-track">
                <option value="original">Original</option>
                <option value="translated">Traduzida</option>
              </select>
            </div>

            <div class="setting-row">
              <label>Fonte</label>
              <select id="render-font">
                ${this.renderOptions.fonts.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
              </select>
            </div>

            <div class="setting-row">
              <label>Tamanho</label>
              <select id="render-size">
                ${this.renderOptions.sizes.map(s => `<option value="${s}" ${s === 24 ? 'selected' : ''}>${s}px</option>`).join('')}
              </select>
            </div>

            <div class="setting-row">
              <label>Cor</label>
              <select id="render-color">
                ${this.renderOptions.colors.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>

            <div class="setting-row">
              <label>Posição</label>
              <select id="render-position">
                ${this.renderOptions.positions.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>

            <div class="setting-row">
              <label>Qualidade do Vídeo</label>
              <select id="render-quality">
                <option value="high">Alta (CRF 18)</option>
                <option value="medium" selected>Média (CRF 23)</option>
                <option value="low">Baixa (CRF 28)</option>
              </select>
            </div>

            <div class="setting-row">
              <label>
                <input type="checkbox" id="render-keep-audio" checked>
                Manter áudio original
              </label>
            </div>

            <div class="setting-row">
              <label>
                <input type="checkbox" id="render-add-shadow" checked>
                Adicionar sombra ao texto
              </label>
            </div>
          </div>

          <div class="render-preview">
            <h3>Prévia das Configurações</h3>
            <div class="preview-box">
              <div class="preview-video-placeholder">
                <i class="fas fa-film"></i>
                <p>Vídeo será renderizado com as configurações acima</p>
              </div>
              <div class="preview-subtitle">Exemplo de legenda renderizada</div>
            </div>
          </div>

          <div class="render-info">
            <i class="fas fa-info-circle"></i>
            <p>A renderização pode levar vários minutos dependendo do tamanho do vídeo.</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('modal:close'))">
            Cancelar
          </button>
          <button class="btn btn-primary" id="btn-render">
            <i class="fas fa-play"></i> Iniciar Renderização
          </button>
        </div>
      </div>
    `;

    await Modal.showCustom(modalContent, { size: 'large' });

    // Setup render button
    const renderButton = document.getElementById('btn-render');
    renderButton.addEventListener('click', async () => {
      const options = {
        track: document.getElementById('render-track').value,
        font: document.getElementById('render-font').value,
        size: parseInt(document.getElementById('render-size').value),
        color: document.getElementById('render-color').value,
        position: document.getElementById('render-position').value,
        quality: document.getElementById('render-quality').value,
        keepAudio: document.getElementById('render-keep-audio').checked,
        addShadow: document.getElementById('render-add-shadow').checked
      };

      await this.renderVideo(currentVideo.id, options);
    });
  }

  async exportSubtitle(videoId, format, options = {}) {
    try {
      Toast.show(`Preparando exportação ${format.toUpperCase()}...`, 'info');

      const response = await api.exportSubtitle(videoId, format, options);

      if (response && response.url) {
        // Download automático
        downloadFile(response.url, `${videoId}-legendas.${format}`);
        
        Toast.show(`Legenda exportada com sucesso!`, 'success');
        this.emit('subtitle:exported', { videoId, format, url: response.url });
      } else {
        throw new Error('Resposta inválida da API');
      }

    } catch (error) {
      console.error('Erro ao exportar legenda:', error);
      Toast.show(`Erro na exportação: ${error.message}`, 'error');
      this.emit('export:error', { videoId, format, error });
    }
  }

  async renderVideo(videoId, options = {}) {
    try {
      const confirmed = await Modal.confirm(
        'Confirmar Renderização',
        `A renderização pode levar vários minutos. Deseja continuar?`,
        'info'
      );

      if (!confirmed) return;

      Toast.show('Iniciando renderização...', 'info');

      const response = await api.renderVideo(videoId, options);

      if (response && response.jobId) {
        Toast.show('Renderização iniciada! Acompanhe na fila.', 'success');
        this.emit('render:started', { videoId, jobId: response.jobId, options });
        
        // Fechar modal
        document.dispatchEvent(new CustomEvent('modal:close'));
        
        // Redirecionar para fila se necessário
        setTimeout(() => {
          window.location.hash = '#/queue';
        }, 1000);
      } else {
        throw new Error('Resposta inválida da API');
      }

    } catch (error) {
      console.error('Erro ao iniciar renderização:', error);
      Toast.show(`Erro na renderização: ${error.message}`, 'error');
      this.emit('render:error', { videoId, error });
    }
  }

  async exportAllFormats(videoId) {
    try {
      Toast.show('Exportando todos os formatos...', 'info');

      const promises = this.exportFormats.map(async (format) => {
        try {
          return await this.exportSubtitle(videoId, format.id);
        } catch (error) {
          console.error(`Erro ao exportar ${format.id}:`, error);
          return { error, format: format.id };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => !r.error).length;

      Toast.show(`${successCount}/${results.length} formatos exportados com sucesso`, 'success');
      this.emit('export:all-completed', { videoId, results });

    } catch (error) {
      console.error('Erro ao exportar todos os formatos:', error);
      Toast.show('Erro na exportação em massa', 'error');
    }
  }

  generatePreviewText(segment) {
    if (!segment) return 'Legenda de exemplo';
    
    const text = segment.text || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  getFormatInfo(formatId) {
    return this.exportFormats.find(f => f.id === formatId);
  }

  isFormatSupported(formatId) {
    return this.exportFormats.some(f => f.id === formatId);
  }
}

// Exportar instância singleton
export const exportManager = new ExportManager();
