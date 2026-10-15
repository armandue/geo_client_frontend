const homeOverviewApiBaseUrl = 'https://geo-client-backend.shandong-buxie.workers.dev';

async function loadHomeOverview() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${homeOverviewApiBaseUrl}/api/overview`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.overview) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }

        const overview = data.overview;
        const values = {
            statOpenRequests: Number(overview.requests?.open || 0),
            statPendingClaims: Number(overview.claims?.pending || 0),
            statApprovedClaims: Number(overview.claims?.approved || 0),
            statInfluencerCount: Number(overview.distinctInfluencerCount || 0)
        };
        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value.toLocaleString();
        });
    } catch (error) {
        console.error('Load dashboard overview error:', error);
        ['statOpenRequests', 'statPendingClaims', 'statApprovedClaims', 'statInfluencerCount'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '—';
        });
    }
}

window.loadHomeOverview = loadHomeOverview;
window.registerPageComponent('home', function (root) {
    root.dataset.componentScript = 'home';
    loadHomeOverview();
});
