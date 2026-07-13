/**
 * API Client - Comunicação com o Backend
 */

const API_BASE = '/api';

// Estado da conexão Socket
let socket = null;

export function initSocket(onProgress, onStatusChange) {
    // Em produção, usaria window.location.host
    socket = io();

    socket.on('connect', () => {
        console.log('Socket conectado');
        if (onStatusChange) onStatusChange(true);
    });

    socket.on('disconnect', () => {
        console.log('Socket desconectado');
        if (onStatusChange) onStatusChange(false);
    });

    socket.on('job-progress', (data) => {
        if (onProgress) onProgress(data);
    });

    socket.on('job-complete', (data) => {
        if (onProgress) onProgress({ ...data, progress: 100, status: 'completed' });
    });

    return socket;
}

export function getSocket() {
    return socket;
}

// Helper para requisições HTTP
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro na requisição' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    // Se não tiver conteúdo, retorna null
    if (response.status === 204) return null;

    return response.json();
}

// --- Configurações ---
export async function getConfiguracoes() {
    return request('/configuracoes');
}

export async function saveConfiguracoes(config) {
    return request('/configuracoes', { method: 'PUT', body: JSON.stringify(config) });
}

// --- Jobs ---
export async function getJobs() {
    return request('/jobs');
}

export async function getJob(id) {
    return request(`/jobs/${id}`);
}

export async function cancelJob(id) {
    return request(`/jobs/${id}/cancel`, { method: 'POST' });
}

export async function deleteJob(id) {
    return request(`/jobs/${id}`, { method: 'DELETE' });
}

// --- Transcrição ---
export async function startTranscription(formData) {
    // FormData não usa Content-Type application/json
    const response = await fetch(`${API_BASE}/transcricao`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao iniciar transcrição' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}

export async function getTranscriptionData(jobId) {
    return request(`/transcricao/${jobId}`);
}

export async function saveTranscription(jobId, segments) {
    return request(`/transcricao/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify({ segments })
    });
}

export async function exportSubtitle(jobId, format = 'srt') {
    // Retorna o blob do arquivo
    const response = await fetch(`${API_BASE}/transcricao/${jobId}/export?format=${format}`);
    if (!response.ok) throw new Error('Erro ao exportar legenda');
    return response.blob();
}

// --- Vídeo ---
export function getVideoStreamUrl(videoId) {
    return `${API_BASE}/video/stream/${videoId}`;
}

export async function downloadFile(type, id) {
    const response = await fetch(`${API_BASE}/video/download/${type}/${id}`);
    if (!response.ok) throw new Error('Erro ao baixar arquivo');
    return response.blob();
}
