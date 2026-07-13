/**
 * Legendas Pro - Aplicação Frontend
 * HTML5 + CSS3 + JavaScript ES2023 (zero frameworks)
 */

// Importações de módulos
import { Router } from './core/router.js';
import { Store } from './store/index.js';
import { APIClient } from './services/api.client.js';
import { SocketClient } from './services/socket.client.js';
import { ToastService } from './services/toast.service.js';
import { ModalService } from './services/modal.service.js';
import { VideoComponent } from './components/video.component.js';
import { EditorComponent } from './components/editor.component.js';
import { QueueComponent } from './components/queue.component.js';

/**
 * Classe principal da aplicação
 */
class App {
    constructor() {
        this.store = new Store();
        this.api = new APIClient();
        this.socket = new SocketClient();
        this.toast = new ToastService();
        this.modal = new ModalService();
        this.router = new Router();
        
        // Componentes
        this.videoComponent = new VideoComponent(this.store, this.api, this.toast);
        this.editorComponent = new EditorComponent(this.store, this.api, this.toast, this.modal);
        this.queueComponent = new QueueComponent(this.store, this.socket);
        
        this.initialized = false;
    }

    /**
     * Inicializa a aplicação
     */
    async init() {
        try {
            console.log('🎬 Legendas Pro - Inicializando...');
            
            // Configurar tema
            this.setupTheme();
            
            // Conectar WebSocket
            await this.socket.connect();
            
            // Configurar event listeners globais
            this.setupGlobalListeners();
            
            // Carregar dados iniciais
            await this.loadInitialData();
            
            // Configurar router
            this.router.init(this.store);
            
            // Renderizar página inicial
            this.renderCurrentPage();
            
            this.initialized = true;
            this.toast.show('Sistema pronto!', 'success');
            
            console.log('✅ Aplicação inicializada com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.toast.show('Erro ao iniciar aplicação', 'error');
        }
    }

    /**
     * Configura o tema da aplicação
     */
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
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
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Configura event listeners globais
     */
    setupGlobalListeners() {
        // Navegação no header
        document.querySelectorAll('.header__nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.router.navigate(page);
            });
        });

        // Voltar ao dashboard
        const btnBack = document.getElementById('btnBackToDashboard');
        if (btnBack) {
            btnBack.addEventListener('click', () => this.router.navigate('dashboard'));
        }

        // Upload de vídeo
        const btnUpload = document.getElementById('btnUploadVideo');
        if (btnUpload) {
            btnUpload.addEventListener('click', () => this.modal.open('upload'));
        }

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z para undo
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.editorComponent.undo();
            }
            // Ctrl+Y para redo
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.editorComponent.redo();
            }
            // Espaço para play/pause no editor
            if (e.key === ' ' && this.store.state.app.currentPage === 'editor') {
                e.preventDefault();
                this.editorComponent.togglePlayPause();
            }
            // Escape para fechar modais
            if (e.key === 'Escape') {
                this.modal.closeAll();
            }
        });

        // Sistema online/offline
        window.addEventListener('online', () => this.updateSystemStatus('online'));
        window.addEventListener('offline', () => this.updateSystemStatus('offline'));
    }

    /**
     * Carrega dados iniciais
     */
    async loadInitialData() {
        try {
            // Carregar vídeos
            const videos = await this.api.get('/videos');
            this.store.dispatch({ type: 'SET_VIDEOS', payload: videos });
            
            // Carregar fila
            const queue = await this.api.get('/queue/status');
            this.store.dispatch({ type: 'SET_QUEUE', payload: queue });
            
            // Carregar configurações
            const settings = await this.api.get('/config');
            this.store.dispatch({ type: 'SET_SETTINGS', payload: settings });
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
        }
    }

    /**
     * Renderiza a página atual
     */
    renderCurrentPage() {
        const currentPage = this.store.state.app.currentPage;
        
        // Esconder todas as páginas
        document.querySelectorAll('.page').forEach(page => {
            page.hidden = true;
        });
        
        // Mostrar página atual
        const activePage = document.getElementById(`page-${currentPage}`);
        if (activePage) {
            activePage.hidden = false;
        }
        
        // Atualizar navegação
        document.querySelectorAll('.header__nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === currentPage);
        });
        
        // Atualizar body data attribute
        document.body.setAttribute('data-page', currentPage);
        
        // Renderizar conteúdo específico da página
        switch (currentPage) {
            case 'dashboard':
                this.videoComponent.render();
                break;
            case 'editor':
                this.editorComponent.render();
                break;
            case 'queue':
                this.queueComponent.render();
                break;
            case 'settings':
                // Settings já é estático no HTML
                break;
        }
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
