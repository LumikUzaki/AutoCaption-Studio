/**
 * Video Card Component - Cartão de vídeo para dashboard
 * Componente reutilizável para exibir informações de vídeo
 */

import { createElement } from '../utils.js';
import { formatFileSize, formatDate, formatDuration } from '../utils.js';

export class VideoCardComponent {
  constructor(video, options = {}) {
    this.video = video;
    this.options = {
      onOpen: options.onOpen || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onExport: options.onExport || (() => {}),
      showActions: options.showActions !== false
    };
  }

  /**
   * Renderiza o cartão de vídeo
   * @returns {HTMLElement} Elemento do cartão
   */
  render() {
    const statusClass = this.getStatusClass(this.video.status);
    const statusText = this.getStatusText(this.video.status);
    
    const card = createElement('div', {
      className: `video-card ${statusClass}`,
      dataset: { id: this.video.id }
    }, [
      // Thumbnail ou placeholder
      createElement('div', { className: 'video-card-thumbnail' }, [
        this.video.thumbnailUrl 
          ? createElement('img', { 
              src: this.video.thumbnailUrl, 
              alt: this.video.name,
              loading: 'lazy'
            })
          : createElement('div', { className: 'video-card-placeholder' }, [
              createElement('span', { className: 'video-card-icon' }, ['🎬'])
            ])
      ]),
      
      // Conteúdo
      createElement('div', { className: 'video-card-content' }, [
        // Título
        createElement('h3', { 
          className: 'video-card-title',
          title: this.video.name
        }, [this.video.name]),
        
        // Metadados
        createElement('div', { className: 'video-card-meta' }, [
          createElement('span', { className: 'video-card-duration' }, [
            formatDuration(this.video.duration)
          ]),
          createElement('span', { className: 'video-card-size' }, [
            formatFileSize(this.video.size)
          ])
        ]),
        
        // Status
        createElement('div', { className: 'video-card-status' }, [
          createElement('span', { className: `status-badge ${statusClass}` }, [
            statusText
          ])
        ]),
        
        // Data
        createElement('div', { className: 'video-card-date' }, [
          formatDate(this.video.createdAt)
        ]),
        
        // Ações
        this.options.showActions ? createElement('div', { className: 'video-card-actions' }, [
          createElement('button', {
            className: 'btn btn-primary btn-sm',
            onClick: () => this.options.onOpen(this.video),
            title: 'Abrir editor',
            disabled: this.video.status !== 'completed'
          }, ['Editar']),
          
          createElement('button', {
            className: 'btn btn-secondary btn-sm',
            onClick: () => this.options.onExport(this.video),
            title: 'Exportar legenda',
            disabled: this.video.status !== 'completed'
          }, ['Exportar']),
          
          createElement('button', {
            className: 'btn btn-danger btn-sm',
            onClick: () => this.handleDelete(),
            title: 'Excluir vídeo'
          }, ['Excluir'])
        ]) : null
      ]),
      
      // Barra de progresso (se estiver processando)
      this.video.progress !== undefined && this.video.status === 'processing'
        ? createElement('div', { className: 'video-card-progress' }, [
            createElement('div', { className: 'progress-bar' }, [
              createElement('div', { 
                className: 'progress-bar-fill',
                style: `width: ${this.video.progress}%`
              }),
              createElement('span', { className: 'progress-bar-text' }, [
                `${Math.round(this.video.progress)}%`
              ])
            ])
          ])
        : null
    ]);

    return card;
  }

  /**
   * Handle de delete com confirmação
   */
  async handleDelete() {
    if (confirm(`Tem certeza que deseja excluir "${this.video.name}"?`)) {
      this.options.onDelete(this.video);
    }
  }

  /**
   * Obtém classe CSS baseada no status
   * @param {string} status - Status do vídeo
   * @returns {string} Classe CSS
   */
  getStatusClass(status) {
    const classes = {
      pending: 'status-pending',
      processing: 'status-processing',
      completed: 'status-completed',
      failed: 'status-failed',
      error: 'status-error'
    };
    return classes[status] || '';
  }

  /**
   * Obtém texto baseado no status
   * @param {string} status - Status do vídeo
   * @returns {string} Texto do status
   */
  getStatusText(status) {
    const texts = {
      pending: 'Aguardando',
      processing: 'Processando',
      completed: 'Concluído',
      failed: 'Falhou',
      error: 'Erro'
    };
    return texts[status] || status;
  }

  /**
   * Atualiza o cartão com novos dados
   * @param {Object} video - Novos dados do vídeo
   */
  update(video) {
    this.video = { ...this.video, ...video };
    
    // Re-renderiza mantendo o mesmo elemento
    const newCard = this.render();
    const oldCard = document.querySelector(`[data-id="${this.video.id}"]`);
    
    if (oldCard && oldCard.parentNode) {
      oldCard.parentNode.replaceChild(newCard, oldCard);
    }
  }
}

export default VideoCardComponent;
