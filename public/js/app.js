/**
 * App Entry Point - Inicialização da Aplicação
 */

import { initLayout, navigateTo } from './layout.js';
import { initSocket } from './api.js';

// Estado global da aplicação
window.appState = {
    socketConnected: false,
    currentJob: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Legendas Pro - Iniciando...');

    // Inicializa layout e navegação
    initLayout();

    // Inicializa Socket.io para progresso em tempo real
    initSocket(
        (data) => {
            // Callback de progresso - dispatch custom event para páginas ouvirem
            window.dispatchEvent(new CustomEvent('job-progress', { detail: data }));
        },
        (connected) => {
            window.appState.socketConnected = connected;
            updateConnectionStatus(connected);
        }
    );

    // Navega para dashboard inicial
    navigateTo('dashboard');

    // Setup global error handler
    window.addEventListener('error', (e) => {
        console.error('Erro global:', e.error);
    });
});

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.classList.toggle('connected', connected);
        statusEl.title = connected ? 'Conectado ao servidor' : 'Desconectado';
    }
}

// Exporta funções globais úteis para as páginas
window.showNotification = (message, type = 'info') => {
    // Implementação simples de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        padding: 1rem 1.5rem; border-radius: 8px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white; z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
};
