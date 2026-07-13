/**
 * Toast Component - Notificações flutuantes
 * Componente reutilizável para exibir notificações temporárias
 */

import { createElement, clearChildren } from '../utils.js';
import { store } from '../store.js';

export class ToastComponent {
  constructor(containerSelector = '#toast-container') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      this.container = this.createContainer();
    }
    
    // Limpa notificações antigas ao carregar
    clearChildren(this.container);
    
    // Renderiza notificações existentes no store
    const existingNotifications = store.get('notifications.list');
    existingNotifications.forEach(n => this.render(n));
    
    // Escuta novas notificações
    store.on('stateChanged:notifications.list', (list) => {
      this.sync(list);
    });
  }

  /**
   * Cria container de toasts se não existir
   * @returns {HTMLElement} Container criado
   */
  createContainer() {
    const container = createElement('div', {
      id: 'toast-container',
      className: 'toast-container'
    });
    document.body.appendChild(container);
    return container;
  }

  /**
   * Sincroniza toasts com o estado do store
   * @param {Array} notifications - Lista de notificações
   */
  sync(notifications) {
    const currentIds = Array.from(this.container.children).map(el => el.dataset.id);
    const notificationIds = notifications.map(n => n.id);
    
    // Remove toasts que não existem mais
    currentIds.forEach(id => {
      if (!notificationIds.includes(id)) {
        const toast = this.container.querySelector(`[data-id="${id}"]`);
        if (toast) {
          this.remove(toast);
        }
      }
    });
    
    // Adiciona novos toasts
    notifications.forEach(notification => {
      if (!currentIds.includes(notification.id)) {
        this.render(notification);
      }
    });
  }

  /**
   * Renderiza um toast
   * @param {Object} notification - Dados da notificação
   * @returns {HTMLElement} Elemento toast criado
   */
  render(notification) {
    const toast = createElement('div', {
      className: `toast toast-${notification.type}`,
      dataset: { id: notification.id }
    }, [
      createElement('div', { className: 'toast-icon' }, [
        this.getIcon(notification.type)
      ]),
      createElement('div', { className: 'toast-content' }, [
        createElement('div', { className: 'toast-message' }, [notification.message])
      ]),
      createElement('button', {
        className: 'toast-close',
        onClick: () => store.dismissNotification(notification.id)
      }, ['×'])
    ]);

    // Animação de entrada
    requestAnimationFrame(() => {
      toast.classList.add('toast-enter');
    });

    this.container.appendChild(toast);
    return toast;
  }

  /**
   * Remove toast com animação
   * @param {HTMLElement} toast - Elemento toast
   */
  remove(toast) {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, { once: true });
  }

  /**
   * Obtém ícone baseado no tipo
   * @param {string} type - Tipo de notificação
   * @returns {string} HTML do ícone
   */
  getIcon(type) {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    return icons[type] || icons.info;
  }

  /**
   * Mostra notificação de sucesso
   * @param {string} message - Mensagem
   */
  success(message) {
    store.notify('success', message);
  }

  /**
   * Mostra notificação de erro
   * @param {string} message - Mensagem
   */
  error(message) {
    store.notify('error', message);
  }

  /**
   * Mostra notificação de aviso
   * @param {string} message - Mensagem
   */
  warning(message) {
    store.notify('warning', message);
  }

  /**
   * Mostra notificação de informação
   * @param {string} message - Mensagem
   */
  info(message) {
    store.notify('info', message);
  }
}

export default ToastComponent;
