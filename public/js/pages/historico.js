/**
 * Página: Histórico de Jobs
 */

import { getJobs, deleteJob, cancelJob } from '../api.js';
import { showModal } from '../layout.js';

export default {
    render() {
        return `
            <div class="card">
                <div class="card-header">
                    <h3>Histórico de Transcrições</h3>
                    <button class="btn btn-secondary" onclick="loadHistorico()">
                        <i class="ph ph-arrows-clockwise"></i> Atualizar
                    </button>
                </div>
                <div id="historico-list">
                    <div class="loading-screen"><i class="ph ph-spinner ph-spin"></i></div>
                </div>
            </div>
        `;
    },

    init() {
        loadHistorico();
    }
};

export async function loadHistorico() {
    const container = document.getElementById('historico-list');
    if (!container) return;

    try {
        const jobs = await getJobs();
        
        if (jobs.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Nenhum job no histórico.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align:left; color:var(--text-muted); border-bottom:1px solid var(--border);">
                        <th style="padding:0.5rem;">ID</th>
                        <th style="padding:0.5rem;">Arquivo</th>
                        <th style="padding:0.5rem;">Engine</th>
                        <th style="padding:0.5rem;">Status</th>
                        <th style="padding:0.5rem;">Data</th>
                        <th style="padding:0.5rem;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${jobs.map(job => `
                        <tr style="border-bottom:1px solid var(--border);">
                            <td style="padding:0.75rem 0.5rem;">#${job.id}</td>
                            <td style="padding:0.75rem 0.5rem;">${job.filename || '-'}</td>
                            <td style="padding:0.75rem 0.5rem;">${job.engine || '-'}</td>
                            <td style="padding:0.75rem 0.5rem;">
                                <span class="status-badge status-${job.status}">${job.status}</span>
                            </td>
                            <td style="padding:0.75rem 0.5rem;">${new Date(job.created_at).toLocaleDateString()}</td>
                            <td style="padding:0.75rem 0.5rem;">
                                ${job.status === 'completed' ? `
                                    <button class="btn-icon" title="Editar" onclick="editJob(${job.id})">
                                        <i class="ph ph-pencil-simple"></i>
                                    </button>
                                    <button class="btn-icon" title="Baixar SRT" onclick="downloadSrt(${job.id})">
                                        <i class="ph ph-download-simple"></i>
                                    </button>
                                ` : ''}
                                ${['processing', 'queued'].includes(job.status) ? `
                                    <button class="btn-icon" title="Cancelar" onclick="cancelJobAction(${job.id})">
                                        <i class="ph ph-stop-circle"></i>
                                    </button>
                                ` : ''}
                                <button class="btn-icon" title="Excluir" onclick="deleteJobAction(${job.id})">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-center text-danger">Erro: ${err.message}</p>`;
    }
}

// Funções globais para acesso via onclick
window.editJob = (id) => {
    if (window.navigateToPage) {
        window.navigateToPage('editor', id);
    }
};

window.downloadSrt = async (id) => {
    try {
        const { exportSubtitle } = await import('../api.js');
        const blob = await exportSubtitle(id, 'srt');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legenda_${id}.srt`;
        a.click();
        URL.revokeObjectURL(url);
        window.showNotification('Download iniciado!', 'success');
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
};

window.cancelJobAction = async (id) => {
    showModal('Cancelar Job', 'Tem certeza que deseja cancelar este processamento?', [
        { id: 'cancel', label: 'Cancelar', class: 'btn-secondary' },
        { id: 'confirm', label: 'Sim, Cancelar', class: 'btn-danger', onClick: () => doCancelJob(id) }
    ]);
};

async function doCancelJob(id) {
    try {
        await cancelJob(id);
        window.showNotification('Job cancelado com sucesso', 'success');
        loadHistorico();
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
}

window.deleteJobAction = async (id) => {
    showModal('Excluir Job', 'Tem certeza que deseja excluir este job? Esta ação não pode ser desfeita.', [
        { id: 'cancel', label: 'Não', class: 'btn-secondary' },
        { id: 'confirm', label: 'Sim, Excluir', class: 'btn-danger', onClick: () => doDeleteJob(id) }
    ]);
};

async function doDeleteJob(id) {
    try {
        await deleteJob(id);
        window.showNotification('Job excluído com sucesso', 'success');
        loadHistorico();
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
}
