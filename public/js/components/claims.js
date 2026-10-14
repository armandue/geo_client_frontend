const claimsApiBaseUrl = 'https://geoclientbackend.shandong-buxie.workers.dev';

function claimsPageText(lang) {
    return lang === 'en'
        ? {
            loading: 'Loading applications...', empty: 'No applications found.', error: 'Could not load applications',
            refresh: 'Refresh', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', completed: 'Completed',
            approve: 'Approve', approving: 'Approving...', reject: 'Reject', rejecting: 'Rejecting...',
            rejectConfirm: 'Reject this application?', rejectError: 'Rejection failed',
            openConversation: 'Open conversation', request: 'Campaign', creator: 'Creator',
            email: 'Email', dates: 'Campaign dates', reward: 'Reward', budget: 'Budget', perks: 'Perks',
            submitted: 'Applied', noPerks: 'No additional perks', approveError: 'Approval failed'
        }
        : {
            loading: '正在加载报名信息...', empty: '暂无活动报名。', error: '无法加载报名信息',
            refresh: '刷新', pending: '待审核', approved: '已通过', rejected: '已拒绝', completed: '已完成',
            approve: '通过', approving: '处理中...', reject: '拒绝', rejecting: '处理中...',
            rejectConfirm: '确定拒绝这条报名吗？', rejectError: '拒绝失败',
            openConversation: '打开对话', request: '活动', creator: '达人',
            email: '邮箱', dates: '活动日期', reward: '奖励', budget: '预算', perks: '福利',
            submitted: '报名时间', noPerks: '暂无额外福利', approveError: '审核失败'
        };
}

function formatClaimDate(value, lang) {
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(lang === 'en' ? 'en' : 'zh-CN');
}

function claimStatusKey(status) {
    const normalized = String(status || 'pending').toLowerCase();
    if (['approved', 'accepted', 'confirmed'].includes(normalized)) return 'approved';
    if (['rejected', 'declined', 'denied'].includes(normalized)) return 'rejected';
    if (normalized === 'completed') return 'completed';
    return 'pending';
}

function appendClaimText(parent, text, style) {
    if (!text) return;
    const element = document.createElement('p');
    element.style.cssText = style || 'margin:6px 0 0;color:var(--text-muted);font-size:.86rem;';
    element.textContent = text;
    parent.appendChild(element);
}

function renderClaimsSummary(claims, container, lang) {
    const labels = claimsPageText(lang);
    const pending = claims.filter(claim => claimStatusKey(claim.status) === 'pending').length;
    const approved = claims.filter(claim => claimStatusKey(claim.status) === 'approved').length;
    const completed = claims.filter(claim => claimStatusKey(claim.status) === 'completed').length;
    container.replaceChildren();
    [
        { label: lang === 'en' ? 'Total' : '报名总数', value: claims.length },
        { label: labels.pending, value: pending },
        { label: labels.approved, value: approved },
        { label: labels.completed, value: completed }
    ].forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.style.cssText = 'margin:0;padding:12px 16px;min-width:110px;';
        const label = document.createElement('span');
        label.style.cssText = 'display:block;color:var(--text-muted);font-size:.78rem;';
        label.textContent = item.label;
        const value = document.createElement('strong');
        value.style.cssText = 'display:block;margin-top:4px;color:var(--text-main);font-size:1.2rem;';
        value.textContent = item.value;
        card.append(label, value);
        container.appendChild(card);
    });
}

function renderClaimCard(claim, lang) {
    const labels = claimsPageText(lang);
    const card = document.createElement('article');
    card.className = 'content-card';
    card.style.cssText = 'margin-bottom:14px;padding:18px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;';
    const titleGroup = document.createElement('div');
    titleGroup.style.cssText = 'min-width:0;flex:1;';
    const requestTitle = document.createElement('h3');
    requestTitle.style.cssText = 'margin:0;color:var(--text-main);font-size:1rem;line-height:1.5;';
    const requestTitleText = claim.request?.title || `${labels.request} ${claim.requestId || ''}`;
    if (claim.requestId) {
        const requestLink = document.createElement('a');
        const langQuery = new URLSearchParams(window.location.search).get('lang');
        requestLink.href = `/index.html/requests/${encodeURIComponent(claim.requestId)}${langQuery ? `?lang=${encodeURIComponent(langQuery)}` : ''}`;
        requestLink.textContent = requestTitleText;
        requestLink.style.cssText = 'color:var(--primary-color);text-decoration:none;';
        requestLink.addEventListener('mouseenter', () => { requestLink.style.textDecoration = 'underline'; });
        requestLink.addEventListener('mouseleave', () => { requestLink.style.textDecoration = 'none'; });
        requestTitle.appendChild(requestLink);
    } else {
        requestTitle.textContent = requestTitleText;
    }
    titleGroup.appendChild(requestTitle);
    const creator = document.createElement('p');
    creator.style.cssText = 'margin:6px 0 0;color:var(--text-muted);font-size:.86rem;';
    creator.textContent = `${labels.creator}: ${claim.influencerName || '—'}${claim.influencerEmail ? ` · ${claim.influencerEmail}` : ''}`;
    titleGroup.appendChild(creator);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const statusKey = claimStatusKey(claim.status);
    const badge = document.createElement('span');
    badge.style.cssText = 'white-space:nowrap;padding:4px 10px;border-radius:12px;font-size:.76rem;font-weight:600;';
    badge.textContent = labels[statusKey];
    badge.style.background = statusKey === 'approved' ? 'rgba(16,185,129,.13)' : (statusKey === 'completed' ? 'rgba(59,130,246,.13)' : (statusKey === 'rejected' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.14)'));
    badge.style.color = statusKey === 'approved' ? '#059669' : (statusKey === 'completed' ? '#2563eb' : (statusKey === 'rejected' ? '#dc2626' : '#b45309'));
    actions.appendChild(badge);

    if (claim.requestId && claim.influencerEmail) {
        const conversationLink = document.createElement('a');
        const langQuery = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('lang') || 'zh';
        const detailUrl = new URL(`/index.html/conversations/${encodeURIComponent(claim.requestId)}`, window.location.origin);
        detailUrl.searchParams.set('lang', langQuery);
        detailUrl.searchParams.set('email', claim.influencerEmail);
        conversationLink.href = detailUrl.toString();
        conversationLink.textContent = labels.openConversation;
        conversationLink.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:7px 12px;background:rgba(102,126,234,.15);border:1px solid rgba(102,126,234,.3);border-radius:8px;color:#818cf8;cursor:pointer;font-family:inherit;font-size:.82rem;line-height:1.2;text-decoration:none;white-space:nowrap;';
        conversationLink.addEventListener('click', event => {
            event.preventDefault();
            if (typeof window.openConversationDetail === 'function') {
                window.openConversationDetail(claim.requestId, claim.influencerEmail, claim.influencerName, claim.request?.title);
            } else if (typeof window.showSection === 'function') {
                window.showSection('conversation-detail', true, claim.requestId);
            }
        });
        actions.appendChild(conversationLink);
    }

    if (statusKey === 'pending' && claim.id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'action-btn';
        button.style.cssText = 'padding:7px 12px;background:#10b981;color:#fff;border:0;border-radius:7px;cursor:pointer;';
        button.textContent = labels.approve;
        button.addEventListener('click', async () => {
            const token = localStorage.getItem('authToken');
            if (!token || button.disabled) return;
            button.disabled = true;
            button.textContent = labels.approving;
            try {
                const response = await fetch(`${claimsApiBaseUrl}/api/claims/${encodeURIComponent(claim.id)}/approve`, {
                    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) throw new Error(result.error || result.message || `HTTP ${response.status}`);
                claim.status = result.claim?.status || result.status || 'approved';
                renderClaimsSummary(window.allClaims || [], document.getElementById('claimsSummary'), lang);
                badge.textContent = labels.approved;
                badge.style.background = 'rgba(16,185,129,.13)';
                badge.style.color = '#059669';
                button.remove();
                rejectBtn?.remove();
            } catch (error) {
                button.disabled = false;
                button.textContent = labels.approve;
                let message = card.querySelector('[data-approve-error]');
                if (!message) {
                    message = document.createElement('p');
                    message.dataset.approveError = 'true';
                    message.style.cssText = 'width:100%;margin:8px 0 0;color:#dc2626;font-size:.82rem;';
                    actions.appendChild(message);
                }
                message.textContent = `${labels.approveError}: ${error.message}`;
            }
        });
        actions.appendChild(button);
        const rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.style.cssText = 'padding:7px 12px;border:1px solid #fecaca;border-radius:7px;background:#fff;color:#dc2626;cursor:pointer;font-size:.82rem;';
        rejectBtn.textContent = labels.reject;
        rejectBtn.addEventListener('click', async () => {
            if (rejectBtn.disabled) return;
            if (!confirm(labels.rejectConfirm)) return;
            const token = localStorage.getItem('authToken');
            if (!token) return;
            rejectBtn.disabled = true;
            rejectBtn.textContent = labels.rejecting;
            try {
                const response = await fetch(`${claimsApiBaseUrl}/api/claims/${encodeURIComponent(claim.id)}/reject`, {
                    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) throw new Error(result.error || result.message || `HTTP ${response.status}`);
                claim.status = result.claim?.status || 'rejected';
                renderClaimsSummary(window.allClaims || [], document.getElementById('claimsSummary'), lang);
                badge.textContent = labels.rejected;
                badge.style.background = 'rgba(239,68,68,.12)';
                badge.style.color = '#dc2626';
                button.remove();
                rejectBtn.remove();
            } catch (error) {
                rejectBtn.disabled = false;
                rejectBtn.textContent = labels.reject;
                alert(`${labels.rejectError}: ${error.message}`);
            }
        });
        actions.appendChild(rejectBtn);
    }
    header.append(titleGroup, actions);
    card.appendChild(header);

    const request = claim.request || {};
    const details = document.createElement('div');
    details.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color);';
    const rewardNames = lang === 'en'
        ? { free_meal: 'Free dining', cash: 'Cash reward', discount: 'Discount', gift: 'Gift' }
        : { free_meal: '免费餐饮', cash: '现金奖励', discount: '折扣优惠', gift: '礼品' };
    const budget = Number(request.budgetAmount || 0);
    const currency = lang === 'en' ? `£${budget.toLocaleString()}` : `￥${budget.toLocaleString()}`;
    const detailItems = [
        [labels.dates, [request.startDate, request.endDate].filter(Boolean).map(value => value.slice(0, 10)).join(' – ')],
        [labels.reward, rewardNames[request.rewardType] || request.rewardType],
        [labels.budget, currency]
    ].filter(item => item[1]);
    detailItems.forEach(([label, value]) => {
        const item = document.createElement('div');
        const key = document.createElement('span');
        key.style.cssText = 'display:block;color:var(--text-muted);font-size:.76rem;';
        key.textContent = label;
        const content = document.createElement('strong');
        content.style.cssText = 'display:block;margin-top:4px;color:var(--text-main);font-size:.86rem;';
        content.textContent = value;
        item.append(key, content);
        details.appendChild(item);
    });
    card.appendChild(details);
    appendClaimText(card, request.description);
    appendClaimText(card, `${labels.perks}: ${request.perks || labels.noPerks}`);
    appendClaimText(card, `${labels.submitted}: ${formatClaimDate(claim.createdAt, lang)}`);
    if (claim.notes) appendClaimText(card, claim.notes, 'margin:10px 0 0;color:var(--text-main);font-size:.86rem;white-space:pre-wrap;');
    return card;
}

async function loadClaimsFromComponent(forceReload = false) {
    const list = document.getElementById('claimsList');
    const summary = document.getElementById('claimsSummary');
    if (!list || !summary) return;
    if (window.claimsLoaded && !forceReload) return;
    if (window.isClaimsRequestInProgress) return;

    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const labels = claimsPageText(lang);
    const token = localStorage.getItem('authToken');
    if (!token) {
        list.replaceChildren();
        const authMessage = document.createElement('div');
        authMessage.className = 'content-card';
        authMessage.style.cssText = 'padding:20px;color:var(--text-muted);';
        authMessage.textContent = lang === 'en' ? 'Please sign in to view applications.' : '请登录后查看报名信息。';
        list.appendChild(authMessage);
        return;
    }
    window.isClaimsRequestInProgress = true;
    list.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'content-card';
    loading.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);';
    loading.textContent = labels.loading;
    list.appendChild(loading);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(`${claimsApiBaseUrl}/api/claims`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        const claims = Array.isArray(data.claims) ? data.claims : [];
        window.allClaims = claims;
        renderClaimsSummary(claims, summary, lang);
        list.replaceChildren();
        if (!claims.length) {
            const empty = document.createElement('div');
            empty.className = 'content-card';
            empty.style.cssText = 'text-align:center;padding:40px;color:var(--text-muted);';
            empty.textContent = labels.empty;
            list.appendChild(empty);
        } else {
            claims.forEach(claim => list.appendChild(renderClaimCard(claim, lang)));
        }
        window.claimsLoaded = true;
    } catch (error) {
        list.replaceChildren();
        const errorCard = document.createElement('div');
        errorCard.className = 'content-card';
        errorCard.style.cssText = 'padding:20px;color:#dc2626;';
        const message = document.createElement('p');
        message.style.margin = '0 0 12px';
        message.textContent = error.name === 'AbortError'
            ? (lang === 'en' ? 'The request timed out. Please try again.' : '请求超时，请重试。')
            : `${labels.error}: ${error.message}`;
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'action-btn';
        retryButton.style.cssText = 'padding:7px 12px;';
        retryButton.textContent = labels.refresh;
        retryButton.addEventListener('click', () => loadClaimsFromComponent(true));
        errorCard.append(message, retryButton);
        list.appendChild(errorCard);
        console.error('Load claims error:', error);
    } finally {
        clearTimeout(timeoutId);
        window.isClaimsRequestInProgress = false;
    }
}

window.loadClaimsFromComponent = loadClaimsFromComponent;
function initializeClaimsPage(root) {
    root.dataset.componentScript = 'claims';
    root.querySelector('#refreshClaimsBtn')?.addEventListener('click', () => loadClaimsFromComponent(true));
    loadClaimsFromComponent();
}

if (typeof window.registerPageComponent === 'function') {
    window.registerPageComponent('influencers', initializeClaimsPage);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeClaimsPage(document), { once: true });
} else {
    initializeClaimsPage(document);
}
