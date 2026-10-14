const campaignRewardIcons = { free_meal:{icon:'🍽️',color:'#10b981',bg:'rgba(16,185,129,.15)'}, cash:{icon:'💰',color:'#f59e0b',bg:'rgba(245,158,11,.15)'}, discount:{icon:'🎫',color:'#3b82f6',bg:'rgba(59,130,246,.15)'}, gift:{icon:'🎁',color:'#8b5cf6',bg:'rgba(139,92,246,.15)'} };
const campaignStatuses = { open:{key:'campStatusOpen',dot:'🟢'}, closed:{key:'campStatusClosed',dot:'🔴'}, draft:{key:'campStatusDraft',dot:'🟡'} };
const campaignDate = value => value ? value.slice(0,10) : '';
const campaignEscapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderCampaignCardFromComponent(request) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const text = window.pageI18n?.[lang] || {};
    const reward = campaignRewardIcons[request.rewardType] || campaignRewardIcons.gift;
    const status = campaignStatuses[request.status] || campaignStatuses.open;
    const perks = request.perks ? `<span style="font-size:.78rem;color:#818cf8;background:rgba(102,126,234,.12);padding:2px 8px;border-radius:4px;">${campaignEscapeHtml(request.perks)}</span>` : '';
    const item = document.createElement('div');
    item.className = 'message-item';
    item.dataset.requestId = request.id;
    item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
    item.innerHTML = `<div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;"><div class="message-avatar" style="background:${reward.bg};color:${reward.color};font-size:20px;">${reward.icon}</div><div class="message-content" style="flex:1;min-width:0;"><h5>${campaignEscapeHtml(request.title)} <span style="font-size:.72rem;padding:2px 7px;border-radius:10px;background:#f1f5f9;color:var(--text-muted);">${status.dot} ${text[status.key] || request.status}</span> ${perks}</h5><p>${campaignEscapeHtml(request.description)}</p><span class="message-time">${request.rewardType} · ${campaignDate(request.startDate)} → ${campaignDate(request.endDate)}</span></div></div><button class="btn-detail" style="padding:8px 16px;background:rgba(102,126,234,.15);border:1px solid rgba(102,126,234,.3);border-radius:8px;color:#818cf8;cursor:pointer;">${text.btnDetail || '查看详情'}</button>`;
    item.querySelector('.btn-detail')?.addEventListener('click', event => { event.stopPropagation(); window.showCampaignDetail?.(request); });
    return item;
}

async function loadCampaignsFromComponent(forceReload = false) {
    if (window.campaignsLoaded && !forceReload) return;
    const list = document.getElementById('campaignList');
    const loading = document.getElementById('campaignLoading');
    if (!list) return;
    if (loading) loading.style.display = 'block';
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/requests`, { headers:{ Authorization:token, 'Content-Type':'application/json' } });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'API error');
        Array.from(list.children).forEach(child => { if (child.id !== 'campaignLoading') child.remove(); });
        window.allCampaigns = data.requests || [];
        window._allCampaigns = window.allCampaigns;
        if (!window.allCampaigns.length) { const empty = document.createElement('div'); empty.style.cssText='text-align:center;padding:40px;color:#4b5563;'; empty.textContent=(window.pageI18n?.[localStorage.getItem('lang') || 'zh'] || {}).campEmpty || '暂无活动'; list.appendChild(empty); }
        else window.allCampaigns.forEach(request => list.appendChild(renderCampaignCardFromComponent(request)));
        window.campaignsLoaded = true;
    } catch (error) { if (loading) loading.textContent = `⚠ ${error.message}`; console.error('loadCampaigns error:', error); }
    finally { if (loading) loading.style.display = 'none'; }
}

window.loadCampaignsFromComponent = loadCampaignsFromComponent;
window.renderCampaignCardFromComponent = renderCampaignCardFromComponent;
window.registerPageComponent('campaigns', root => { root.dataset.componentScript = 'campaigns'; });
