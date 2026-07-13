/**
 * Store - Gerenciamento de estado global da aplicação
 * Padrão Observer com estado centralizado e reativo
 */

import { EventEmitter } from './event-emitter.js';

class Store extends EventEmitter {
  constructor() {
    super();
    
    // Estado inicial
    this.state = {
      // Estado da aplicação
      app: {
        initialized: false,
        currentPage: null,
        theme: localStorage.getItem('theme') || 'dark',
        systemStatus: 'unknown', // unknown, ready, processing, error
        version: '1.0.0'
      },
      
      // Vídeos
      videos: {
        list: [],
        currentVideo: null,
        filters: {
          search: '',
          status: 'all',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        },
        loading: false,
        error: null
      },
      
      // Editor
      editor: {
        active: false,
        videoId: null,
        segments: [],
        selectedSegments: [],
        history: {
          past: [],
          future: []
        },
        zoom: 100,
        playing: false,
        currentTime: 0,
        duration: 0,
        autoScroll: true,
        highlightCurrent: true
      },
      
      // Fila de processamento
      queue: {
        jobs: [],
        activeJobs: [],
        pendingJobs: [],
        completedJobs: [],
        failedJobs: [],
        stats: {
          total: 0,
          active: 0,
          pending: 0,
          completed: 0,
          failed: 0
        },
        loading: false
      },
      
      // Configurações
      settings: {
        transcription: {
          engine: 'faster-whisper',
          model: 'medium',
          language: 'auto',
          wordTimestamps: true,
          diarization: false
        },
        translation: {
          engine: 'argos',
          targetLanguage: 'en'
        },
        export: {
          defaultFormat: 'srt',
          includeMetadata: true
        },
        player: {
          autoPlay: false,
          loop: false,
          volume: 1.0
        },
        ui: {
          compactMode: false,
          showWaveform: true,
          segmentsPerRow: 1
        }
      },
      
      // Notificações
      notifications: {
        list: [],
        autoClose: 5000
      },
      
      // Sistema
      system: {
        gpuAvailable: false,
        cudaVersion: null,
        modelsLoaded: [],
        diskSpace: null,
        memoryUsage: null
      }
    };
    
    // Subscrições computadas (derivadas do estado)
    this.computed = new Map();
  }

  /**
   * Obtém valor do estado por path
   * @param {string} path - Path dot notation (ex: 'videos.list')
   * @returns {any} Valor no estado
   */
  get(path) {
    if (!path) return this.state;
    
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, this.state);
  }

  /**
   * Define valor no estado por path
   * @param {string} path - Path dot notation
   * @param {any} value - Valor a definir
   * @param {boolean} emitEvent - Se deve emitir evento (padrão: true)
   */
  set(path, value, emitEvent = true) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) {
        obj[key] = {};
      }
      return obj[key];
    }, this.state);
    
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    if (emitEvent) {
      this.emit('stateChanged', { path, value, oldValue });
      this.emit(`stateChanged:${path}`, value);
    }
    
    // Persiste configurações no localStorage
    if (path.startsWith('app.theme')) {
      localStorage.setItem('theme', value);
    }
    if (path.startsWith('settings')) {
      localStorage.setItem('settings', JSON.stringify(this.state.settings));
    }
  }

  /**
   * Atualiza múltiplos valores no estado
   * @param {Object} updates - Objeto com paths e valores
   */
  setState(updates) {
    Object.entries(updates).forEach(([path, value]) => {
      this.set(path, value, false);
    });
    
    // Emite único evento para todas as mudanças
    this.emit('stateBatchUpdated', updates);
  }

  /**
   * Adiciona item a um array no estado
   * @param {string} path - Path do array
   * @param {any} item - Item a adicionar
   */
  add(path, item) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`Path ${path} não é um array`);
      return;
    }
    
    array.push(item);
    this.set(path, array);
  }

  /**
   * Remove item de array no estado por índice ou predicate
   * @param {string} path - Path do array
   * @param {number|Function} indexOrPredicate - Índice ou função predicate
   */
  remove(path, indexOrPredicate) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`Path ${path} não é um array`);
      return;
    }
    
    let newArray;
    if (typeof indexOrPredicate === 'number') {
      newArray = array.filter((_, i) => i !== indexOrPredicate);
    } else if (typeof indexOrPredicate === 'function') {
      newArray = array.filter(item => !indexOrPredicate(item));
    } else {
      return;
    }
    
    this.set(path, newArray);
  }

  /**
   * Atualiza item em array no estado
   * @param {string} path - Path do array
   * @param {Function} predicate - Função para encontrar item
   * @param {Object} updates - Atualizações a aplicar
   */
  update(path, predicate, updates) {
    const array = this.get(path);
    if (!Array.isArray(array)) {
      console.error(`Path ${path} não é um array`);
      return;
    }
    
    const newArray = array.map(item => {
      if (predicate(item)) {
        return { ...item, ...updates };
      }
      return item;
    });
    
    this.set(path, newArray);
  }

  /**
   * Registra propriedade computada
   * @param {string} name - Nome da propriedade computada
   * @param {Function} computeFn - Função que computa o valor
   */
  computed(name, computeFn) {
    this.computed.set(name, computeFn);
  }

  /**
   * Obtém valor computado
   * @param {string} name - Nome da propriedade computada
   * @returns {any} Valor computado
   */
  getComputed(name) {
    const computeFn = this.computed.get(name);
    if (!computeFn) {
      return undefined;
    }
    return computeFn(this.state);
  }

  /**
   * Carrega configurações salvas no localStorage
   */
  loadPersistedState() {
    try {
      const savedSettings = localStorage.getItem('settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        this.set('settings', { ...this.state.settings, ...parsed }, false);
      }
      
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        this.set('app.theme', savedTheme, false);
      }
    } catch (error) {
      console.error('Erro ao carregar estado persistente:', error);
    }
  }

  /**
   * Reseta estado para valores padrão
   */
  reset() {
    const initialState = {
      app: { ...this.state.app, initialized: false, currentPage: null },
      videos: { ...this.state.videos, list: [], currentVideo: null },
      editor: { ...this.state.editor, active: false, segments: [], selectedSegments: [] },
      queue: { ...this.state.queue, jobs: [], activeJobs: [] },
      notifications: { ...this.state.notifications, list: [] }
    };
    
    this.setState(initialState);
  }

  /**
   * Assina mudança em path específico
   * @param {string} path - Path para observar
   * @param {Function} callback - Callback quando mudar
   * @returns {Function} Função para cancelar subscrição
   */
  subscribe(path, callback) {
    const handler = (value) => callback(value, this.state);
    this.on(`stateChanged:${path}`, handler);
    
    // Retorna função de cancelamento
    return () => {
      this.off(`stateChanged:${path}`, handler);
    };
  }

  /**
   * Assina todas as mudanças de estado
   * @param {Function} callback - Callback quando mudar
   * @returns {Function} Função para cancelar subscrição
   */
  subscribeAll(callback) {
    this.on('stateChanged', callback);
    return () => this.off('stateChanged', callback);
  }

  /**
   * Adiciona notificação
   * @param {string} type - Tipo (success, error, warning, info)
   * @param {string} message - Mensagem
   * @param {Object} options - Opções adicionais
   */
  notify(type, message, options = {}) {
    const notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toISOString(),
      autoClose: options.autoClose ?? this.state.notifications.autoClose,
      ...options
    };
    
    this.add('notifications.list', notification);
    
    // Auto-remove após timeout
    if (notification.autoClose) {
      setTimeout(() => {
        this.remove('notifications.list', n => n.id === notification.id);
      }, notification.autoClose);
    }
    
    return notification.id;
  }

  /**
   * Remove notificação
   * @param {string} id - ID da notificação
   */
  dismissNotification(id) {
    this.remove('notifications.list', n => n.id === id);
  }

  /**
   * Limpa todas as notificações
   */
  clearNotifications() {
    this.set('notifications.list', []);
  }

  /**
   * Undo no editor
   */
  undo() {
    const history = this.get('editor.history');
    if (history.past.length === 0) return;
    
    const previousState = history.past.pop();
    const currentState = { segments: [...this.get('editor.segments')] };
    
    history.future.push(currentState);
    this.set('editor.segments', previousState.segments);
    this.set('editor.history', history);
  }

  /**
   * Redo no editor
   */
  redo() {
    const history = this.get('editor.history');
    if (history.future.length === 0) return;
    
    const nextState = history.future.pop();
    const currentState = { segments: [...this.get('editor.segments')] };
    
    history.past.push(currentState);
    this.set('editor.segments', nextState.segments);
    this.set('editor.history', history);
  }

  /**
   * Adiciona estado ao histórico do editor
   */
  pushHistory() {
    const history = this.get('editor.history');
    const currentState = { segments: JSON.parse(JSON.stringify(this.get('editor.segments'))) };
    
    history.past.push(currentState);
    history.future = []; // Limpa futuro ao fazer nova ação
    
    // Limita tamanho do histórico
    if (history.past.length > 50) {
      history.past.shift();
    }
    
    this.set('editor.history', history);
  }
}

// Exporta instância singleton
export const store = new Store();
export default store;
