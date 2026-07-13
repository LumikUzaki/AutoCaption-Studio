/**
 * Página: Processamento em Tempo Real
 */

import { getJob, cancelJob } from '../api.js';
import { showModal } from '../layout.js';

let currentJobId = null;
let progressListener = null;

export default {
    render(params) {
        currentJobId = params.jobId || params.id;
        
        return `
            <div class="card">
                <h3>Processamento em Andamento</h3>
                <p class="text-muted mb-2">Acompanhe o progresso da transcrição em tempo real.</p>
                
                <div id="job-info" class="mb-2">
                    <div class="loading-screen"><i class="ph ph-spinner ph-spin"></i></div>
                </div>
                
                <div class="progress-container" style="margin: 1.5rem 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <span>Progresso</span>
                        <span id="progress-percent">0%</span>
                    </div>
                    <div style="background:var(--bg-hover); border-radius:8px; height:24px; overflow:hidden;">
                        <div id="progress-bar" style="background:var(--primary); height:100%; width:0%; transition:width 0.5s;"></div>
                    </div>
                </div>
                
                <div id="status-log" style="background:var(--bg-dark); padding:1rem; border-radius:8px; max-height:200px; overflow-y:auto; font-family:monospace; font-size:0.85rem;">
                    <p class="text-muted">Aguardando atualizações...</p>
                </div>
                
                <div class="mt-2" style="display:flex; gap:0.5rem;">
                    <button id="btn-cancel" class="btn btn-danger">
                        <i class="ph ph-stop-circle"></i> Cancelar
                    </button>
                    <button id="btn-refresh" class="btn btn-secondary">
                        <i class="ph ph-arrows-clockwise"></i> Atualizar
                    </button>
                </div>
            </div>
        `;
    },

    init(params) {
        const jobId = params.jobId || params.id;
        if (jobId) {
            loadJobInfo(jobId);
            setupProgressListener(jobId);
        }

        document.getElementById('btn-refresh')?.addEventListener('click', () => {
            loadJobInfo(jobId);
        });

        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            confirmCancel(jobId);
        });
    }
};

async function loadJobInfo(jobId) {
    const container = document.getElementById('job-info');
    try {
        const job = await getJob(jobId);
        
        container.innerHTML = `
            <p><strong>Arquivo:</strong> ${job.filename || '-'}</p>
            <p><strong>Engine:</strong> ${job.engine || '-'}</p>
            <p><strong>Modelo:</strong> ${job.model || '-'}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${job.status}">${job.status}</span></p>
        `;

        // Atualiza barra de progresso se houver
        if (job.progress !== undefined) {
            updateProgress(job.progress, job.status_message || job.status);
        }

        if (job.status === 'completed') {
            addLogEntry('Transcrição concluída com sucesso!');
            setTimeout(() => {
                if (window.navigateToPage) window.navigateToPage('editor', jobId);
            }, 2000);
        } else if (job.status === 'failed') {
            addLogEntry(`Erro: ${job.error || 'Falha no processamento'}`);
        }
    } catch (err) {
        container.innerHTML = `<p class="text-danger">Erro ao carregar: ${err.message}</p>`;
    }
}

function setupProgressListener(jobId) {
    // Remove listener anterior se existir
    if (progressListener) {
        window.removeEventListener('job-progress', progressListener);
    }

    progressListener = (e) => {
        const data = e.detail;
        if (data.jobId === jobId || data.id === jobId) {
            updateProgress(data.progress, data.status_message || data.status);
            if (data.log) addLogEntry(data.log);
        }
    };

    window.addEventListener('job-progress', progressListener);
}

function updateProgress(percent, message) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-percent');
    
    if (bar) bar.style.width = `${Math.min(100, percent)}%`;
    if (text) text.textContent = `${Math.round(percent)}%`;
    
    if (message) addLogEntry(message);
}

function addLogEntry(message) {
    const log = document.getElementById('status-log');
    if (!log) return;
    
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('p');
    entry.textContent = `[${time}] ${message}`;
    entry.style.margin = '0.25rem 0';
    
    // Mantém apenas últimas 50 linhas
    while (log.children.length > 50) {
        log.removeChild(log.firstChild);
    }
    
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function confirmCancel(jobId) {
    showModal('Cancelar Processamento', 'Tem certeza que deseja cancelar? O progresso será perdido.', [
        { id: 'no', label: 'Não', class: 'btn-secondary' },
        { id: 'yes', label: 'Sim, Cancelar', class: 'btn-danger', onClick: () => doCancel(jobId) }
    ]);
}

async function doCancel(jobId) {
    try {
        await cancelJob(jobId);
        window.showNotification('Processamento cancelado', 'success');
        addLogEntry('Processamento cancelado pelo usuário.');
        
        setTimeout(() => {
            if (window.navigateToPage) window.navigateToPage('historico');
        }, 1500);
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
}
