/**
 * Editor Module - Editor de Legendas com Timeline Interativa
 * Funcionalidades: timeline, waveform, edição inline, atalhos, sync áudio-texto
 */

import { store } from '../store/store.js';
import { api } from '../api/api.js';
import { socket } from '../socket/socket.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { SegmentRow } from '../components/segment-row.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { 
  formatTime, 
  parseTime, 
  debounce, 
  generateId,
  clamp 
} from '../utils/utils.js';

export class Editor extends EventEmitter {
  constructor() {
    super();
    this.videoId = null;
    this.videoElement = null;
    this.audioContext = null;
    this.analyser = null;
    this.waveformCanvas = null;
    this.waveformCtx = null;
    this.timelineContainer = null;
    this.segmentsList = null;
    this.currentTime = 0;
    this.duration = 0;
    this.isPlaying = false;
    this.zoom = 1;
    this.selectedSegments = new Set();
    this.history = [];
    this.historyIndex = -1;
    this.isRecording = false;
    this.autoSaveTimer = null;
    this.waveformData = null;
    
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupAutoSave();
  }

  setupElements() {
    this.videoElement = document.getElementById('editor-video');
    this.waveformCanvas = document.getElementById('waveform-canvas');
    this.timelineContainer = document.querySelector('.timeline-container');
    this.segmentsList = document.getElementById('segments-list');
    this.currentTimeDisplay = document.getElementById('current-time');
    this.durationDisplay = document.getElementById('duration');
    this.zoomSlider = document.getElementById('zoom-slider');
    this.playButton = document.getElementById('play-btn');
    this.stopButton = document.getElementById('stop-btn');
    this.recordButton = document.getElementById('record-btn');
    
    if (this.waveformCanvas) {
      this.waveformCtx = this.waveformCanvas.getContext('2d');
    }
  }

  async load(videoId) {
    try {
      this.videoId = videoId;
      this.emit('editor:loading', { videoId });

      // Carregar vídeo e segmentos
      const [videoData, segments] = await Promise.all([
        api.getVideo(videoId),
        api.getSegments(videoId)
      ]);

      if (!videoData) {
        throw new Error('Vídeo não encontrado');
      }

      // Atualizar store
      store.setState({
        editor: {
          ...store.state.editor,
          currentVideo: videoData,
          segments: segments || [],
          isLoading: false
        }
      });

      // Setup vídeo
      await this.setupVideo(videoData);
      
      // Renderizar segmentos
      this.renderSegments(segments);
      
      // Gerar waveform
      await this.generateWaveform(videoData);
      
      // Setup timeline markers
      this.renderTimelineMarkers();

      this.emit('editor:loaded', { videoId, segmentsCount: segments.length });
      Toast.show('Editor carregado com sucesso', 'success');
      
    } catch (error) {
      console.error('Erro ao carregar editor:', error);
      Toast.show('Erro ao carregar editor: ' + error.message, 'error');
      this.emit('editor:error', { error });
    }
  }

  async setupVideo(videoData) {
    return new Promise((resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Elemento de vídeo não encontrado'));
        return;
      }

      this.videoElement.src = videoData.path || `/uploads/${videoData.filename}`;
      this.videoElement.load();

      this.videoElement.onloadedmetadata = () => {
        this.duration = this.videoElement.duration;
        this.durationDisplay.textContent = formatTime(this.duration);
        resolve();
      };

      this.videoElement.onerror = () => {
        reject(new Error('Erro ao carregar vídeo'));
      };

      // Atualizar tempo atual
      this.videoElement.ontimeupdate = () => {
        this.currentTime = this.videoElement.currentTime;
        this.updateCurrentTimeDisplay();
        this.updatePlayhead();
        this.highlightActiveSegment();
      };

      this.videoElement.onplay = () => {
        this.isPlaying = true;
        this.playButton.innerHTML = '<i class="fas fa-pause"></i>';
        this.startWaveformAnimation();
      };

      this.videoElement.onpause = () => {
        this.isPlaying = false;
        this.playButton.innerHTML = '<i class="fas fa-play"></i>';
        this.stopWaveformAnimation();
      };

      this.videoElement.onended = () => {
        this.isPlaying = false;
        this.playButton.innerHTML = '<i class="fas fa-play"></i>';
        this.stopWaveformAnimation();
      };
    });
  }

  renderSegments(segments) {
    if (!this.segmentsList) return;

    this.segmentsList.innerHTML = '';
    
    if (!segments || segments.length === 0) {
      this.segmentsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-closed-captioning"></i>
          <p>Nenhuma legenda encontrada</p>
          <button class="btn btn-primary" onclick="document.dispatchEvent(new CustomEvent('editor:transcribe'))">
            <i class="fas fa-microphone"></i> Transcrever Agora
          </button>
        </div>
      `;
      return;
    }

    segments.forEach((segment, index) => {
      const row = new SegmentRow(segment, index, {
        onSelect: (id) => this.selectSegment(id),
        onEdit: (id, data) => this.updateSegment(id, data),
        onDelete: (id) => this.deleteSegment(id),
        onSplit: (id, time) => this.splitSegment(id, time),
        onMerge: (id1, id2) => this.mergeSegments(id1, id2),
        onJumpTo: (time) => this.jumpToTime(time)
      });
      
      this.segmentsList.appendChild(row.render());
    });

    this.emit('segments:rendered', { count: segments.length });
  }

  selectSegment(segmentId, addToSelection = false) {
    const segment = store.state.editor.segments.find(s => s.id === segmentId);
    if (!segment) return;

    if (!addToSelection) {
      this.selectedSegments.clear();
    }

    if (this.selectedSegments.has(segmentId)) {
      this.selectedSegments.delete(segmentId);
    } else {
      this.selectedSegments.add(segmentId);
    }

    // Atualizar UI
    this.updateSegmentSelectionUI();
    
    // Pular para o tempo do segmento
    this.jumpToTime(segment.start);

    this.emit('segment:selected', { segmentId, selectedCount: this.selectedSegments.size });
  }

  updateSegmentSelectionUI() {
    const rows = this.segmentsList.querySelectorAll('.segment-row');
    rows.forEach(row => {
      const segmentId = row.dataset.segmentId;
      const isSelected = this.selectedSegments.has(segmentId);
      row.classList.toggle('selected', isSelected);
    });

    // Atualizar toolbar de seleção
    this.updateSelectionToolbar();
  }

  updateSelectionToolbar() {
    const toolbar = document.getElementById('selection-toolbar');
    if (!toolbar) return;

    const count = this.selectedSegments.size;
    toolbar.style.display = count > 0 ? 'flex' : 'none';
    toolbar.querySelector('.selected-count').textContent = `${count} selecionado(s)`;
  }

  async updateSegment(segmentId, data) {
    try {
      const segment = store.state.editor.segments.find(s => s.id === segmentId);
      if (!segment) return;

      // Salvar estado anterior para undo
      this.saveHistoryState();

      // Atualizar localmente primeiro (otimista)
      const updatedSegments = store.state.editor.segments.map(s => 
        s.id === segmentId ? { ...s, ...data } : s
      );
      
      store.setState({
        editor: {
          ...store.state.editor,
          segments: updatedSegments
        }
      });

      // Re-renderizar segmento específico
      this.reRenderSegment(segmentId);

      // Salvar no backend (debounced)
      await api.updateSegment(segmentId, data);

      this.emit('segment:updated', { segmentId, data });
      
    } catch (error) {
      console.error('Erro ao atualizar segmento:', error);
      Toast.show('Erro ao salvar alteração', 'error');
      
      // Reverter para estado anterior
      this.undo();
    }
  }

  async deleteSegment(segmentId) {
    try {
      const confirmed = await Modal.confirm(
        'Excluir Segmento',
        'Tem certeza que deseja excluir este segmento?',
        'warning'
      );

      if (!confirmed) return;

      this.saveHistoryState();

      // Remover localmente
      const updatedSegments = store.state.editor.segments.filter(s => s.id !== segmentId);
      store.setState({
        editor: { ...store.state.editor, segments: updatedSegments }
      });

      // Re-renderizar
      this.renderSegments(updatedSegments);

      // Remover do backend
      await api.deleteSegment(segmentId);

      this.selectedSegments.delete(segmentId);
      this.updateSegmentSelectionUI();

      Toast.show('Segmento excluído', 'success');
      this.emit('segment:deleted', { segmentId });
      
    } catch (error) {
      console.error('Erro ao excluir segmento:', error);
      Toast.show('Erro ao excluir segmento', 'error');
    }
  }

  splitSegment(segmentId, time) {
    const segment = store.state.editor.segments.find(s => s.id === segmentId);
    if (!segment) return;

    if (time <= segment.start || time >= segment.end) {
      Toast.show('Tempo de divisão inválido', 'warning');
      return;
    }

    this.saveHistoryState();

    // Criar dois novos segmentos
    const text = segment.text || '';
    const midPoint = Math.floor(text.length / 2);
    const text1 = text.substring(0, midPoint).trim();
    const text2 = text.substring(midPoint).trim();

    const segment1 = {
      id: generateId(),
      start: segment.start,
      end: time,
      text: text1
    };

    const segment2 = {
      id: generateId(),
      start: time,
      end: segment.end,
      text: text2
    };

    // Atualizar lista de segmentos
    const segments = store.state.editor.segments;
    const index = segments.findIndex(s => s.id === segmentId);
    const newSegments = [
      ...segments.slice(0, index),
      segment1,
      segment2,
      ...segments.slice(index + 1)
    ];

    store.setState({
      editor: { ...store.state.editor, segments: newSegments }
    });

    this.renderSegments(newSegments);

    Toast.show('Segmento dividido', 'success');
    this.emit('segment:split', { originalId: segmentId, newIds: [segment1.id, segment2.id] });
  }

  mergeSegments(segmentId1, segmentId2) {
    const segment1 = store.state.editor.segments.find(s => s.id === segmentId1);
    const segment2 = store.state.editor.segments.find(s => s.id === segmentId2);
    
    if (!segment1 || !segment2) return;

    // Ordenar por tempo
    const [first, second] = segment1.start < segment2.start 
      ? [segment1, segment2] 
      : [segment2, segment1];

    this.saveHistoryState();

    const merged = {
      id: generateId(),
      start: first.start,
      end: second.end,
      text: `${first.text} ${second.text}`.trim()
    };

    // Atualizar lista
    const segments = store.state.editor.segments.filter(
      s => s.id !== segmentId1 && s.id !== segmentId2
    );
    
    const index = segments.findIndex(s => s.start >= first.start);
    segments.splice(index, 0, merged);

    store.setState({
      editor: { ...store.state.editor, segments }
    });

    this.renderSegments(segments);
    this.selectedSegments.clear();
    this.updateSegmentSelectionUI();

    Toast.show('Segmentos mesclados', 'success');
    this.emit('segment:merged', { mergedId: merged.id, originalIds: [segmentId1, segmentId2] });
  }

  jumpToTime(time) {
    if (!this.videoElement) return;
    
    this.videoElement.currentTime = clamp(time, 0, this.duration);
    this.updateCurrentTimeDisplay();
    this.updatePlayhead();
  }

  togglePlay() {
    if (!this.videoElement) return;

    if (this.isPlaying) {
      this.videoElement.pause();
    } else {
      this.videoElement.play();
    }
  }

  stop() {
    if (!this.videoElement) return;
    
    this.videoElement.pause();
    this.videoElement.currentTime = 0;
    this.updateCurrentTimeDisplay();
    this.updatePlayhead();
  }

  adjustZoom(delta) {
    this.zoom = clamp(this.zoom + delta, 0.5, 5);
    
    if (this.zoomSlider) {
      this.zoomSlider.value = this.zoom;
    }

    this.renderTimelineMarkers();
    this.emit('zoom:changed', { zoom: this.zoom });
  }

  renderTimelineMarkers() {
    const timeline = document.getElementById('timeline-markers');
    if (!timeline) return;

    timeline.innerHTML = '';
    
    const totalSeconds = Math.ceil(this.duration);
    const markerInterval = this.zoom > 2 ? 1 : this.zoom > 1 ? 5 : 10;

    for (let i = 0; i <= totalSeconds; i += markerInterval) {
      const marker = document.createElement('div');
      marker.className = 'timeline-marker';
      marker.style.left = `${(i / this.duration) * 100}%`;
      
      const label = document.createElement('span');
      label.className = 'timeline-label';
      label.textContent = formatTime(i);
      
      marker.appendChild(label);
      timeline.appendChild(marker);
    }
  }

  updatePlayhead() {
    const playhead = document.getElementById('playhead');
    if (!playhead || !this.duration) return;

    const position = (this.currentTime / this.duration) * 100;
    playhead.style.left = `${position}%`;
  }

  updateCurrentTimeDisplay() {
    if (this.currentTimeDisplay) {
      this.currentTimeDisplay.textContent = formatTime(this.currentTime);
    }
  }

  highlightActiveSegment() {
    const segments = store.state.editor.segments;
    const activeSegment = segments.find(
      s => this.currentTime >= s.start && this.currentTime <= s.end
    );

    const rows = this.segmentsList.querySelectorAll('.segment-row');
    rows.forEach(row => {
      const segmentId = row.dataset.segmentId;
      const isActive = activeSegment && activeSegment.id === segmentId;
      row.classList.toggle('active', isActive);
    });
  }

  async generateWaveform(videoData) {
    if (!this.waveformCanvas || !this.waveformCtx) return;

    // Simular waveform (em produção, gerar dados reais do áudio)
    const width = this.waveformCanvas.width;
    const height = this.waveformCanvas.height;
    
    this.waveformData = new Array(width).fill(0).map(() => Math.random() * height * 0.8);
    
    this.drawWaveform();
  }

  drawWaveform() {
    if (!this.waveformCtx || !this.waveformData) return;

    const ctx = this.waveformCtx;
    const width = this.waveformCanvas.width;
    const height = this.waveformCanvas.height;

    ctx.clearRect(0, 0, width, height);

    // Gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(1, '#6366f1');

    ctx.fillStyle = gradient;
    ctx.beginPath();

    const barWidth = width / this.waveformData.length;
    
    this.waveformData.forEach((amplitude, i) => {
      const x = i * barWidth;
      const y = (height - amplitude) / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Linha inferior
    for (let i = this.waveformData.length - 1; i >= 0; i--) {
      const x = i * barWidth;
      const y = (height + this.waveformData[i]) / 2;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();

    // Draw playhead line
    if (this.duration) {
      const playheadX = (this.currentTime / this.duration) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }

  startWaveformAnimation() {
    const animate = () => {
      if (!this.isPlaying) return;
      this.drawWaveform();
      requestAnimationFrame(animate);
    };
    animate();
  }

  stopWaveformAnimation() {
    // Animation stops automatically when isPlaying is false
  }

  setupEventListeners() {
    // Controles de playback
    if (this.playButton) {
      this.playButton.addEventListener('click', () => this.togglePlay());
    }

    if (this.stopButton) {
      this.stopButton.addEventListener('click', () => this.stop());
    }

    // Zoom slider
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        this.zoom = parseFloat(e.target.value);
        this.renderTimelineMarkers();
      });
    }

    // Clique na timeline
    if (this.timelineContainer) {
      this.timelineContainer.addEventListener('click', (e) => {
        const rect = this.timelineContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * this.duration;
        this.jumpToTime(time);
      });
    }

    // Clique no waveform
    if (this.waveformCanvas) {
      this.waveformCanvas.addEventListener('click', (e) => {
        const rect = this.waveformCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * this.duration;
        this.jumpToTime(time);
      });
    }

    // Auto-save ao sair
    window.addEventListener('beforeunload', () => {
      this.saveCurrentState();
    });

    // Listener para transcrição
    document.addEventListener('editor:transcribe', async () => {
      await this.startTranscription();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignorar se estiver editando um input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          this.jumpToTime(this.currentTime - 5);
          break;

        case 'ArrowRight':
          e.preventDefault();
          this.jumpToTime(this.currentTime + 5);
          break;

        case 'Home':
          e.preventDefault();
          this.jumpToTime(0);
          break;

        case 'End':
          e.preventDefault();
          this.jumpToTime(this.duration);
          break;

        case 'Delete':
        case 'Backspace':
          if (this.selectedSegments.size > 0) {
            e.preventDefault();
            this.deleteSelectedSegments();
          }
          break;

        case 'm':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.mergeSelectedSegments();
          }
          break;

        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.saveCurrentState();
            Toast.show('Projeto salvo', 'success');
          }
          break;

        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
          }
          break;

        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.adjustZoom(0.5);
          }
          break;

        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.adjustZoom(-0.5);
          }
          break;
      }
    });
  }

  setupAutoSave() {
    // Auto-save a cada 30 segundos
    setInterval(() => {
      this.saveCurrentState();
    }, 30000);
  }

  saveHistoryState() {
    const currentState = JSON.stringify(store.state.editor.segments);
    
    // Remover estados futuros se estamos no meio do histórico
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(currentState);
    this.historyIndex++;

    // Limitar histórico a 50 estados
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex <= 0) {
      Toast.show('Nada para desfazer', 'info');
      return;
    }

    this.historyIndex--;
    const previousState = JSON.parse(this.history[this.historyIndex]);
    
    store.setState({
      editor: { ...store.state.editor, segments: previousState }
    });

    this.renderSegments(previousState);
    Toast.show('Desfeito', 'info');
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      Toast.show('Nada para refazer', 'info');
      return;
    }

    this.historyIndex++;
    const nextState = JSON.parse(this.history[this.historyIndex]);
    
    store.setState({
      editor: { ...store.state.editor, segments: nextState }
    });

    this.renderSegments(nextState);
    Toast.show('Refeito', 'info');
  }

  async startTranscription() {
    try {
      Toast.show('Iniciando transcrição...', 'info');
      
      const response = await api.startTranscription(this.videoId, {
        engine: 'faster-whisper',
        model: 'base',
        language: 'auto'
      });

      Toast.show('Transcrição iniciada! Acompanhe na fila.', 'success');
      this.emit('transcription:started', { jobId: response.jobId });
      
    } catch (error) {
      Toast.show('Erro ao iniciar transcrição: ' + error.message, 'error');
    }
  }

  deleteSelectedSegments() {
    if (this.selectedSegments.size === 0) return;

    Modal.confirm(
      'Excluir Segmentos',
      `Tem certeza que deseja excluir ${this.selectedSegments.size} segmento(s)?`,
      'warning'
    ).then(confirmed => {
      if (confirmed) {
        this.selectedSegments.forEach(id => this.deleteSegment(id));
        this.selectedSegments.clear();
        this.updateSegmentSelectionUI();
      }
    });
  }

  mergeSelectedSegments() {
    if (this.selectedSegments.size < 2) {
      Toast.show('Selecione pelo menos 2 segmentos para mesclar', 'info');
      return;
    }

    const ids = Array.from(this.selectedSegments);
    this.mergeSegments(ids[0], ids[1]);
  }

  reRenderSegment(segmentId) {
    const row = this.segmentsList.querySelector(`[data-segment-id="${segmentId}"]`);
    if (!row) return;

    const segment = store.state.editor.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const index = store.state.editor.segments.indexOf(segment);
    const newRow = new SegmentRow(segment, index, {
      onSelect: (id) => this.selectSegment(id),
      onEdit: (id, data) => this.updateSegment(id, data),
      onDelete: (id) => this.deleteSegment(id),
      onSplit: (id, time) => this.splitSegment(id, time),
      onMerge: (id1, id2) => this.mergeSegments(id1, id2),
      onJumpTo: (time) => this.jumpToTime(time)
    });

    row.replaceWith(newRow.render());
  }

  async saveCurrentState() {
    try {
      const segments = store.state.editor.segments;
      
      // Salvar todos os segmentos atualizados
      const promises = segments.map(segment => 
        api.updateSegment(segment.id, {
          start: segment.start,
          end: segment.end,
          text: segment.text
        }).catch(err => console.error('Erro ao salvar segmento:', segment.id, err))
      );

      await Promise.all(promises);
      this.emit('editor:saved');
      
    } catch (error) {
      console.error('Erro ao salvar estado:', error);
    }
  }

  destroy() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
    }

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.removeAllListeners();
    this.selectedSegments.clear();
    this.history = [];
    this.historyIndex = -1;
  }
}

// Exportar instância singleton
export const editor = new Editor();
