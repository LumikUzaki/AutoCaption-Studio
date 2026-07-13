/**
 * Segment Row Component - Linha de segmento para editor
 * Componente reutilizável para exibir e editar segmentos de legenda
 */

import { createElement } from '../utils.js';
import { formatDuration, debounce } from '../utils.js';
import { store } from '../store.js';

export class SegmentRowComponent {
  constructor(segment, options = {}) {
    this.segment = segment;
    this.options = {
      onSelect: options.onSelect || (() => {}),
      onUpdate: options.onUpdate || (() => {}),
      onDelete: options.onDelete || (() => {}),
      onTimeChange: options.onTimeChange || (() => {}),
      videoElement: options.videoElement // Elemento de vídeo para seek
    };
    
    this.element = null;
    this.isEditing = false;
    
    // Debounce para salvar atualizações
    this.debouncedSave = debounce((text) => {
      this.options.onUpdate(this.segment.id, { text });
    }, 500);
  }

  /**
   * Renderiza a linha do segmento
   * @returns {HTMLElement} Elemento da linha
   */
  render() {
    const isSelected = store.get('editor.selectedSegments')?.includes(this.segment.id);
    
    this.element = createElement('div', {
      className: `segment-row ${isSelected ? 'selected' : ''}`,
      dataset: { 
        id: this.segment.id,
        start: this.segment.start,
        end: this.segment.end
      }
    }, [
      // Controles de tempo
      createElement('div', { className: 'segment-time' }, [
        createElement('input', {
          type: 'text',
          className: 'segment-time-input segment-time-start',
          value: formatDuration(this.segment.start),
          title: 'Tempo inicial',
          onChange: (e) => this.handleTimeChange('start', e.target.value)
        }),
        createElement('span', { className: 'segment-time-separator' }, ['→']),
        createElement('input', {
          type: 'text',
          className: 'segment-time-input segment-time-end',
          value: formatDuration(this.segment.end),
          title: 'Tempo final',
          onChange: (e) => this.handleTimeChange('end', e.target.value)
        })
      ]),
      
      // Texto do segmento
      createElement('div', { className: 'segment-text-container' }, [
        createElement('textarea', {
          className: 'segment-text',
          rows: Math.max(1, Math.ceil(this.segment.text.length / 50)),
          placeholder: 'Digite a legenda...',
          value: this.segment.text,
          onInput: (e) => this.handleTextChange(e.target.value),
          onFocus: () => this.select(),
          onBlur: () => this.save()
        })
      ]),
      
      // Ações
      createElement('div', { className: 'segment-actions' }, [
        // Play no tempo inicial
        createElement('button', {
          className: 'btn btn-icon btn-sm',
          onClick: () => this.seekTo(this.segment.start),
          title: 'Reproduzir deste ponto'
        }, ['▶']),
        
        // Dividir segmento
        createElement('button', {
          className: 'btn btn-icon btn-sm',
          onClick: () => this.split(),
          title: 'Dividir segmento'
        }, ['✂']),
        
        // Mesclar com próximo
        createElement('button', {
          className: 'btn btn-icon btn-sm',
          onClick: () => this.merge(),
          title: 'Mesclar com próximo',
          disabled: !this.hasNext()
        }, ['⧉']),
        
        // Deletar
        createElement('button', {
          className: 'btn btn-icon btn-sm btn-danger',
          onClick: () => this.delete(),
          title: 'Excluir segmento'
        }, ['🗑'])
      ])
    ]);

    return this.element;
  }

  /**
   * Handle de mudança de texto
   * @param {string} text - Novo texto
   */
  handleTextChange(text) {
    this.segment.text = text;
    this.debouncedSave(text);
  }

  /**
   * Handle de mudança de tempo
   * @param {string} field - Campo (start/end)
   * @param {string} value - Valor digitado
   */
  handleTimeChange(field, value) {
    const seconds = this.parseTimeInput(value);
    if (seconds !== null && seconds >= 0) {
      this.segment[field] = seconds;
      this.options.onTimeChange(this.segment.id, field, seconds);
    }
  }

  /**
   * Parse de input de tempo para segundos
   * @param {string} input - Input no formato HH:MM:SS.mmm ou MM:SS.mmm
   * @returns {number|null} Segundos ou null se inválido
   */
  parseTimeInput(input) {
    const regex = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/;
    const match = input.match(regex);
    
    if (!match) return null;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const ms = parseInt(match[4] || '0');
    
    if (minutes > 59 || seconds > 59) return null;
    
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  }

  /**
   * Seleciona o segmento
   */
  select() {
    this.options.onSelect(this.segment.id);
  }

  /**
   * Salva alterações (chama onUpdate)
   */
  save() {
    this.options.onUpdate(this.segment.id, { text: this.segment.text });
  }

  /**
   * Seek no vídeo para tempo inicial
   */
  seekTo(time) {
    if (this.options.videoElement) {
      this.options.videoElement.currentTime = time;
      this.options.videoElement.play();
    }
  }

  /**
   * Divide segmento no tempo atual do vídeo
   */
  split() {
    if (!this.options.videoElement) return;
    
    const currentTime = this.options.videoElement.currentTime;
    
    // Verifica se está dentro do segmento
    if (currentTime <= this.segment.start || currentTime >= this.segment.end) {
      alert('Posicione o vídeo dentro deste segmento para dividir');
      return;
    }
    
    // Encontra posição do texto para dividir (aproximada)
    const ratio = (currentTime - this.segment.start) / (this.segment.end - this.segment.start);
    const splitIndex = Math.floor(this.segment.text.length * ratio);
    
    const firstPart = this.segment.text.slice(0, splitIndex).trim();
    const secondPart = this.segment.text.slice(splitIndex).trim();
    
    // Emite evento para criar novo segmento
    const event = new CustomEvent('segment:split', {
      detail: {
        originalId: this.segment.id,
        splitTime: currentTime,
        firstPart,
        secondPart
      },
      bubbles: true
    });
    this.element.dispatchEvent(event);
  }

  /**
   * Mescla com próximo segmento
   */
  merge() {
    const event = new CustomEvent('segment:merge', {
      detail: { segmentId: this.segment.id },
      bubbles: true
    });
    this.element.dispatchEvent(event);
  }

  /**
   * Deleta segmento
   */
  delete() {
    this.options.onDelete(this.segment.id);
  }

  /**
   * Verifica se tem próximo segmento
   * @returns {boolean}
   */
  hasNext() {
    const segments = store.get('editor.segments');
    const index = segments.findIndex(s => s.id === this.segment.id);
    return index < segments.length - 1;
  }

  /**
   * Atualiza visualização do segmento
   * @param {Object} updates - Atualizações
   */
  update(updates) {
    this.segment = { ...this.segment, ...updates };
    
    if (!this.element) return;
    
    // Atualiza inputs de tempo
    const startInput = this.element.querySelector('.segment-time-start');
    const endInput = this.element.querySelector('.segment-time-end');
    const textarea = this.element.querySelector('.segment-text');
    
    if (startInput && updates.start !== undefined) {
      startInput.value = formatDuration(updates.start);
    }
    if (endInput && updates.end !== undefined) {
      endInput.value = formatDuration(updates.end);
    }
    if (textarea && updates.text !== undefined) {
      textarea.value = updates.text;
    }
    
    // Atualiza seleção
    const isSelected = store.get('editor.selectedSegments')?.includes(this.segment.id);
    this.element.classList.toggle('selected', isSelected);
  }

  /**
   * Scroll até o segmento
   */
  scrollIntoView() {
    if (this.element) {
      this.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Highlight temporário
   */
  highlight() {
    if (!this.element) return;
    
    this.element.classList.add('highlighted');
    setTimeout(() => {
      this.element.classList.remove('highlighted');
    }, 1000);
  }
}

export default SegmentRowComponent;
