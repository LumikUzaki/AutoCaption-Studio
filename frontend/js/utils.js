/**
 * Utils - Funções utilitárias gerais
 * Funções puras e helpers usados em toda a aplicação
 */

/**
 * Formata duração em segundos para string legível (HH:MM:SS.mmm)
 * @param {number} seconds - Duração em segundos
 * @returns {string} Duração formatada
 */
export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '00:00:00.000';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num, size = 2) => String(num).padStart(size, '0');
  
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
  }
  return `${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Converte timestamp em formato SRT (HH:MM:SS,mmm)
 * @param {number} seconds - Timestamp em segundos
 * @returns {string} Timestamp no formato SRT
 */
export function toSrtTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num, size = 2) => String(num).padStart(size, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Converte timestamp em formato VTT/ASS (H:MM:SS.mmm)
 * @param {number} seconds - Timestamp em segundos
 * @returns {string} Timestamp no formato VTT/ASS
 */
export function toVttTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (num, size = 2) => String(num).padStart(size, '0');
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Formata número com separador de milhar
 * @param {number} num - Número a formatar
 * @returns {string} Número formatado
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('pt-BR').format(num);
}

/**
 * Formata data para padrão brasileiro
 * @param {Date|string|number} date - Data a formatar
 * @returns {string} Data formatada
 */
export function formatDate(date) {
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

/**
 * Formata tamanho de arquivo em bytes para string legível
 * @param {number} bytes - Tamanho em bytes
 * @returns {string} Tamanho formatado
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Gera UUID v4
 * @returns {string} UUID gerado
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Debounce - Limita frequência de execução de função
 * @param {Function} func - Função a ser debounced
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função debounced
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle - Limita execução de função para uma vez por intervalo
 * @param {Function} func - Função a ser throttled
 * @param {number} limit - Intervalo em ms
 * @returns {Function} Função throttled
 */
export function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Sanitiza string para evitar XSS
 * @param {string} str - String a sanitizar
 * @returns {string} String sanitizada
 */
export function sanitizeString(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escapa caracteres especiais para regex
 * @param {string} str - String a escapar
 * @returns {string} String escapada
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Copia texto para clipboard
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback para navegadores antigos
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Download de arquivo como blob
 * @param {Blob|string} content - Conteúdo do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {string} mimeType - MIME type do arquivo
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  let blob;
  if (typeof content === 'string') {
    blob = new Blob([content], { type: mimeType });
  } else {
    blob = content;
  }
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse de string SRT para array de segmentos
 * @param {string} srtContent - Conteúdo do arquivo SRT
 * @returns {Array} Array de segmentos
 */
export function parseSRT(srtContent) {
  const segments = [];
  const blocks = srtContent.trim().split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    
    if (!timeMatch) continue;
    
    const start = parseSrtTime(timeMatch[1]);
    const end = parseSrtTime(timeMatch[2]);
    const text = lines.slice(2).join('\n');
    
    segments.push({ index, start, end, text });
  }
  
  return segments;
}

/**
 * Parse de timestamp SRT para segundos
 * @param {string} timeStr - Timestamp no formato SRT
 * @returns {number} Tempo em segundos
 */
function parseSrtTime(timeStr) {
  const parts = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!parts) return 0;
  
  const hours = parseInt(parts[1]);
  const minutes = parseInt(parts[2]);
  const seconds = parseInt(parts[3]);
  const ms = parseInt(parts[4]);
  
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * Detecta idioma pelo código
 * @param {string} code - Código do idioma
 * @returns {string} Nome do idioma
 */
export function getLanguageName(code) {
  const languages = {
    pt: 'Português',
    en: 'Inglês',
    es: 'Espanhol',
    fr: 'Francês',
    de: 'Alemão',
    it: 'Italiano',
    ja: 'Japonês',
    ko: 'Coreano',
    zh: 'Chinês',
    ru: 'Russo',
    ar: 'Árabe',
    hi: 'Hindi'
  };
  return languages[code] || code.toUpperCase();
}

/**
 * Calcula diferença entre dois timestamps
 * @param {number} start - Timestamp inicial
 * @param {number} end - Timestamp final
 * @returns {number} Diferença em segundos
 */
export function timeDiff(start, end) {
  return Math.max(0, end - start);
}

/**
 * Interpola valor entre dois números
 * @param {number} start - Valor inicial
 * @param {number} end - Valor final
 * @param {number} t - Fator de interpolação (0-1)
 * @returns {number} Valor interpolado
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Clamp de valor entre mínimo e máximo
 * @param {number} value - Valor a limitar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} Valor limitado
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Verifica se elemento está visível na viewport
 * @param {HTMLElement} element - Elemento a verificar
 * @returns {boolean} Se está visível
 */
export function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll suave até elemento
 * @param {HTMLElement} element - Elemento alvo
 * @param {Object} options - Opções de scroll
 */
export function scrollToElement(element, options = {}) {
  element.scrollIntoView({
    behavior: options.behavior || 'smooth',
    block: options.block || 'center',
    inline: options.inline || 'nearest'
  });
}

/**
 * Cria elemento DOM com atributos e filhos
 * @param {string} tag - Tag do elemento
 * @param {Object} attributes - Atributos do elemento
 * @param {Array|string} children - Filhos do elemento
 * @returns {HTMLElement} Elemento criado
 */
export function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  // Adiciona atributos
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined) {
      element.setAttribute(key, value);
    }
  });
  
  // Adiciona filhos
  if (children) {
    const childArray = Array.isArray(children) ? children : [children];
    childArray.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });
  }
  
  return element;
}

/**
 * Remove todos os filhos de um elemento
 * @param {HTMLElement} element - Elemento a limpar
 */
export function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Espera determinado tempo (sleep)
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise} Promise resolvida após o tempo
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tenta executar função com retry
 * @param {Function} fn - Função a executar
 * @param {number} retries - Número de tentativas
 * @param {number} delay - Delay entre tentativas em ms
 * @returns {Promise} Resultado da função
 */
export async function withRetry(fn, retries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Group by - Agrupa array por chave
 * @param {Array} array - Array a agrupar
 * @param {string|Function} key - Chave ou função para agrupamento
 * @returns {Object} Objeto agrupado
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}

/**
 * Unique - Remove duplicados de array
 * @param {Array} array - Array a processar
 * @param {string|Function} key - Chave ou função para unicidade
 * @returns {Array} Array sem duplicados
 */
export function unique(array, key) {
  if (!key) {
    return [...new Set(array)];
  }
  
  const seen = new Set();
  return array.filter(item => {
    const keyValue = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}

/**
 * Sort by - Ordena array por chave
 * @param {Array} array - Array a ordenar
 * @param {string|Function} key - Chave ou função para ordenação
 * @param {string} order - Ordem ('asc' ou 'desc')
 * @returns {Array} Array ordenado
 */
export function sortBy(array, key, order = 'asc') {
  const multiplier = order === 'desc' ? -1 : 1;
  
  return [...array].sort((a, b) => {
    const aValue = typeof key === 'function' ? key(a) : a[key];
    const bValue = typeof key === 'function' ? key(b) : b[key];
    
    if (aValue < bValue) return -1 * multiplier;
    if (aValue > bValue) return 1 * multiplier;
    return 0;
  });
}

export default {
  formatDuration,
  toSrtTimestamp,
  toVttTimestamp,
  formatNumber,
  formatDate,
  formatFileSize,
  generateUUID,
  debounce,
  throttle,
  sanitizeString,
  escapeRegex,
  copyToClipboard,
  downloadFile,
  parseSRT,
  getLanguageName,
  timeDiff,
  lerp,
  clamp,
  isElementInViewport,
  scrollToElement,
  createElement,
  clearChildren,
  sleep,
  withRetry,
  groupBy,
  unique,
  sortBy
};
