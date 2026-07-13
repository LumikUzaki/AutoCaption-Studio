/**
 * Router - Sistema de roteamento SPA sem reload
 * Gerencia navegação entre páginas usando History API
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentPage = null;
    this.beforeHooks = [];
    
    // Detecta mudança de URL (back/forward buttons)
    window.addEventListener('popstate', () => {
      this.handleLocation();
    });
  }

  /**
   * Registra uma nova rota
   * @param {string} path - Path da rota (ex: '/dashboard', '/editor/:id')
   * @param {Function} handler - Função que renderiza a página
   * @param {Object} options - Opções da rota
   */
  register(path, handler, options = {}) {
    const route = {
      path,
      handler,
      pattern: this.pathToRegex(path),
      options
    };
    this.routes.set(path, route);
    return this;
  }

  /**
   * Converte path com parâmetros para regex
   * @param {string} path - Path original
   * @returns {RegExp} Regex para matching
   */
  pathToRegex(path) {
    const keys = [];
    const pattern = path.replace(/:(\w+)/g, '([^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  /**
   * Adiciona hook executado antes de mudar de rota
   * @param {Function} hook - Função async que retorna boolean
   */
  beforeEach(hook) {
    this.beforeHooks.push(hook);
  }

  /**
   * Navega para uma URL específica
   * @param {string} url - URL de destino
   * @param {boolean} push - Se deve adicionar ao histórico (padrão: true)
   */
  navigate(url, push = true) {
    if (push) {
      history.pushState({ path: url }, '', url);
    }
    this.handleLocation();
  }

  /**
   * Processa a localização atual e executa a rota correspondente
   */
  async handleLocation() {
    const path = window.location.pathname;
    
    // Executa before hooks
    for (const hook of this.beforeHooks) {
      const shouldContinue = await hook(path, this.currentPage);
      if (!shouldContinue) {
        return;
      }
    }

    // Encontra a rota correspondente
    let matchedRoute = null;
    let params = {};

    for (const [key, route] of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        matchedRoute = route;
        // Extrai parâmetros da URL
        const paramNames = key.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];
        paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });
        break;
      }
    }

    // Rota não encontrada
    if (!matchedRoute) {
      this.navigate('/404');
      return;
    }

    // Atualiza página atual
    this.currentPage = { path, params, route: matchedRoute };

    // Executa handler da rota
    try {
      await matchedRoute.handler(params);
      this.updateActiveLink(path);
    } catch (error) {
      console.error(`Erro ao carregar rota ${path}:`, error);
      this.navigate('/500');
    }
  }

  /**
   * Atualiza link ativo no menu
   * @param {string} path - Path atual
   */
  updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === path || (href !== '/' && path.startsWith(href))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Atualiza título da página
    const pageTitle = this.getPageTitle(path);
    if (pageTitle) {
      document.title = `${pageTitle} | Legendas Pro`;
    }
  }

  /**
   * Obtém título da página baseado no path
   * @param {string} path - Path atual
   * @returns {string} Título da página
   */
  getPageTitle(path) {
    const titles = {
      '/': 'Dashboard',
      '/dashboard': 'Dashboard',
      '/queue': 'Fila de Processamento',
      '/editor': 'Editor',
      '/config': 'Configurações',
      '/404': 'Página Não Encontrada',
      '/500': 'Erro no Servidor'
    };

    for (const [key, title] of Object.entries(titles)) {
      if (path === key || (key !== '/' && path.startsWith(key))) {
        return title;
      }
    }
    return 'Legendas Pro';
  }

  /**
   * Inicializa o router
   */
  init() {
    this.handleLocation();
  }
}

// Exporta instância singleton
export const router = new Router();
export default router;
