/**
 * Página: Dashboard
 */

import { getJobs } from '../api.js';

export default {
    render() {
        return `
            <div class="dashboard-grid">
                <div class="card stats-card">
                    <h3>Total de Jobs</h3>
                    <p class="stat-number" id="stat-total">-</p>
                </div>
                <div class="card stats-card">
                    <h3>Em Processamento</h3>
                    <p class="stat-number" id="stat-processing">-</p>
                </div>
                <div class="card stats-card">
                    <h3>Concluídos</h3>
                    <p class="stat-number" id="stat-completed">-</p>
                </div>
            </div>

            <div class="card mt-2">
                <div class="card-header">
                    <h3>Jobs Recentes</h3>
                    <button class="btn btn-primary" onclick="window.location.hash='upload'">
                        <i class="ph ph-plus"></i> Novo Upload
                    </button>
                </div>
                <div id="recent-jobs-list">
                    <div class="loading-screen"><i class="ph ph-spinner ph-spin"></i></div>
                </div>
            </div>
        `;
    },

    async init() {
        await loadJobs();
        
        // Escuta atualizações em tempo real
        window.addEventListener('job-progress', handleJobProgress);
    }
};

async function loadJobs() {
    try {
        const jobs = await getJobs();
        updateStats(jobs);
        renderRecentJobs(jobs.slice(0, 5));
    } catch (err) {
        document.getElementById('recent-jobs-list').innerHTML = 
            `<p class="text-center text-muted">Erro ao carregar jobs: ${err.message}</p>`;
    }
}

function updateStats(jobs) {
    const total = jobs.length;
    const processing = jobs.filter(j => ['processing', 'queued'].includes(j.status)).length;
    const completed = jobs.filter(j => j.status === 'completed').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-processing').textContent = processing;
    document.getElementById('stat-completed').textContent = completed;
}

function renderRecentJobs(jobs) {
    const container = document.getElementById('recent-jobs-list');
    
    if (jobs.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Nenhum job encontrado.</p>';
        return;
    }

    container.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="text-align:left; color:var(--text-muted); border-bottom:1px solid var(--border);">
                    <th style="padding:0.5rem;">Nome</th>
                    <th style="padding:0.5rem;">Status</th>
                    <th style="padding:0.5rem;">Data</th>
                    <th style="padding:0.5rem;">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${jobs.map(job => `
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:0.75rem 0.5rem;">${job.filename || 'Desconhecido'}</td>
                        <td style="padding:0.75rem 0.5rem;">
                            <span class="status-badge status-${job.status}">${job.status}</span>
                        </td>
                        <td style="padding:0.75rem 0.5rem;">${new Date(job.created_at).toLocaleDateString()}</td>
                        <td style="padding:0.75rem 0.5rem;">
                            ${job.status === 'completed' ? 
                                `<button class="btn-icon" onclick="window.navigateToPage('editor', ${job.id})" title="Editar">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>` : 
                                `<button class="btn-icon" onclick="window.navigateToPage('processamento', ${job.id})" title="Ver Progresso">
                                    <i class="ph ph-eye"></i>
                                </button>`
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function handleJobProgress(e) {
    // Recarrega jobs quando há atualização
    loadJobs();
}

// Estilos específicos da página
const style = document.createElement('style');
style.textContent = `
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .stats-card { text-align: center; }
    .stat-number { font-size: 2.5rem; font-weight: 700; color: var(--primary); margin-top: 0.5rem; }
    .status-badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; }
    .status-completed { background: rgba(16,185,129,0.2); color: #10b981; }
    .status-processing { background: rgba(59,130,246,0.2); color: #3b82f6; }
    .status-queued { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .status-failed { background: rgba(239,68,68,0.2); color: #ef4444; }
`;
document.head.appendChild(style);
