/* Load the canonical page bodies into the dashboard SPA sections. */
(function () {
    const componentHooks = {};
    window.registerPageComponent = function (name, hook) {
        componentHooks[name] = hook;
    };

    const components = {
        home: './pages/home.html',
        analytics: './pages/analytics.html',
        campaigns: './pages/requests.html',
        influencers: './pages/claims.html',
        messages: './pages/messages.html',
        merchant: './pages/brands.html',
        'request-detail': './pages/request-detail.html'
    };

    const scripts = {
        home: './js/components/home.js',
        analytics: './js/components/analytics.js',
        campaigns: './js/components/campaigns.js',
        influencers: './js/components/influencers.js',
        messages: './js/components/messages.js',
        merchant: './js/components/merchant.js',
        'request-detail': './js/components/request-detail.js'
    };

    function aliasId(root, sourceId, targetId) {
        const source = root.querySelector(`#${sourceId}`);
        if (source && !root.querySelector(`#${targetId}`)) source.id = targetId;
    }

    function normalizeComponent(section, root) {
        const aliases = {
            analytics: [['pageMainTitle', 'analyticsTitle'], ['pageMainSubtitle', 'analyticsSubtitle']],
            campaigns: [['pageMainTitle', 'campaignsTitle'], ['pageMainSubtitle', 'campaignsSubtitle']],
            influencers: [['pageMainTitle', 'influencersTitle'], ['pageMainSubtitle', 'influencersSubtitle']],
            messages: [['pageMainTitle', 'messagesTitle'], ['pageMainSubtitle', 'messagesSubtitle']],
            merchant: [['pageMainTitle', 'merchantTitle'], ['pageMainSubtitle', 'merchantSubtitle']]
        };

        (aliases[section] || []).forEach(([sourceId, targetId]) => aliasId(root, sourceId, targetId));

        if (section === 'campaigns') {
            const list = root.querySelector('.message-list');
            if (list && !list.id) list.id = 'campaignList';
        }
    }

    function loadComponentScript(section) {
        const path = scripts[section];
        if (!path) return;

        const request = new XMLHttpRequest();
        try {
            request.open('GET', path, false);
            request.send();
        } catch (error) {
            console.error(`Failed to load component script: ${path}`, error);
            return;
        }

        const isFileResponse = request.status === 0 && request.responseText;
        if ((!isFileResponse && request.status < 200) || request.status >= 300 || !request.responseText.trim()) {
            console.error(`Failed to load component script: ${path}`);
            return;
        }

        window.eval(`${request.responseText}\n//# sourceURL=${path}`);
    }

    function loadComponent(section, path) {
        const target = document.getElementById(`section-${section}`);
        if (!target) return;

        const request = new XMLHttpRequest();
        try {
            request.open('GET', path, false);
            request.send();
        } catch (error) {
            console.error(`Failed to load page component: ${path}`, error);
            return;
        }

        const isFileResponse = request.status === 0 && request.responseText;
        if ((!isFileResponse && request.status < 200) || request.status >= 300 || !request.responseText.trim()) {
            console.error(`Failed to load page component: ${path}`);
            return;
        }

        const documentFragment = new DOMParser().parseFromString(request.responseText, 'text/html');
        const main = documentFragment.querySelector('main.dashboard-main');
        if (!main || !main.innerHTML.trim()) {
            console.error(`Page component has no dashboard main: ${path}`);
            return;
        }

        const nestedSection = section === 'request-detail'
            ? main.querySelector('#section-request-detail')
            : null;
        target.innerHTML = nestedSection ? nestedSection.innerHTML : main.innerHTML;
        normalizeComponent(section, target);
        loadComponentScript(section);
        if (componentHooks[section]) componentHooks[section](target);
        target.dataset.componentLoaded = path;
    }

    Object.entries(components).forEach(([section, path]) => loadComponent(section, path));
})();
