/**
 * API Client - Cliente para comunicação com backend REST
 * Gerencia todas as chamadas HTTP para a API
 */

import { store } from './store.js';

class ApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.timeout = 30000; // 30 segundos
  }

  /**
   * Monta URL completa
   * @param {string} endpoint - Endpoint relativo
   * @returns {string} URL completa
   */
  buildUrl(endpoint) {
    const url = new URL(endpoint, window.location.origin);
    return url.toString();
  }

  /**
   * Obtém headers padrão com token se disponível
   * @returns {Object} Headers da requisição
   */
  getHeaders(customHeaders = {}) {
    return {
      ...this.defaultHeaders,
      ...customHeaders
    };
  }

  /**
   * Trata resposta da API
   * @param {Response} response - Response do fetch
   * @returns {Promise<any>} Dados da resposta
   */
  async handleResponse(response) {
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const error = new Error(data.error?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.error?.code || 'UNKNOWN_ERROR';
      error.details = data.error?.details;
      throw error;
    }
    
    return data;
  }

  /**
   * Request genérico com timeout
   * @param {string} endpoint - Endpoint
   * @param {Object} options - Opções do fetch
   * @returns {Promise<any>} Resposta da API
   */
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders(options.headers);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return await this.handleResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Requisição excedeu o tempo limite');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint - Endpoint
   * @param {Object} params - Query params
   * @returns {Promise<any>} Resposta da API
   */
  async get(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    return this.request(url.pathname + url.search);
  }

  /**
   * POST request
   * @param {string} endpoint - Endpoint
   * @param {Object} body - Body da requisição
   * @returns {Promise<any>} Resposta da API
   */
  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request
   * @param {string} endpoint - Endpoint
   * @param {Object} body - Body da requisição
   * @returns {Promise<any>} Resposta da API
   */
  async put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * PATCH request
   * @param {string} endpoint - Endpoint
   * @param {Object} body - Body da requisição
   * @returns {Promise<any>} Resposta da API
   */
  async patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - Endpoint
   * @returns {Promise<any>} Resposta da API
   */
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }

  /**
   * Upload de arquivo com FormData
   * @param {string} endpoint - Endpoint
   * @param {FormData} formData - FormData com arquivos
   * @param {Function} onProgress - Callback de progresso
   * @returns {Promise<any>} Resposta da API
   */
  async upload(endpoint, formData, onProgress = () => {}) {
    const url = this.buildUrl(endpoint);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', url, true);
      
      // Progresso do upload
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error?.message || `HTTP ${xhr.status}`));
          } catch (e) {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Erro de rede ao fazer upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelado'));
      });
      
      xhr.send(formData);
    });
  }

  /**
   * Download de arquivo como blob
   * @param {string} endpoint - Endpoint
   * @returns {Promise<Blob>} Blob do arquivo
   */
  async downloadBlob(endpoint) {
    const url = this.buildUrl(endpoint);
    
    const response = await fetch(url, {
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    return await response.blob();
  }

  // ==================== VÍDEOS ====================

  /**
   * Lista todos os vídeos
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Lista de vídeos
   */
  async getVideos(params = {}) {
    const response = await this.get('/api/videos', params);
    return response.data || [];
  }

  /**
   * Obtém detalhes de um vídeo
   * @param {string} id - ID do vídeo
   * @returns {Promise<Object>} Detalhes do vídeo
   */
  async getVideo(id) {
    const response = await this.get(`/api/videos/${id}`);
    return response.data;
  }

  /**
   * Faz upload de vídeo
   * @param {File} file - Arquivo de vídeo
   * @param {Function} onProgress - Callback de progresso
   * @returns {Promise<Object>} Resultado do upload
   */
  async uploadVideo(file, onProgress = () => {}) {
    const formData = new FormData();
    formData.append('video', file);
    
    return this.upload('/api/videos/upload', formData, onProgress);
  }

  /**
   * Atualiza vídeo
   * @param {string} id - ID do vídeo
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>} Vídeo atualizado
   */
  async updateVideo(id, data) {
    const response = await this.put(`/api/videos/${id}`, data);
    return response.data;
  }

  /**
   * Deleta vídeo
   * @param {string} id - ID do vídeo
   * @returns {Promise<void>}
   */
  async deleteVideo(id) {
    await this.delete(`/api/videos/${id}`);
  }

  /**
   * Obtém segmentos de um vídeo
   * @param {string} id - ID do vídeo
   * @returns {Promise<Array>} Lista de segmentos
   */
  async getSegments(id) {
    const response = await this.get(`/api/videos/${id}/segments`);
    return response.data || [];
  }

  /**
   * Atualiza segmento
   * @param {string} id - ID do segmento
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>} Segmento atualizado
   */
  async updateSegment(id, data) {
    const response = await this.put(`/api/segments/${id}`, data);
    return response.data;
  }

  /**
   * Deleta segmento
   * @param {string} id - ID do segmento
   * @returns {Promise<void>}
   */
  async deleteSegment(id) {
    await this.delete(`/api/segments/${id}`);
  }

  /**
   * Adiciona segmento
   * @param {string} videoId - ID do vídeo
   * @param {Object} data - Dados do segmento
   * @returns {Promise<Object>} Segmento criado
   */
  async addSegment(videoId, data) {
    const response = await this.post(`/api/videos/${videoId}/segments`, data);
    return response.data;
  }

  // ==================== TRANSCRIÇÃO ====================

  /**
   * Inicia transcrição
   * @param {string} videoId - ID do vídeo
   * @param {Object} options - Opções de transcrição
   * @returns {Promise<Object>} Job criado
   */
  async startTranscription(videoId, options = {}) {
    const response = await this.post(`/api/transcricao/start/${videoId}`, options);
    return response.data;
  }

  /**
   * Obtém status de transcrição
   * @param {string} videoId - ID do vídeo
   * @returns {Promise<Object>} Status da transcrição
   */
  async getTranscriptionStatus(videoId) {
    const response = await this.get(`/api/transcricao/status/${videoId}`);
    return response.data;
  }

  // ==================== TRADUÇÃO ====================

  /**
   * Inicia tradução
   * @param {string} videoId - ID do vídeo
   * @param {string} targetLanguage - Idioma alvo
   * @param {Object} options - Opções de tradução
   * @returns {Promise<Object>} Job criado
   */
  async startTranslation(videoId, targetLanguage, options = {}) {
    const response = await this.post(`/api/transcricao/translate/${videoId}`, {
      targetLanguage,
      ...options
    });
    return response.data;
  }

  // ==================== EXPORTAÇÃO ====================

  /**
   * Exporta legenda em formato específico
   * @param {string} videoId - ID do vídeo
   * @param {string} format - Formato (srt, vtt, ass, txt, json)
   * @param {Object} options - Opções de exportação
   * @returns {Promise<Object>} URL de download
   */
  async exportSubtitle(videoId, format, options = {}) {
    const response = await this.post(`/api/export/${videoId}/${format}`, options);
    return response.data;
  }

  /**
   * Renderiza hardsub
   * @param {string} videoId - ID do vídeo
   * @param {Object} options - Opções de renderização
   * @returns {Promise<Object>} Job de renderização
   */
  async renderHardsub(videoId, options = {}) {
    const response = await this.post(`/api/export/render/${videoId}`, options);
    return response.data;
  }

  // ==================== FILA ====================

  /**
   * Obtém status da fila
   * @returns {Promise<Object>} Status da fila
   */
  async getQueueStatus() {
    const response = await this.get('/api/queue/status');
    return response.data;
  }

  /**
   * Obtém jobs da fila
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Lista de jobs
   */
  async getJobs(params = {}) {
    const response = await this.get('/api/queue/jobs', params);
    return response.data || [];
  }

  /**
   * Cancela job
   * @param {string} jobId - ID do job
   * @returns {Promise<void>}
   */
  async cancelJob(jobId) {
    await this.post(`/api/queue/jobs/${jobId}/cancel`);
  }

  /**
   * Remove job concluído
   * @param {string} jobId - ID do job
   * @returns {Promise<void>}
   */
  async removeJob(jobId) {
    await this.delete(`/api/queue/jobs/${jobId}`);
  }

  // ==================== CONFIGURAÇÕES ====================

  /**
   * Obtém configurações
   * @returns {Promise<Object>} Configurações
   */
  async getConfig() {
    const response = await this.get('/api/config');
    return response.data || {};
  }

  /**
   * Atualiza configurações
   * @param {Object} data - Configurações a atualizar
   * @returns {Promise<Object>} Configurações atualizadas
   */
  async updateConfig(data) {
    const response = await this.put('/api/config', data);
    return response.data;
  }

  /**
   * Obtém lista de modelos disponíveis
   * @returns {Promise<Array>} Lista de modelos
   */
  async getModels() {
    const response = await this.get('/api/config/models');
    return response.data || [];
  }

  /**
   * Baixa modelo
   * @param {string} modelName - Nome do modelo
   * @returns {Promise<Object>} Status do download
   */
  async downloadModel(modelName) {
    const response = await this.post('/api/config/models/download', { name: modelName });
    return response.data;
  }

  /**
   * Deleta modelo
   * @param {string} modelName - Nome do modelo
   * @returns {Promise<void>}
   */
  async deleteModel(modelName) {
    await this.delete(`/api/config/models/${modelName}`);
  }

  // ==================== SISTEMA ====================

  /**
   * Obtém status do sistema
   * @returns {Promise<Object>} Status do sistema
   */
  async getSystemStatus() {
    const response = await this.get('/api/system/status');
    return response.data;
  }

  /**
   * Obtém logs do sistema
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Lista de logs
   */
  async getLogs(params = {}) {
    const response = await this.get('/api/system/logs', params);
    return response.data || [];
  }
}

// Exporta instância singleton
export const api = new ApiClient();
export default api;
