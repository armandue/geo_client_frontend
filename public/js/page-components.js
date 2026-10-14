/* Load the canonical page bodies into the dashboard SPA sections. */
(function () {
    const componentHooks = {};
    window.registerPageComponent = function (name, hook) {
        componentHooks[name] = hook;
    };

    const assetRoot = window.location.protocol === 'file:' ? './' : '/';
    const components = {
        home: `${assetRoot}pages/home.html`,
        analytics: `${assetRoot}pages/analytics.html`,
        campaigns: `${assetRoot}pages/requests.html`,
        influencers: `${assetRoot}pages/claims.html`,
        conversations: `${assetRoot}pages/conversations.html`,
        'conversation-detail': `${assetRoot}pages/conversation-detail.html`,
        merchant: `${assetRoot}pages/brands.html`,
        'request-detail': `${assetRoot}pages/request-detail.html`
    };

    const scripts = {
        home: `${assetRoot}js/components/home.js`,
        analytics: `${assetRoot}js/components/analytics.js`,
        campaigns: `${assetRoot}js/components/requests.js`,
        influencers: `${assetRoot}js/components/claims.js`,
        conversations: `${assetRoot}js/components/conversations.js`,
        'conversation-detail': `${assetRoot}js/components/conversation-detail.js`,
        merchant: `${assetRoot}js/components/brands.js`,
        'request-detail': `${assetRoot}js/components/request-detail.js`
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
            conversations: [['pageMainTitle', 'conversationsTitle'], ['pageMainSubtitle', 'conversationsSubtitle']],
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
