/**
 * Socket Client - Cliente para comunicação WebSocket em tempo real
 * Gerencia conexão Socket.IO com o backend
 */

import { EventEmitter } from './event-emitter.js';
import { store } from './store.js';

class SocketClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.pingInterval = null;
    this.pongTimeout = null;
  }

  /**
   * Conecta ao servidor WebSocket
   * @returns {Promise<boolean>} Se conectou com sucesso
   */
  async connect() {
    if (this.socket && this.socket.connected) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        // Usa socket.io nativo do browser (carregado via CDN)
        this.socket = io(window.location.origin, {
          transports: ['websocket'],
          upgrade: false,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: 20000
        });

        // Evento de conexão
        this.socket.on('connect', () => {
          console.log('[Socket] Conectado ao servidor');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          resolve(true);
        });

        // Evento de desconexão
        this.socket.on('disconnect', (reason) => {
          console.log(`[Socket] Desconectado: ${reason}`);
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnected', reason);
        });

        // Evento de erro
        this.socket.on('connect_error', (error) => {
          console.error('[Socket] Erro de conexão:', error);
          this.emit('error', error);
          
          if (++this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Máximo de tentativas de reconexão atingido'));
          }
        });

        // Setup de listeners para eventos do sistema
        this.setupEventListeners();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Configura listeners para eventos do backend
   */
  setupEventListeners() {
    // Transcrição
    this.onEvent('transcription:progress', (data) => {
      store.emit('transcriptionProgress', data);
    });

    this.onEvent('transcription:completed', (data) => {
      store.emit('transcriptionCompleted', data);
    });

    this.onEvent('transcription:failed', (data) => {
      store.emit('transcriptionFailed', data);
    });

    // Tradução
    this.onEvent('translation:progress', (data) => {
      store.emit('translationProgress', data);
    });

    this.onEvent('translation:completed', (data) => {
      store.emit('translationCompleted', data);
    });

    this.onEvent('translation:failed', (data) => {
      store.emit('translationFailed', data);
    });

    // Renderização
    this.onEvent('render:progress', (data) => {
      store.emit('renderProgress', data);
    });

    this.onEvent('render:completed', (data) => {
      store.emit('renderCompleted', data);
    });

    this.onEvent('render:failed', (data) => {
      store.emit('renderFailed', data);
    });

    // Jobs/Fila
    this.onEvent('job:created', (data) => {
      store.emit('jobCreated', data);
      store.notify('info', `Novo job criado: ${data.job?.type || 'desconhecido'}`);
    });

    this.onEvent('job:started', (data) => {
      store.emit('jobStarted', data);
    });

    this.onEvent('job:completed', (data) => {
      store.emit('jobCompleted', data);
    });

    this.onEvent('job:failed', (data) => {
      store.emit('jobFailed', data);
      store.notify('error', `Job falhou: ${data.error?.message || 'erro desconhecido'}`);
    });

    this.onEvent('queue:updated', (data) => {
      store.emit('queueUpdated', data);
    });

    // Segmentos (sincronização entre clientes)
    this.onEvent('segment:updated', (data) => {
      store.emit('segmentUpdated', data);
    });

    this.onEvent('segment:created', (data) => {
      store.emit('segmentCreated', data);
    });

    this.onEvent('segment:deleted', (data) => {
      store.emit('segmentDeleted', data);
    });

    // Sistema
    this.onEvent('system:status', (data) => {
      store.set('system.gpuAvailable', data.gpuAvailable);
      store.set('system.cudaVersion', data.cudaVersion);
      store.set('system.memoryUsage', data.memoryUsage);
      store.emit('systemStatus', data);
    });

    this.onEvent('system:ready', (data) => {
      store.set('app.systemStatus', 'ready');
      store.emit('systemReady', data);
    });

    // Logs em tempo real
    this.onEvent('log:new', (data) => {
      store.emit('logNew', data);
    });
  }

  /**
   * Registra listener para evento específico
   * @param {string} event - Nome do evento
   * @param {Function} callback - Callback
   */
  onEvent(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove listener de evento
   * @param {string} event - Nome do evento
   * @param {Function} callback - Callback
   */
  offEvent(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Envia evento para o servidor
   * @param {string} event - Nome do evento
   * @param {any} data - Dados do evento
   * @param {Function} callback - Callback de acknowledge (opcional)
   */
  emit(event, data, callback) {
    if (!this.socket || !this.connected) {
      console.warn(`[Socket] Não conectado, evento "${event}" não enviado`);
      if (callback) callback(new Error('Não conectado'));
      return false;
    }

    this.socket.emit(event, data, callback);
    return true;
  }

  /**
   * Envia evento e aguarda resposta (promise-based)
   * @param {string} event - Nome do evento
   * @param {any} data - Dados do evento
   * @param {number} timeout - Timeout em ms
   * @returns {Promise<any>} Resposta do servidor
   */
  emitWithAck(event, data, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Não conectado'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout aguardando resposta do servidor'));
      }, timeout);

      this.socket.emit(event, data, (response) => {
        clearTimeout(timeoutId);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Inicia heartbeat para manter conexão ativa
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
        
        // Aguarda pong
        this.pongTimeout = setTimeout(() => {
          console.warn('[Socket] Pong não recebido, reconectando...');
          this.socket.disconnect();
          this.socket.connect();
        }, 5000);
      }
    }, 15000);

    // Listener de pong
    this.onEvent('pong', () => {
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
    });
  }

  /**
   * Para heartbeat
   */
  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * Desconecta do servidor
   */
  disconnect() {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.off();
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.emit('disconnected', 'manual');
  }

  /**
   * Verifica se está conectado
   * @returns {boolean} Se está conectado
   */
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  /**
   * Reconecta ao servidor
   * @returns {Promise<boolean>} Se reconectou com sucesso
   */
  async reconnect() {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.connect();
  }

  /**
   * Entra em room específica
   * @param {string} room - Nome da room
   */
  joinRoom(room) {
    this.emit('room:join', { room });
  }

  /**
   * Sai de room específica
   * @param {string} room - Nome da room
   */
  leaveRoom(room) {
    this.emit('room:leave', { room });
  }

  /**
   * Obtém estatísticas da conexão
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id,
      serverUrl: this.socket?.io?.uri
    };
  }
}

// Exporta instância singleton
export const socket = new SocketClient();
export default socket;
