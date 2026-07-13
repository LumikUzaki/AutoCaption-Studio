/**
 * Layout Manager - Navegação e Renderização de Páginas
 */

// Mapeamento de rotas para páginas
const routes = {
    'dashboard': 'Dashboard',
    'upload': 'Novo Upload',
    'historico': 'Histórico',
    'configuracoes': 'Configurações'
};

let currentPage = 'dashboard';

export function initLayout() {
    renderSidebar();
    setupNavigation();
}

function renderSidebar() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.innerHTML = Object.entries(routes).map(([key, label]) => `
        <button class="nav-item ${key === currentPage ? 'active' : ''}" data-page="${key}">
            <i class="ph ${getIconForPage(key)}"></i>
            <span>${label}</span>
        </button>
    `).join('');
}

function getIconForPage(page) {
    const icons = {
        'dashboard': 'ph-squares-four',
        'upload': 'ph-upload-simple',
        'historico': 'ph-clock-counter-clockwise',
        'configuracoes': 'ph-gear',
        'processamento': 'ph-hourglass',
        'editor': 'ph-pencil-simple'
    };
    return icons[page] || 'ph-circle';
}

function setupNavigation() {
    document.getElementById('main-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-item');
        if (!btn) return;
        
        const page = btn.dataset.page;
        navigateTo(page);
    });

    // Menu mobile
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

export async function navigateTo(page, params = {}) {
    currentPage = page;
    
    // Atualiza sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Atualiza título
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        titleEl.textContent = routes[page] || page.charAt(0).toUpperCase() + page.slice(1);
    }

    // Fecha sidebar no mobile
    document.getElementById('sidebar')?.classList.remove('open');

    // Carrega página dinâmica
    const contentArea = document.getElementById('page-content');
    if (!contentArea) return;

    contentArea.innerHTML = '<div class="loading-screen"><i class="ph ph-spinner ph-spin"></i><p>Carregando...</p></div>';

    try {
        const module = await import(`./pages/${page}.js`);
        if (module.default) {
            contentArea.innerHTML = module.default.render(params);
            if (module.default.init) {
                module.default.init(params);
            }
        } else {
            contentArea.innerHTML = '<div class="card"><p>Página não encontrada.</p></div>';
        }
    } catch (err) {
        console.error('Erro ao carregar página:', err);
        contentArea.innerHTML = `<div class="card"><p>Erro ao carregar: ${page}</p></div>`;
    }
}

export function getCurrentPage() {
    return currentPage;
}

// Modal genérico
export function showModal(title, content, actions = []) {
    const modal = document.getElementById('modal-generic');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    
    if (footerEl) {
        footerEl.innerHTML = actions.map(action => `
            <button class="btn ${action.class || 'btn-secondary'}" data-action="${action.id}">
                ${action.label}
            </button>
        `).join('');

        footerEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = actions.find(a => a.id === btn.dataset.action);
                if (action?.onClick) action.onClick();
                modal.close();
            });
        });
    }

    modal.showModal();
}

export function closeModal() {
    const modal = document.getElementById('modal-generic');
    if (modal) modal.close();
}

// Setup close buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
});
