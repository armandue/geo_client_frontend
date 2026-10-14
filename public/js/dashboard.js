/**
 * GeoMedia Dashboard — Common Script (SPA Edition)
 * URL scheme: /index.html/<name>?lang=<zh|en>
 */

const API_BASE_URL = 'https://geoclientbackend.shandong-buxie.workers.dev';

function redirectToLogin() {
    if (window.__authRedirecting) return;
    window.__authRedirecting = true;
    ['authToken', 'tokenType', 'accessToken', 'expiresIn', 'brandInfo'].forEach(key => localStorage.removeItem(key));
    const lang = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('lang') || 'zh';
    window.location.replace(`/login.html?lang=${encodeURIComponent(lang)}`);
}

// A token can be present in storage but expired or revoked. Redirect when an
// authenticated API request confirms that the session is no longer valid.
const dashboardFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
    const response = await dashboardFetch(...args);
    const requestUrl = args[0] instanceof Request ? args[0].url : String(args[0]);
    if (response.status === 401 && requestUrl.startsWith(`${API_BASE_URL}/`)) {
        redirectToLogin();
    }
    return response;
};

// ── i18n: shared navbar / sidebar labels ──────────────────────────────────
const dashboardI18n = {
    zh: {
        pageTitlePrefix: '控制台 - 智优传媒',
        brandLoading: '加载中...',
        verifiedMerchant: '● 认证商家',
        menuTitle: '控制台菜单',
        navHome: '主页',
        navAnalytics: '智能分析',
        navCampaigns: '活动召集',
        navInfluencers: '网红推广',
        navConversations: '消息',
        navMerchant: '商家详情',
        logoutBtn: '退出登录',
        welcomeBannerTitle: (brand) => `欢迎回来，${brand}`,
        fallbackBrand: '品牌商户'
    },
    en: {
        pageTitlePrefix: 'Dashboard - GeoMedia',
        brandLoading: 'Loading...',
        verifiedMerchant: '● Verified Merchant',
        menuTitle: 'NAVIGATION',
        navHome: 'Home',
        navAnalytics: 'Smart Analysis',
        navCampaigns: 'Campaigns',
        navInfluencers: 'Influencers',
        navConversations: 'Conversations',
        navMerchant: 'Merchant Details',
        logoutBtn: 'Sign Out',
        welcomeBannerTitle: (brand) => `Welcome back, ${brand}`,
        fallbackBrand: 'Merchant Brand'
    }
};

// ── URL helpers ────────────────────────────────────────────────────────────
function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
}

function setParam(key, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    return url;
}

function getCurrentLang() {
    return getParam('lang') || localStorage.getItem('lang') || 'zh';
}

function getCurrentSectionInfo() {
    const match = window.location.pathname.match(/\/index\.html\/([^/?]+)(?:\/([^/?]+))?/);
    if (match) {
        let route = match[1];
        let id = match[2];
        
        // Map new URL routes back to internal sections
        if (route === 'requests' || route === 'campaigns') {
            if (id) return { section: 'request-detail', id: id };
            return { section: 'campaigns', id: null };
        }
        if (route === 'conversations' && id) {
            // Detail route is /index.html/conversations/:requestId?email=<influencerEmail>
            // (backend conversation API is keyed by request + influencer email)
            const email = new URLSearchParams(window.location.search).get('email');
            if (email) window.__conversationContext = { requestId: id, influencerEmail: email };
            return { section: 'conversation-detail', id };
        }
        if (route === 'claims') return { section: 'influencers', id };
        if (route === 'brands') return { section: 'merchant', id };
        
        return { section: route, id: id };
    }
    if (window.location.pathname.endsWith('/request-detail.html')) {
        return { section: 'request-detail', id: getParam('id') };
    }
    if (window.location.pathname.endsWith('/conversation-detail.html')) {
        const requestId = getParam('request_id');
        const email = getParam('email');
        if (requestId && email) window.__conversationContext = { requestId, influencerEmail: email };
        return { section: 'conversation-detail', id: requestId };
    }
    return { section: getParam('section') || 'home', id: null };
}

function getCurrentSection() {
    return getCurrentSectionInfo().section;
}

// NOTE: window.onSectionShow is defined in index.html's inline script (it runs
// after this file and owns the SPA section dispatcher). Detail data loaders
// (window.loadRequestDetailPage, window.loadConversationDetailPage,
// window.loadMerchantPage) are called from there.

// ── SPA Section Router ─────────────────────────────────────────────────────
const VALID_SECTIONS = ['home', 'analytics', 'campaigns', 'influencers', 'conversations', 'conversation-detail', 'merchant', 'request-detail'];

/**
 * Show the target section, hide all others.
 * Updates URL via pushState (or replaceState on initial load).
 * @param {string} name - section name
 * @param {boolean} pushState - whether to push a new history entry
 * @param {string|null} id - optional ID for detail views
 */

function showSection(name, pushState = true, id = null) {
    if (!VALID_SECTIONS.includes(name)) name = 'home';

    // Hide all sections
    VALID_SECTIONS.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.style.display = 'none';
    });

    // Show target
    const target = document.getElementById(`section-${name}`);
    if (target) target.style.display = 'block';

    // Update sidebar active state (for request-detail, highlight campaigns)
    const activeSection = name === 'request-detail' ? 'campaigns' : (name === 'conversation-detail' ? 'conversations' : name);
    document.querySelectorAll('.menu-item[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === activeSection);
    });

    // Update URL (preserve lang param)
    const lang = getCurrentLang();
    const newUrl = new URL(window.location.href);
    
    // Map internal sections to URL paths
    if (name === 'request-detail' && id) {
        newUrl.pathname = '/request-detail.html';
        newUrl.searchParams.set('id', id);
    } else if (name === 'conversation-detail' && id) {
        newUrl.pathname = '/conversation-detail.html';
        newUrl.searchParams.set('request_id', id);
        const ctxEmail = window.__conversationContext && window.__conversationContext.requestId === id
            ? window.__conversationContext.influencerEmail
            : null;
        if (ctxEmail) newUrl.searchParams.set('email', ctxEmail);
    } else if (name === 'home') {
        newUrl.pathname = '/index.html';
    } else {
        const pagePaths = {
            analytics: '/analytics.html',
            campaigns: '/requests.html',
            influencers: '/claims.html',
            conversations: '/conversations.html',
            merchant: '/brands.html'
        };
        newUrl.pathname = pagePaths[name] || '/index.html';
    }
    
    newUrl.searchParams.delete('section');
    newUrl.searchParams.set('lang', lang);

    if (pushState) {
        window.history.pushState({ section: name, id: id }, '', newUrl.toString());
    } else {
        window.history.replaceState({ section: name, id: id }, '', newUrl.toString());
    }

    // Notify page-level scripts that a section became visible
    if (typeof window.onSectionShow === 'function') {
        window.onSectionShow(name, id);
    }
}

// ── Language helpers ───────────────────────────────────────────────────────
function applySharedLanguage(lang) {
    const t = dashboardI18n[lang] || dashboardI18n.zh;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    set('menuTitle', t.menuTitle);
    set('navLabelHome', t.navHome);
    set('navLabelAnalytics', t.navAnalytics);
    set('navLabelCampaigns', t.navCampaigns);
    set('navLabelInfluencers', t.navInfluencers);
    set('navLabelConversations', t.navConversations);
    set('navLabelMerchant', t.navMerchant);
    set('sidebarBrandStatus', t.verifiedMerchant);
    set('logoutBtn', t.logoutBtn);

    updateBrandNameDisplay();
}

// ── Brand data ─────────────────────────────────────────────────────────────
async function fetchBrandData() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    showLoading(true);
    try {
        const resp = await fetch(`${API_BASE_URL}/api/my-brand`, {
            headers: { 'Authorization': token, 'Content-Type': 'application/json' }
        });
        const result = await resp.json();
        if (result.success && result.brand) {
            localStorage.setItem('brandInfo', JSON.stringify(result.brand));
            updateBrandNameDisplay();
        }
    } catch (e) {
        console.error('Fetch brand error:', e);
    } finally {
        showLoading(false);
    }
}

function updateBrandNameDisplay() {
    const raw = localStorage.getItem('brandInfo');
    const lang = getCurrentLang();
    const t = dashboardI18n[lang] || dashboardI18n.zh;
    if (!raw) return;

    try {
        const b = JSON.parse(raw);
        const name = (lang === 'zh' ? (b.nameZh || b.nameEn) : (b.nameEn || b.nameZh)) || t.fallbackBrand;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('navBrandName', name);
        set('sidebarBrandName', name);
        set('brandInitial', name.charAt(0));
        set('homeBannerTitle', t.welcomeBannerTitle(name));
        set('detValueNameZh', b.nameZh || '-');
        set('detValueNameEn', b.nameEn || '-');
    } catch (e) {
        console.error('Brand parse error:', e);
    }
}

function showLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = show ? 'flex' : 'none';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Fade in
    setTimeout(() => document.body.classList.add('fade-in'), 50);

    // Auth guard
    const token = localStorage.getItem('authToken');
    const lang = getParam('lang') || localStorage.getItem('lang') || 'zh';

    if (!token) {
        redirectToLogin();
        return;
    }

    localStorage.setItem('lang', lang);

    // ── Language UI ──────────────────────────────────────────────
    const langToggle   = document.getElementById('langToggle');
    const langDropdown = document.querySelector('.lang-dropdown');
    const langOptions  = document.querySelectorAll('.lang-option');
    const currentLangSpan = document.getElementById('currentLang');

    langOptions.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
        if (opt.dataset.lang === lang && currentLangSpan) currentLangSpan.textContent = opt.textContent.trim();
    });

    // Write lang into URL if missing
    if (!getParam('lang')) {
        const u = setParam('lang', lang);
        window.history.replaceState({}, '', u.toString());
    }

    applySharedLanguage(lang);
    if (typeof window.onPageLanguageChange === 'function') {
        window.onPageLanguageChange(lang);
    }

    // Language dropdown toggle
    if (langToggle && langDropdown) {
        langToggle.addEventListener('click', () => {
            langDropdown.classList.toggle('open');
            langToggle.classList.toggle('active');
        });
    }

    langOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const selected = opt.dataset.lang;
            localStorage.setItem('lang', selected);

            // Update URL lang param (keep section)
            const u = new URL(window.location.href);
            u.searchParams.set('lang', selected);
            window.history.replaceState({}, '', u.toString());

            langOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            if (currentLangSpan) currentLangSpan.textContent = opt.textContent.trim();
            if (langDropdown) langDropdown.classList.remove('open');
            if (langToggle) langToggle.classList.remove('active');

            applySharedLanguage(selected);
            if (typeof window.onPageLanguageChange === 'function') {
                window.onPageLanguageChange(selected);
            }
        });
    });

    document.addEventListener('click', e => {
        if (langDropdown && !langDropdown.contains(e.target)) {
            langDropdown.classList.remove('open');
            if (langToggle) langToggle.classList.remove('active');
        }
    });

    // ── SPA Navigation: sidebar links ───────────────────────────
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section, true);
            // Close mobile sidebar after navigation
            const sidebar = document.getElementById('sidebarPanel');
            const overlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // ── SPA Navigation: browser back/forward ────────────────────
    window.addEventListener('popstate', e => {
        let section, id;
        if (e.state && e.state.section) {
            section = e.state.section;
            id = e.state.id;
        } else {
            const current = getCurrentSectionInfo();
            section = current.section;
            id = current.id;
        }
        showSection(section, false, id);
    });

    // ── Mobile Sidebar ───────────────────────────────────────────
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarPanel     = document.getElementById('sidebarPanel');
    const sidebarOverlay   = document.getElementById('sidebarOverlay');

    function openSidebar()  { sidebarPanel?.classList.add('open');    sidebarOverlay?.classList.add('active'); }
    function closeSidebar() { sidebarPanel?.classList.remove('open'); sidebarOverlay?.classList.remove('active'); }

    sidebarToggleBtn?.addEventListener('click', () => {
        sidebarPanel?.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // ── Logout ───────────────────────────────────────────────────
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        ['authToken','tokenType','accessToken','expiresIn','brandInfo'].forEach(k => localStorage.removeItem(k));
        document.body.classList.remove('fade-in');
        document.body.classList.add('fade-out');
        setTimeout(() => { window.location.href = `/login.html?lang=${getCurrentLang()}`; }, 300);
    });

    // ── Initial section render ───────────────────────────────────
    const isSPA = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    if (isSPA) {
        const currentInit = getCurrentSectionInfo();
        showSection(currentInit.section, false, currentInit.id);   // replaceState so it won't break back button
    }

    // ── Fetch brand data ─────────────────────────────────────────
    fetchBrandData();
});
