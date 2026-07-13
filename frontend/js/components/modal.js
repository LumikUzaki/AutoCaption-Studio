/**
 * Modal Component - Modais reutilizáveis
 * Componente para exibir diálogos e confirmações
 */

import { createElement, clearChildren, sanitizeString } from '../utils.js';

export class ModalComponent {
  constructor() {
    this.modal = null;
    this.onCloseCallback = null;
  }

  /**
   * Cria e mostra modal
   * @param {Object} options - Opções do modal
   * @returns {Promise} Promise resolvida ao fechar
   */
  show(options = {}) {
    return new Promise((resolve) => {
      this.onCloseCallback = resolve;
      
      // Fecha modal existente se houver
      if (this.modal) {
        this.close();
      }

      const {
        title = '',
        content = '',
        buttons = [],
        size = 'medium', // small, medium, large
        closable = true,
        onClose
      } = options;

      this.modal = createElement('div', {
        className: 'modal-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'modal-title'
      }, [
        createElement('div', {
          className: `modal modal-${size}`
        }, [
          // Header
          createElement('div', { className: 'modal-header' }, [
            createElement('h2', { 
              id: 'modal-title',
              className: 'modal-title' 
            }, [title]),
            closable ? createElement('button', {
              className: 'modal-close',
              onClick: () => this.close(),
              'aria-label': 'Fechar'
            }, ['×']) : null
          ]),
          
          // Body
          createElement('div', { className: 'modal-body' }, [
            typeof content === 'string' 
              ? createElement('div', { innerHTML: sanitizeString(content) })
              : content
          ]),
          
          // Footer com botões
          buttons.length > 0 ? createElement('div', { className: 'modal-footer' }, [
            buttons.map(btn => createElement('button', {
              className: `btn ${btn.variant ? `btn-${btn.variant}` : 'btn-secondary'} ${btn.className || ''}`,
              onClick: () => {
                if (btn.onClick) btn.onClick();
                if (btn.close !== false) this.close();
              },
              disabled: btn.disabled || false
            }, [btn.text || 'OK']))
          ]) : null
        ])
      ]);

      // Clique fora fecha o modal
      if (closable) {
        this.modal.addEventListener('click', (e) => {
          if (e.target === this.modal) {
            this.close();
          }
        });
      }

      // Tecla ESC fecha o modal
      const handleEsc = (e) => {
        if (e.key === 'Escape' && closable) {
          this.close();
        }
      };
      document.addEventListener('keydown', handleEsc);

      // Adiciona ao DOM
      document.body.appendChild(this.modal);
      
      // Animação de entrada
      requestAnimationFrame(() => {
        this.modal.classList.add('modal-enter');
        
        // Foca no primeiro botão ou input
        const focusable = this.modal.querySelector('button, input, select, textarea');
        if (focusable) {
          setTimeout(() => focusable.focus(), 100);
        }
      });

      // Armazena handler de ESC para remover depois
      this.escHandler = handleEsc;
    });
  }

  /**
   * Fecha o modal
   */
  close() {
    if (!this.modal) return;

    this.modal.classList.remove('modal-enter');
    this.modal.classList.add('modal-exit');

    this.modal.addEventListener('animationend', () => {
      if (this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      
      // Remove listener de ESC
      if (this.escHandler) {
        document.removeEventListener('keydown', this.escHandler);
        this.escHandler = null;
      }
      
      this.modal = null;
      
      // Callback de fechamento
      if (this.onCloseCallback) {
        this.onCloseCallback();
        this.onCloseCallback = null;
      }
    }, { once: true });
  }

  /**
   * Mostra modal de confirmação
   * @param {Object} options - Opções
   * @returns {Promise<boolean>} Se confirmou
   */
  async confirm(options = {}) {
    const {
      title = 'Confirmação',
      message = 'Tem certeza?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      variant = 'primary'
    } = options;

    return new Promise((resolve) => {
      this.show({
        title,
        content: `<p>${sanitizeString(message)}</p>`,
        buttons: [
          {
            text: cancelText,
            variant: 'secondary',
            onClick: () => resolve(false)
          },
          {
            text: confirmText,
            variant,
            onClick: () => resolve(true),
            close: true
          }
        ],
        onClose: () => resolve(false)
      });
    });
  }

  /**
   * Mostra modal de alerta
   * @param {Object} options - Opções
   * @returns {Promise<void>}
   */
  async alert(options = {}) {
    const {
      title = 'Aviso',
      message = '',
      buttonText = 'OK',
      variant = 'primary'
    } = options;

    return new Promise((resolve) => {
      this.show({
        title,
        content: `<p>${sanitizeString(message)}</p>`,
        buttons: [
          {
            text: buttonText,
            variant,
            onClick: () => resolve(),
            close: true
          }
        ]
      });
    });
  }

  /**
   * Mostra modal de prompt (input)
   * @param {Object} options - Opções
   * @returns {Promise<string|null>} Valor inserido ou null
   */
  async prompt(options = {}) {
    const {
      title = 'Entrada',
      message = '',
      placeholder = '',
      defaultValue = '',
      confirmText = 'OK',
      cancelText = 'Cancelar',
      validate
    } = options;

    return new Promise((resolve) => {
      const inputId = `prompt-input-${Date.now()}`;
      
      const content = createElement('div', {}, [
        message ? createElement('p', { className: 'mb-2' }, [message]) : null,
        createElement('input', {
          type: 'text',
          id: inputId,
          className: 'form-input',
          placeholder,
          value: defaultValue,
          style: 'width: 100%; margin-top: 8px;'
        })
      ]);

      this.show({
        title,
        content,
        buttons: [
          {
            text: cancelText,
            variant: 'secondary',
            onClick: () => resolve(null)
          },
          {
            text: confirmText,
            variant: 'primary',
            onClick: () => {
              const input = document.getElementById(inputId);
              const value = input.value.trim();
              
              if (validate && !validate(value)) {
                return; // Não fecha se validação falhar
              }
              
              resolve(value || null);
            },
            close: true
          }
        ],
        onClose: () => resolve(null)
      });

      // Foca no input após animação
      setTimeout(() => {
        const input = document.getElementById(inputId);
        if (input) {
          input.focus();
          input.select();
        }
      }, 150);
    });
  }

  /**
   * Verifica se modal está aberto
   * @returns {boolean}
   */
  isOpen() {
    return this.modal !== null;
  }
}

// Exporta instância singleton
export const modal = new ModalComponent();
export default modal;
