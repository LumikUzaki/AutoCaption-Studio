/**
 * Legendas Pro - Aplicação Frontend
 * Gerencia navegação, upload, edição e comunicação com o backend
 */

// ============================================
// Estado Global
// ============================================

const state = {
  currentVideo: null,
  currentTranscricao: null,
  segmentos: [],
  isPlaying: false,
  zoom: 1,
  socket: null
};

// ============================================
// Inicialização
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  initNavigation();
  initUpload();
  initEditor();
  initModals();
  loadVideos();
  loadConfiguracoes();
  checkServerStatus();
  
  // Atualizar lista de vídeos periodicamente
  setInterval(loadVideos, 30000);
});

// ============================================
// Socket.IO
// ============================================

function initSocket() {
  state.socket = io();
  
  state.socket.on('connect', () => {
    console.log('✅ Conectado ao servidor via WebSocket');
    updateServerStatus(true);
  });
  
  state.socket.on('disconnect', () => {
    console.log('❌ Desconectado do servidor');
    updateServerStatus(false);
  });
  
  state.socket.on('progress-update', (data) => {
    console.log('Progresso:', data);
    showToast(`Progresso: ${data.progress}%`, 'info');
  });
}

function updateServerStatus(online) {
  const statusEl = document.getElementById('serverStatus');
  statusEl.textContent = online ? '🟢 Online' : '🔴 Offline';
  statusEl.style.color = online ? 'var(--success)' : 'var(--danger)';
}

function checkServerStatus() {
  fetch('/api/health')
    .then(res => res.json())
    .then(data => {
      updateServerStatus(data.status === 'ok');
    })
    .catch(() => {
      updateServerStatus(false);
    });
}

// ============================================
// Navegação
// ============================================

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remover active de todos
      navLinks.forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      
      // Adicionar active ao clicado
      link.classList.add('active');
      const pageId = link.dataset.page;
      document.getElementById(pageId).classList.add('active');
      
      // Carregar dados específicos da página
      if (pageId === 'dashboard') loadVideos();
      if (pageId === 'historico') loadHistorico();
      if (pageId === 'configuracoes') loadConfiguracoes();
    });
  });
}

// ============================================
// Upload de Vídeos
// ============================================

function initUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const videoInput = document.getElementById('videoInput');
  
  // Click para selecionar arquivo
  uploadArea.addEventListener('click', () => {
    videoInput.click();
  });
  
  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadVideo(files[0]);
    }
  });
  
  // Input file change
  videoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadVideo(e.target.files[0]);
    }
  });
}

async function uploadVideo(file) {
  const formData = new FormData();
  formData.append('video', file);
  
  try {
    showToast('Iniciando upload...', 'info');
    
    const response = await fetch('/api/videos/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showToast('Vídeo enviado com sucesso!', 'success');
      loadVideos();
    } else {
      showToast(result.error || 'Erro no upload', 'error');
    }
  } catch (error) {
    console.error('Erro no upload:', error);
    showToast('Erro ao enviar vídeo', 'error');
  }
}

// ============================================
// Lista de Vídeos
// ============================================

async function loadVideos() {
  try {
    const response = await fetch('/api/videos?limit=50&offset=0');
    const result = await response.json();
    
    if (result.success) {
      renderVideos(result.data);
    }
  } catch (error) {
    console.error('Erro ao carregar vídeos:', error);
  }
}

function renderVideos(videos) {
  const grid = document.getElementById('videosGrid');
  
  if (videos.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhum vídeo encontrado. Faça upload de um vídeo para começar.</p>';
    return;
  }
  
  grid.innerHTML = videos.map(video => `
    <div class="video-card" data-id="${video.id}">
      <div class="video-thumbnail">🎬</div>
      <div class="video-info">
        <h4 class="video-title">${escapeHtml(video.original_name)}</h4>
        <p class="video-meta">${formatFileSize(video.filesize)} • ${video.mimetype.split('/')[1].toUpperCase()}</p>
        <span class="video-status ${video.status}">${translateStatus(video.status)}</span>
        <div class="video-actions">
          ${video.status === 'pending' || video.status === 'failed' ? 
            `<button class="btn btn-sm btn-primary" onclick="openTranscricaoModal('${video.id}')">📝 Transcrever</button>` : 
            `<button class="btn btn-sm btn-success" onclick="openEditor('${video.id}')">✏️ Editar</button>`
          }
          <button class="btn btn-sm btn-danger" onclick="deleteVideo('${video.id}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================
// Modal de Transcrição
// ============================================

function initModals() {
  const modal = document.getElementById('transcricaoModal');
  const closeBtn = document.getElementById('closeTranscricaoModal');
  const cancelBtn = document.getElementById('cancelTranscricao');
  const startBtn = document.getElementById('startTranscricao');
  
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  startBtn.addEventListener('click', startTranscricao);
}

function openTranscricaoModal(videoId) {
  document.getElementById('videoIdInput').value = videoId;
  document.getElementById('transcricaoModal').classList.add('active');
}

async function startTranscricao() {
  const videoId = document.getElementById('videoIdInput').value;
  const engine = document.getElementById('engineSelect').value;
  const model = document.getElementById('modelSelect').value;
  const device = document.getElementById('deviceSelect').value;
  const language = document.getElementById('languageSelect').value;
  
  try {
    const response = await fetch(`/api/transcricoes/${videoId}/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine, model, device, language })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showToast('Transcrição iniciada!', 'success');
      document.getElementById('transcricaoModal').classList.remove('active');
      loadVideos();
    } else {
      showToast(result.error || 'Erro ao iniciar transcrição', 'error');
    }
  } catch (error) {
    console.error('Erro:', error);
    showToast('Erro ao iniciar transcrição', 'error');
  }
}

// ============================================
// Editor
// ============================================

function initEditor() {
  const videoPlayer = document.getElementById('videoPlayer');
  
  // Atualizar tempo atual
  videoPlayer.addEventListener('timeupdate', () => {
    document.getElementById('currentTime').textContent = formatTime(videoPlayer.currentTime);
    highlightCurrentSubtitle(videoPlayer.currentTime);
  });
  
  // Atualizar tempo total
  videoPlayer.addEventListener('loadedmetadata', () => {
    document.getElementById('totalTime').textContent = formatTime(videoPlayer.duration);
  });
  
  // Play/Pause button
  document.getElementById('playPauseBtn').addEventListener('click', () => {
    if (videoPlayer.paused) {
      videoPlayer.play();
      document.getElementById('playPauseBtn').textContent = '⏸️ Pause';
    } else {
      videoPlayer.pause();
      document.getElementById('playPauseBtn').textContent = '▶️ Play';
    }
  });
  
  // Zoom controls
  document.getElementById('zoomIn').addEventListener('click', () => {
    state.zoom = Math.min(state.zoom + 0.1, 2);
    renderTimeline();
  });
  
  document.getElementById('zoomOut').addEventListener('click', () => {
    state.zoom = Math.max(state.zoom - 0.1, 0.5);
    renderTimeline();
  });
  
  // Export subtitle
  document.getElementById('exportSubtitle').addEventListener('click', exportSubtitle);
}

async function openEditor(videoId) {
  try {
    const response = await fetch(`/api/videos/${videoId}`);
    const result = await response.json();
    
    if (result.success) {
      state.currentVideo = result.data;
      
      // Carregar vídeo no player
      const videoPlayer = document.getElementById('videoPlayer');
      videoPlayer.src = `/uploads/${result.data.filename}`;
      
      // Carregar transcrição
      await loadTranscricao(result.data.transcricao_id);
      
      // Navegar para página do editor
      document.querySelector('[data-page="editor"]').click();
      
      showToast('Editor carregado!', 'success');
    }
  } catch (error) {
    console.error('Erro ao abrir editor:', error);
    showToast('Erro ao abrir editor', 'error');
  }
}

async function loadTranscricao(transcricaoId) {
  try {
    const response = await fetch(`/api/transcricoes/${transcricaoId}`);
    const result = await response.json();
    
    if (result.success) {
      state.currentTranscricao = result.data;
      state.segmentos = result.data.segmentos || [];
      
      renderSubtitles();
      renderTimeline();
    }
  } catch (error) {
    console.error('Erro ao carregar transcrição:', error);
  }
}

function renderSubtitles() {
  const list = document.getElementById('subtitlesList');
  
  if (state.segmentos.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhuma legenda encontrada.</p>';
    return;
  }
  
  list.innerHTML = state.segmentos.map((seg, index) => `
    <div class="subtitle-item" data-index="${index}">
      <div class="subtitle-time">
        <input type="text" value="${formatTime(seg.start_time)}" onchange="updateSegmentTime(${index}, 'start', this.value)" style="width: 80px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 4px; border-radius: 4px;">
        <span> → </span>
        <input type="text" value="${formatTime(seg.end_time)}" onchange="updateSegmentTime(${index}, 'end', this.value)" style="width: 80px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 4px; border-radius: 4px;">
      </div>
      <textarea class="subtitle-text" onchange="updateSegmentText(${index}, this.value)">${escapeHtml(seg.text)}</textarea>
      <div class="subtitle-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteSegment(${index})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  
  if (state.segmentos.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Nenhum segmento na timeline</p>';
    return;
  }
  
  const totalWidth = 100 * state.zoom;
  
  container.innerHTML = `
    <div style="position: relative; width: ${totalWidth}%; min-height: 60px; background: var(--bg-tertiary); border-radius: 4px;">
      ${state.segmentos.map((seg, index) => {
        const left = (seg.start_time / 60) * 100 * state.zoom;
        const width = ((seg.end_time - seg.start_time) / 60) * 100 * state.zoom;
        
        return `
          <div style="position: absolute; left: ${left}%; width: ${width}%; height: 40px; background: var(--accent-primary); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; color: #000; overflow: hidden; white-space: nowrap; cursor: pointer;" 
               onclick="seekTo(${seg.start_time})"
               title="${escapeHtml(seg.text)}">
            ${escapeHtml(seg.text.substring(0, 30))}${seg.text.length > 30 ? '...' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function highlightCurrentSubtitle(currentTime) {
  state.segmentos.forEach((seg, index) => {
    if (currentTime >= seg.start_time && currentTime <= seg.end_time) {
      const el = document.querySelector(`.subtitle-item[data-index="${index}"]`);
      if (el) {
        el.style.outline = '2px solid var(--accent-primary)';
      }
    } else {
      const el = document.querySelector(`.subtitle-item[data-index="${index}"]`);
      if (el) {
        el.style.outline = 'none';
      }
    }
  });
}

function seekTo(time) {
  const videoPlayer = document.getElementById('videoPlayer');
  videoPlayer.currentTime = time;
}

function updateSegmentText(index, text) {
  state.segmentos[index].text = text;
  renderTimeline();
}

function updateSegmentTime(index, type, value) {
  const seconds = parseTime(value);
  if (type === 'start') {
    state.segmentos[index].start_time = seconds;
  } else {
    state.segmentos[index].end_time = seconds;
  }
  renderTimeline();
}

function deleteSegment(index) {
  if (confirm('Tem certeza que deseja deletar esta legenda?')) {
    state.segmentos.splice(index, 1);
    renderSubtitles();
    renderTimeline();
  }
}

async function exportSubtitle() {
  if (!state.currentTranscricao) {
    showToast('Nenhuma transcrição para exportar', 'error');
    return;
  }
  
  const formatos = ['srt', 'vtt', 'txt', 'json', 'ass'];
  const formato = prompt(`Formatos disponíveis: ${formatos.join(', ')}\nDigite o formato desejado:`, 'srt');
  
  if (formato && formatos.includes(formato.toLowerCase())) {
    window.open(`/api/export/${state.currentTranscricao.id}/${formato.toLowerCase()}`, '_blank');
    showToast(`Exportando em ${formato.toUpperCase()}...`, 'success');
  } else if (formato) {
    showToast('Formato inválido', 'error');
  }
}

// ============================================
// Histórico
// ============================================

async function loadHistorico() {
  try {
    const response = await fetch('/api/transcricoes?limit=50&offset=0');
    const result = await response.json();
    
    if (result.success) {
      renderHistorico(result.data);
    }
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
  }
}

function renderHistorico(transcricoes) {
  const tbody = document.querySelector('#historicoTable tbody');
  
  if (transcricoes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhuma transcrição encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = transcricoes.map(t => `
    <tr>
      <td>${new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
      <td>${t.original_name || 'N/A'}</td>
      <td>${t.engine}</td>
      <td><span class="video-status ${t.status}">${translateStatus(t.status)}</span></td>
      <td>${Math.round(t.progress)}%</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="openEditorFromHistorico('${t.video_id}')">✏️</button>
        <button class="btn btn-sm btn-primary" onclick="downloadSRT('${t.id}')">💾</button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// Configurações
// ============================================

async function loadConfiguracoes() {
  try {
    const response = await fetch('/api/config');
    const result = await response.json();
    
    if (result.success) {
      renderConfiguracoes(result.data);
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
}

function renderConfiguracoes(configs) {
  const grid = document.getElementById('settingsGrid');
  
  grid.innerHTML = configs.map(config => `
    <div class="setting-card">
      <h3>${config.key.replace(/_/g, ' ').toUpperCase()}</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">${config.description || ''}</p>
      <div class="form-group">
        <input type="text" value="${config.value}" onchange="updateConfig('${config.key}', this.value)">
      </div>
    </div>
  `).join('');
}

async function updateConfig(key, value) {
  try {
    await fetch(`/api/config/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    showToast('Configuração atualizada!', 'success');
  } catch (error) {
    showToast('Erro ao atualizar configuração', 'error');
  }
}

// ============================================
// Utilitários
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  return date.toISOString().substr(11, 8);
}

function parseTime(timeStr) {
  const parts = timeStr.split(':').map(parseFloat);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function translateStatus(status) {
  const statuses = {
    pending: 'Pendente',
    processing: 'Processando',
    completed: 'Completo',
    failed: 'Falhou'
  };
  return statuses[status] || status;
}

async function deleteVideo(videoId) {
  if (confirm('Tem certeza que deseja deletar este vídeo? Esta ação não pode ser desfeita.')) {
    try {
      await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      showToast('Vídeo deletado!', 'success');
      loadVideos();
    } catch (error) {
      showToast('Erro ao deletar vídeo', 'error');
    }
  }
}

function openEditorFromHistorico(videoId) {
  openEditor(videoId);
}

function downloadSRT(transcricaoId) {
  window.open(`/api/export/${transcricaoId}/srt`, '_blank');
}
