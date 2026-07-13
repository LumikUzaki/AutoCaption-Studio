/**
 * Legendas Pro - Aplicação Frontend
 * HTML5 + CSS3 + JavaScript ES2023 (zero frameworks)
 */

// Importações de módulos
import { router } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { socket } from './socket.js';
import { ToastComponent } from './components/toast.js';
import { modal } from './components/modal.js';
import VideoCardComponent from './components/video-card.js';
import SegmentRowComponent from './components/segment-row.js';
import { formatDuration, formatFileSize, formatDate } from './utils.js';

/**
 * Classe principal da aplicação
 */
class App {
  constructor() {
    this.toast = null;
    this.initialized = false;
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    try {
      console.log('🎬 Legendas Pro - Inicializando...');
      
      // Carrega estado persistente
      store.loadPersistedState();
      
      // Configurar tema
      this.setupTheme();
      
      // Criar serviço de toast
      this.toast = new ToastComponent();
      
      // Conectar WebSocket
      await socket.connect();
      
      // Configurar event listeners globais
      this.setupGlobalListeners();
      
      // Configurar rotas
      this.setupRoutes();
      
      // Inicializar router
      router.init();
      
      // Carregar dados iniciais
      await this.loadInitialData();
      
      this.initialized = true;
      store.set('app.systemStatus', 'ready');
      store.set('app.initialized', true);
      
      console.log('✅ Aplicação inicializada com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      store.notify('error', 'Erro ao iniciar aplicação');
      store.set('app.systemStatus', 'error');
    }
  }

  /**
   * Configura o tema da aplicação
   */
  setupTheme() {
    const savedTheme = store.get('app.theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  /**
   * Alterna entre temas claro e escuro
   */
  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    store.set('app.theme', newTheme);
  }

  /**
   * Configura rotas da aplicação
   */
  setupRoutes() {
    // Dashboard
    router.register('/', async () => {
      await this.renderDashboard();
    });
    
    router.register('/dashboard', async () => {
      await this.renderDashboard();
    });
    
    // Fila
    router.register('/queue', async () => {
      await this.renderQueue();
    });
    
    // Editor com parâmetro de vídeo
    router.register('/editor/:id', async (params) => {
      await this.renderEditor(params.id);
    });
    
    // Configurações
    router.register('/config', async () => {
      await this.renderConfig();
    });
    
    // Hook antes de mudar de rota
    router.beforeEach(async (toPath, fromPage) => {
      // Pode adicionar validações aqui
      return true;
    });
  }

  /**
   * Configura event listeners globais
   */
  setupGlobalListeners() {
    // Upload de vídeo via drag and drop
    this.setupDragAndDrop();
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
      // Ctrl+Z para undo no editor
      if (e.ctrlKey && e.key === 'z' && store.get('editor.active')) {
        e.preventDefault();
        store.undo();
      }
      // Ctrl+Y para redo no editor
      if (e.ctrlKey && e.key === 'y' && store.get('editor.active')) {
        e.preventDefault();
        store.redo();
      }
      // Escape para fechar modais
      if (e.key === 'Escape') {
        modal.close();
      }
    });
    
    // Sistema online/offline
    window.addEventListener('online', () => this.updateSystemStatus('online'));
    window.addEventListener('offline', () => this.updateSystemStatus('offline'));
    
    // Antes de sair da página
    window.addEventListener('beforeunload', (e) => {
      if (store.get('queue.activeJobs').length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Configura drag and drop para upload
   */
  setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      }, false);
    });
    
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileUpload(files[0]);
      }
    }, false);
  }

  /**
   * Carrega dados iniciais
   */
  async loadInitialData() {
    try {
      // Carregar vídeos
      const videos = await api.getVideos();
      store.set('videos.list', videos);
      
      // Carregar fila
      const queueStatus = await api.getQueueStatus();
      if (queueStatus) {
        store.set('queue.stats', queueStatus.stats || {});
        store.set('queue.jobs', queueStatus.jobs || []);
      }
      
      // Carregar configurações
      const config = await api.getConfig();
      if (config) {
        store.set('settings', { ...store.get('settings'), ...config });
      }
      
      // Carregar status do sistema
      try {
        const systemStatus = await api.getSystemStatus();
        if (systemStatus) {
          store.set('system.gpuAvailable', systemStatus.gpuAvailable || false);
          store.set('system.cudaVersion', systemStatus.cudaVersion);
        }
      } catch (e) {
        // Ignora se endpoint não existir
      }
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  }

  /**
   * Renderiza dashboard
   */
  async renderDashboard() {
    store.set('app.currentPage', 'dashboard');
    
    const container = document.getElementById('videoListContainer');
    if (!container) return;
    
    // Limpa container
    container.innerHTML = '';
    
    const videos = store.get('videos.list');
    
    if (videos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <h3>Nenhum vídeo encontrado</h3>
          <p>Faça upload de um vídeo para começar a criar legendas</p>
        </div>
      `;
      return;
    }
    
    // Renderiza cards de vídeo
    videos.forEach(video => {
      const cardComponent = new VideoCardComponent(video, {
        onOpen: (v) => router.navigate(`/editor/${v.id}`),
        onDelete: (v) => this.handleDeleteVideo(v),
        onExport: (v) => this.handleExportVideo(v)
      });
      container.appendChild(cardComponent.render());
    });
  }

  /**
   * Renderiza fila
   */
  async renderQueue() {
    store.set('app.currentPage', 'queue');
    
    const container = document.getElementById('queueListContainer');
    if (!container) return;
    
    // Atualiza lista de jobs
    try {
      const jobs = await api.getJobs();
      store.set('queue.jobs', jobs);
      
      // Renderiza jobs (implementação simplificada)
      container.innerHTML = jobs.length > 0 
        ? jobs.map(job => `
            <div class="queue-item ${job.status}">
              <div class="queue-item-info">
                <strong>${job.type}</strong>
                <span class="queue-item-status">${job.status}</span>
              </div>
              <div class="queue-item-progress">
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${job.progress || 0}%"></div>
                </div>
                <span>${Math.round(job.progress || 0)}%</span>
              </div>
            </div>
          `).join('')
        : `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>Fila vazia</h3>
            <p>Não há jobs em processamento no momento</p>
          </div>
        `;
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
    }
  }

  /**
   * Renderiza editor
   */
  async renderEditor(videoId) {
    store.set('app.currentPage', 'editor');
    store.set('editor.active', true);
    store.set('editor.videoId', videoId);
    
    try {
      // Carrega vídeo
      const video = await api.getVideo(videoId);
      store.set('editor.currentVideo', video);
      
      // Carrega segmentos
      const segments = await api.getSegments(videoId);
      store.set('editor.segments', segments);
      
      // Renderiza editor (implementação simplificada)
      const playerContainer = document.getElementById('videoPlayerContainer');
      const segmentsContainer = document.getElementById('segmentsListContainer');
      
      if (playerContainer && video.path) {
        playerContainer.innerHTML = `
          <video id="mainVideoPlayer" controls class="video-player">
            <source src="${video.path}" type="video/mp4">
            Seu navegador não suporta este vídeo.
          </video>
        `;
      }
      
      if (segmentsContainer) {
        segmentsContainer.innerHTML = '';
        
        if (segments.length === 0) {
          segmentsContainer.innerHTML = `
            <div class="empty-state">
              <p>Nenhuma legenda encontrada. Inicie uma transcrição.</p>
            </div>
          `;
        } else {
          segments.forEach(segment => {
            const segmentComponent = new SegmentRowComponent(segment, {
              videoElement: document.getElementById('mainVideoPlayer'),
              onSelect: (id) => this.selectSegment(id),
              onUpdate: (id, data) => this.updateSegment(id, data),
              onDelete: (id) => this.deleteSegment(id),
              onTimeChange: (id, field, value) => this.updateSegmentTime(id, field, value)
            });
            segmentsContainer.appendChild(segmentComponent.render());
          });
        }
      }
      
      // Mostra botão de voltar
      const backBtn = document.getElementById('btnBackToDashboard');
      if (backBtn) {
        backBtn.style.display = 'inline-flex';
      }
    } catch (error) {
      console.error('Erro ao carregar editor:', error);
      store.notify('error', 'Erro ao carregar vídeo');
    }
  }

  /**
   * Renderiza configurações
   */
  async renderConfig() {
    store.set('app.currentPage', 'config');
    
    // Sincroniza inputs com settings do store
    const settings = store.get('settings');
    
    // Preenche formulários com configurações atuais
    Object.entries(settings).forEach(([section, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        const input = document.querySelector(`[name="${section}.${key}"]`);
        if (input) {
          input.value = value;
        }
      });
    });
  }

  /**
   * Handle de upload de arquivo
   */
  async handleFileUpload(file) {
    // Valida tipo de arquivo
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'audio/mp3', 'audio/wav'];
    if (!validTypes.includes(file.type)) {
      store.notify('error', 'Formato de arquivo não suportado');
      return;
    }
    
    try {
      store.notify('info', 'Iniciando upload...');
      
      const result = await api.uploadVideo(file, (progress) => {
        console.log(`Upload: ${progress.toFixed(1)}%`);
      });
      
      store.notify('success', 'Upload concluído!');
      
      // Recarrega lista de vídeos
      await this.loadInitialData();
      await this.renderDashboard();
      
      // Inicia transcrição automaticamente
      if (result.videoId) {
        await api.startTranscription(result.videoId, store.get('settings.transcription'));
        router.navigate('/queue');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      store.notify('error', `Erro no upload: ${error.message}`);
    }
  }

  /**
   * Handle de delete de vídeo
   */
  async handleDeleteVideo(video) {
    const confirmed = await modal.confirm({
      title: 'Excluir Vídeo',
      message: `Tem certeza que deseja excluir "${video.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      await api.deleteVideo(video.id);
      store.notify('success', 'Vídeo excluído com sucesso');
      
      // Remove da lista
      const videos = store.get('videos.list').filter(v => v.id !== video.id);
      store.set('videos.list', videos);
      
      // Re-renderiza
      await this.renderDashboard();
    } catch (error) {
      console.error('Erro ao excluir vídeo:', error);
      store.notify('error', 'Erro ao excluir vídeo');
    }
  }

  /**
   * Handle de exportação de vídeo
   */
  handleExportVideo(video) {
    // Abre modal de exportação
    modal.show({
      title: 'Exportar Legenda',
      content: `
        <p>Selecione o formato de exportação para "${video.name}":</p>
        <div class="export-options">
          <button class="btn btn-secondary" data-format="srt">SRT</button>
          <button class="btn btn-secondary" data-format="vtt">VTT</button>
          <button class="btn btn-secondary" data-format="ass">ASS</button>
          <button class="btn btn-secondary" data-format="txt">TXT</button>
          <button class="btn btn-secondary" data-format="json">JSON</button>
        </div>
      `,
      buttons: [{ text: 'Cancelar', variant: 'secondary' }]
    });
    
    // Adiciona listeners nos botões de formato
    setTimeout(() => {
      document.querySelectorAll('.export-options .btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const format = btn.dataset.format;
          await this.exportSubtitle(video.id, format);
          modal.close();
        });
      });
    }, 100);
  }

  /**
   * Exporta legenda
   */
  async exportSubtitle(videoId, format) {
    try {
      const result = await api.exportSubtitle(videoId, format);
      
      if (result.downloadUrl) {
        // Cria link de download
        const a = document.createElement('a');
        a.href = result.downloadUrl;
        a.download = `legendas.${format}`;
        a.click();
        
        store.notify('success', `Legenda exportada em ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      store.notify('error', 'Erro ao exportar legenda');
    }
  }

  /**
   * Seleciona segmento
   */
  selectSegment(segmentId) {
    const selected = store.get('editor.selectedSegments') || [];
    if (!selected.includes(segmentId)) {
      store.set('editor.selectedSegments', [segmentId]);
    }
  }

  /**
   * Atualiza segmento
   */
  async updateSegment(segmentId, data) {
    try {
      await api.updateSegment(segmentId, data);
      
      // Atualiza no store
      const segments = store.get('editor.segments');
      const index = segments.findIndex(s => s.id === segmentId);
      if (index >= 0) {
        segments[index] = { ...segments[index], ...data };
        store.set('editor.segments', segments);
      }
    } catch (error) {
      console.error('Erro ao atualizar segmento:', error);
    }
  }

  /**
   * Deleta segmento
   */
  async deleteSegment(segmentId) {
    try {
      await api.deleteSegment(segmentId);
      
      // Remove do store
      const segments = store.get('editor.segments').filter(s => s.id !== segmentId);
      store.set('editor.segments', segments);
      
      // Remove elemento do DOM
      const element = document.querySelector(`[data-id="${segmentId}"]`);
      if (element) {
        element.remove();
      }
    } catch (error) {
      console.error('Erro ao deletar segmento:', error);
    }
  }

  /**
   * Atualiza tempo de segmento
   */
  async updateSegmentTime(segmentId, field, value) {
    // Implementação similar ao updateSegment
    await this.updateSegment(segmentId, { [field]: value });
  }

  /**
   * Atualiza status do sistema
   */
  updateSystemStatus(status) {
    const indicator = document.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = `status-indicator status-indicator--${status}`;
    }
  }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

export { App };
