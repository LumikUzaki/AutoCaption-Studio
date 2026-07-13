/**
 * Página: Editor de Legendas
 */

import { getTranscriptionData, saveTranscription, exportSubtitle, getVideoStreamUrl } from '../api.js';
import { showModal } from '../layout.js';

let currentJobId = null;
let segments = [];
let videoElement = null;

export default {
    render(params) {
        currentJobId = params.jobId || params.id;
        
        return `
            <div class="editor-container" style="display:grid; grid-template-columns: 1fr 400px; gap:1rem; height:calc(100vh - 140px);">
                <!-- Player de Vídeo -->
                <div class="video-section" style="background:var(--bg-panel); border-radius:8px; overflow:hidden; display:flex; flex-direction:column;">
                    <video id="video-player" controls style="width:100%; max-height:60vh; background:#000;">
                        <source src="${getVideoStreamUrl(currentJobId)}" type="video/mp4">
                        Seu navegador não suporta vídeo.
                    </video>
                    <div class="video-controls-extra" style="padding:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button id="btn-play-pause" class="btn btn-secondary"><i class="ph ph-play"></i> Play/Pause</button>
                        <button id="btn-rewind" class="btn btn-secondary"><i class="ph ph-rewind"></i> -5s</button>
                        <button id="btn-forward" class="btn btn-secondary"><i class="ph ph-fast-forward"></i> +5s</button>
                        <span id="current-time" style="margin-left:auto; align-self:center; font-family:monospace;">00:00:00</span>
                    </div>
                </div>
                
                <!-- Lista de Segmentos -->
                <div class="segments-section" style="background:var(--bg-panel); border-radius:8px; overflow:hidden; display:flex; flex-direction:column;">
                    <div class="segments-header" style="padding:1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <h4>Legendas</h4>
                        <div style="display:flex; gap:0.5rem;">
                            <button id="btn-add-segment" class="btn btn-primary"><i class="ph ph-plus"></i></button>
                            <button id="btn-save" class="btn btn-success"><i class="ph ph-floppy-disk"></i> Salvar</button>
                            <button id="btn-export" class="btn btn-secondary"><i class="ph ph-download-simple"></i> Exportar</button>
                        </div>
                    </div>
                    <div id="segments-list" style="flex:1; overflow-y:auto; padding:0.5rem;">
                        <div class="loading-screen"><i class="ph ph-spinner ph-spin"></i></div>
                    </div>
                </div>
            </div>
            
            <!-- Modal de Exportação -->
            <dialog id="export-modal" class="modal">
                <div class="modal-content">
                    <header class="modal-header">
                        <h3>Exportar Legenda</h3>
                        <button class="btn-icon close-modal"><i class="ph ph-x"></i></button>
                    </header>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Formato</label>
                            <select id="export-format" class="form-control">
                                <option value="srt">SRT (SubRip)</option>
                                <option value="vtt">VTT (WebVTT)</option>
                                <option value="json">JSON (Completo)</option>
                            </select>
                        </div>
                    </div>
                    <footer class="modal-footer">
                        <button class="btn btn-secondary close-modal">Cancelar</button>
                        <button id="btn-confirm-export" class="btn btn-primary">Baixar</button>
                    </footer>
                </div>
            </dialog>
        `;
    },

    async init(params) {
        const jobId = params.jobId || params.id;
        if (jobId) {
            await loadSegments(jobId);
            setupVideoPlayer();
            setupSegmentControls();
        }
    }
};

async function loadSegments(jobId) {
    try {
        const data = await getTranscriptionData(jobId);
        segments = data.segments || [];
        renderSegments();
    } catch (err) {
        document.getElementById('segments-list').innerHTML = 
            `<p class="text-center text-danger">Erro: ${err.message}</p>`;
    }
}

function renderSegments() {
    const container = document.getElementById('segments-list');
    if (!container) return;

    if (segments.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Nenhuma legenda encontrada.</p>';
        return;
    }

    container.innerHTML = segments.map((seg, index) => `
        <div class="segment-item ${seg.highlight ? 'highlight' : ''}" data-index="${index}" 
             style="padding:0.75rem; margin-bottom:0.5rem; background:var(--bg-hover); border-radius:6px; border-left:3px solid ${seg.highlight ? 'var(--primary)' : 'transparent'}; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <span style="font-size:0.75rem; color:var(--text-muted);">#${index + 1}</span>
                <span style="font-size:0.75rem; color:var(--primary);">${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
            </div>
            <textarea class="segment-text" style="width:100%; background:transparent; border:none; color:var(--text-main); resize:none; font-size:0.9rem;" 
                      rows="2" data-index="${index}">${seg.text}</textarea>
            <div style="display:flex; gap:0.25rem; margin-top:0.5rem;">
                <button class="btn-icon btn-play-segment" data-index="${index}" title="Reproduzir deste ponto">
                    <i class="ph ph-play"></i>
                </button>
                <button class="btn-icon btn-delete-segment" data-index="${index}" title="Excluir" style="color:var(--danger);">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Adiciona listeners para edição
    container.querySelectorAll('.segment-text').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            segments[index].text = e.target.value;
        });
    });

    // Click para navegar no vídeo
    container.querySelectorAll('.segment-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const index = parseInt(item.dataset.index);
            seekTo(segments[index].start);
        });
    });

    // Botões de ação
    container.querySelectorAll('.btn-play-segment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            seekTo(segments[index].start);
        });
    });

    container.querySelectorAll('.btn-delete-segment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            deleteSegment(index);
        });
    });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

function setupVideoPlayer() {
    videoElement = document.getElementById('video-player');
    if (!videoElement) return;

    // Atualiza tempo atual
    videoElement.addEventListener('timeupdate', () => {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            timeEl.textContent = formatTime(videoElement.currentTime).replace(',', ':');
        }
        highlightCurrentSegment();
    });

    // Controles extras
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
        if (videoElement.paused) videoElement.play();
        else videoElement.pause();
    });

    document.getElementById('btn-rewind')?.addEventListener('click', () => {
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
    });

    document.getElementById('btn-forward')?.addEventListener('click', () => {
        videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 5);
    });
}

function seekTo(time) {
    if (videoElement) {
        videoElement.currentTime = time;
        videoElement.play();
    }
}

function highlightCurrentSegment() {
    if (!videoElement) return;
    const currentTime = videoElement.currentTime;
    
    segments.forEach((seg, index) => {
        const el = document.querySelector(`.segment-item[data-index="${index}"]`);
        if (el) {
            if (currentTime >= seg.start && currentTime <= seg.end) {
                el.classList.add('highlight');
                el.style.borderLeftColor = 'var(--primary)';
            } else {
                el.classList.remove('highlight');
                el.style.borderLeftColor = 'transparent';
            }
        }
    });
}

function setupSegmentControls() {
    document.getElementById('btn-add-segment')?.addEventListener('click', addSegment);
    document.getElementById('btn-save')?.addEventListener('click', saveSegments);
    document.getElementById('btn-export')?.addEventListener('click', showExportModal);
    document.getElementById('btn-confirm-export')?.addEventListener('click', doExport);
}

function addSegment() {
    const newSegment = {
        start: videoElement ? videoElement.currentTime : 0,
        end: (videoElement ? videoElement.currentTime : 0) + 2,
        text: 'Nova legenda...'
    };
    segments.push(newSegment);
    renderSegments();
}

function deleteSegment(index) {
    showModal('Excluir Legenda', 'Tem certeza que deseja excluir esta legenda?', [
        { id: 'no', label: 'Não', class: 'btn-secondary' },
        { id: 'yes', label: 'Sim, Excluir', class: 'btn-danger', onClick: () => {
            segments.splice(index, 1);
            renderSegments();
        }}
    ]);
}

async function saveSegments() {
    try {
        await saveTranscription(currentJobId, segments);
        window.showNotification('Legendas salvas com sucesso!', 'success');
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
}

function showExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) modal.showModal();
}

async function doExport() {
    const format = document.getElementById('export-format')?.value || 'srt';
    try {
        const blob = await exportSubtitle(currentJobId, format);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legenda_${currentJobId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        window.showNotification('Download iniciado!', 'success');
        document.getElementById('export-modal')?.close();
    } catch (err) {
        window.showNotification(err.message, 'error');
    }
}
