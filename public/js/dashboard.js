/**
 * GeoMedia Dashboard — Common Script (SPA Edition)
 * URL scheme: /index.html/<name>?lang=<zh|en>
 */

const API_BASE_URL = 'https://geoclientbackend.shandong-buxie.workers.dev';

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
        navMessages: '消息',
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
        navMessages: 'Messages',
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
        if (match[1] === 'campaigns' && match[2]) {
            return { section: 'campaign-detail', id: match[2] };
        }
        return { section: match[1], id: match[2] };
    }
    return { section: getParam('section') || 'home', id: null };
}

function getCurrentSection() {
    return getCurrentSectionInfo().section;
}

// ── SPA Section Router ─────────────────────────────────────────────────────
const VALID_SECTIONS = ['home', 'analytics', 'campaigns', 'influencers', 'messages', 'merchant', 'campaign-detail'];

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

    // Update sidebar active state (for campaign-detail, highlight campaigns)
    const activeSection = name === 'campaign-detail' ? 'campaigns' : name;
    document.querySelectorAll('.menu-item[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === activeSection);
    });

    // Update URL (preserve lang param)
    const lang = getCurrentLang();
    const newUrl = new URL(window.location.href);
    if (name === 'campaign-detail' && id) {
        newUrl.pathname = `/index.html/campaigns/${id}`;
    } else {
        newUrl.pathname = name === 'home' ? '/index.html' : `/index.html/${name}`;
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
    set('navLabelMessages', t.navMessages);
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
        window.location.href = `/login.html?lang=${lang}`;
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
    const currentInit = getCurrentSectionInfo();
    showSection(currentInit.section, false, currentInit.id);   // replaceState so it won't break back button

    // ── Fetch brand data ─────────────────────────────────────────
    fetchBrandData();
});
