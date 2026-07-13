/**
 * EventEmitter - Sistema de eventos simples
 * Padrão Observer para comunicação entre módulos
 */

export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Registra listener para evento
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback
   * @returns {EventEmitter} Esta instância para chaining
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(listener);
    return this;
  }

  /**
   * Registra listener único (executa apenas uma vez)
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback
   * @returns {EventEmitter} Esta instância para chaining
   */
  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener.apply(this, args);
    };
    wrapper._originalListener = listener;
    return this.on(event, wrapper);
  }

  /**
   * Remove listener de evento
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback a remover
   * @returns {EventEmitter} Esta instância para chaining
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return this;
    }

    const listeners = this.events.get(event);
    
    if (!listener) {
      // Remove todos os listeners do evento
      this.events.delete(event);
    } else {
      // Remove listener específico
      const index = listeners.findIndex(l => 
        l === listener || l._originalListener === listener
      );
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // Limpa array vazio
      if (listeners.length === 0) {
        this.events.delete(event);
      }
    }
    
    return this;
  }

  /**
   * Emite evento com argumentos
   * @param {string} event - Nome do evento
   * @param {...any} args - Argumentos para o callback
   * @returns {boolean} Se há listeners para o evento
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false;
    }

    const listeners = this.events.get(event);
    
    // Copia array para evitar problemas se listener modificar a lista
    const listenersCopy = [...listeners];
    
    for (const listener of listenersCopy) {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Erro no listener do evento "${event}":`, error);
      }
    }
    
    return listeners.length > 0;
  }

  /**
   * Verifica se há listeners para evento
   * @param {string} event - Nome do evento
   * @returns {boolean} Se há listeners
   */
  hasListeners(event) {
    return this.events.has(event) && this.events.get(event).length > 0;
  }

  /**
   * Retorna número de listeners para evento
   * @param {string} event - Nome do evento
   * @returns {number} Número de listeners
   */
  listenerCount(event) {
    if (!this.events.has(event)) {
      return 0;
    }
    return this.events.get(event).length;
  }

  /**
   * Lista todos os eventos registrados
   * @returns {Array<string>} Array de nomes de eventos
   */
  eventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * Remove todos os listeners
   * @param {string} [event] - Evento específico (opcional)
   * @returns {EventEmitter} Esta instância para chaining
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Alias para on
   */
  addEventListener = this.on;

  /**
   * Alias para off
   */
  removeEventListener = this.off;

  /**
   * Alias para emit
   */
  dispatchEvent = this.emit;
}

export default EventEmitter;
