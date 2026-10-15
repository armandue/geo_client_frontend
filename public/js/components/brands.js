/* Merchant page — brand profile + store management (brand_stores CRUD). */
const merchantApiBaseUrl = 'https://geo-client-backend.shandong-buxie.workers.dev';

function merchantText(lang) {
    return lang === 'en'
        ? {
            loading: 'Loading brand info...', loadError: 'Could not load brand info',
            storesTitle: 'Stores', storesSubtitle: 'Manage your store locations for campaign check-ins',
            addStore: '+ Add store', noStores: 'No stores yet. Add your first store to link it to campaigns.',
            edit: 'Edit', delete: 'Delete', deleteConfirm: 'Delete this store? Campaigns linked to it will lose the link.',
            storeName: 'Store name', address: 'Address', longitude: 'Longitude', latitude: 'Latitude', phone: 'Phone',
            status: 'Status', active: 'Active', inactive: 'Inactive',
            save: 'Save', saving: 'Saving...', cancel: 'Close', create: 'Create',
            required: 'Store name and address are required.',
            coordError: 'Invalid coordinates. Longitude: -180~180, Latitude: -90~90.',
            saveFailed: 'Save failed', deleteFailed: 'Delete failed', createFailed: 'Create failed',
            editStore: 'Edit store', newStore: 'New store'
        }
        : {
            loading: '正在加载品牌信息...', loadError: '无法加载品牌信息',
            storesTitle: '门店管理', storesSubtitle: '管理门店地址，用于活动关联与达人到店',
            addStore: '+ 新增门店', noStores: '暂无门店，先添加门店再关联到活动吧。',
            edit: '编辑', delete: '删除', deleteConfirm: '确定删除该门店吗？已关联的活动将失去关联。',
            storeName: '门店名称', address: '地址', longitude: '经度', latitude: '纬度', phone: '电话',
            status: '状态', active: '营业中', inactive: '已停用',
            save: '保存', saving: '保存中...', cancel: '关闭', create: '创建',
            required: '门店名称和地址为必填。',
            coordError: '坐标无效。经度：-180~180，纬度：-90~90。',
            saveFailed: '保存失败', deleteFailed: '删除失败', createFailed: '创建失败',
            editStore: '编辑门店', newStore: '新增门店'
        };
}

const merchantEscapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderMerchantStores(stores, container, lang) {
    const t = merchantText(lang);
    container.replaceChildren();
    if (!stores.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'margin:0;color:var(--text-muted);font-size:.86rem;';
        empty.textContent = t.noStores;
        container.appendChild(empty);
        return;
    }
    stores.forEach(store => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.style.cssText = 'margin-bottom:12px;padding:16px;';
        const isActive = String(store.status || 'active') === 'active';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                <div style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <strong style="color:var(--text-main);font-size:.95rem;">${merchantEscapeHtml(store.storeName)}</strong>
                        <span style="padding:2px 9px;border-radius:10px;font-size:.72rem;font-weight:600;${isActive ? 'background:rgba(16,185,129,.13);color:#059669;' : 'background:#f1f5f9;color:var(--text-muted);'}">${isActive ? t.active : t.inactive}</span>
                    </div>
                    <p style="margin:6px 0 0;color:var(--text-muted);font-size:.84rem;">${merchantEscapeHtml(store.address || '')}</p>
                    ${(store.phone || store.longitude != null) ? `<p style="margin:4px 0 0;color:var(--text-muted);font-size:.78rem;">${merchantEscapeHtml(store.phone || '')}${store.longitude != null ? ` · ${store.longitude}, ${store.latitude}` : ''}</p>` : ''}
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button type="button" data-edit style="padding:6px 14px;border:1px solid var(--border-color);border-radius:7px;background:#fff;color:var(--text-main);font-size:.8rem;cursor:pointer;">${t.edit}</button>
                    <button type="button" data-del style="padding:6px 14px;border:1px solid #fecaca;border-radius:7px;background:#fff;color:#dc2626;font-size:.8rem;cursor:pointer;">${t.delete}</button>
                </div>
            </div>`;
        card.querySelector('[data-edit]').addEventListener('click', () => openStoreModal(store));
        card.querySelector('[data-del]').addEventListener('click', async () => {
            if (!confirm(t.deleteConfirm)) return;
            const token = localStorage.getItem('authToken');
            try {
                const response = await fetch(`${merchantApiBaseUrl}/api/brand-stores/${encodeURIComponent(store.id)}`, {
                    method: 'DELETE',
                    headers: { Authorization: token }
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
                window.__brandStores = (window.__brandStores || []).filter(s => s.id !== store.id);
                await loadMerchantPage(true);
            } catch (error) {
                console.error('Delete store error:', error);
                alert(`${t.deleteFailed}: ${error.message}`);
            }
        });
        container.appendChild(card);
    });
}

function openStoreModal(store) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = merchantText(lang);
    const isEdit = !!(store && store.id);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,20,33,.6);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;';
    const input = 'width:100%;padding:9px 12px;border:1px solid var(--border-color);border-radius:8px;font-size:.9rem;box-sizing:border-box;';
    const label = 'display:block;margin:14px 0 6px;font-size:.82rem;color:var(--text-muted);font-weight:600;';
    overlay.innerHTML = `
        <div style="width:min(94vw,520px);background:#fff;border-radius:14px;padding:24px;color:#111827;margin:auto;">
            <h3 style="margin:0 0 6px;font-size:1.05rem;">${isEdit ? t.editStore : t.newStore}</h3>
            <label style="${label}">${t.storeName} *</label><input data-f="storeName" value="${merchantEscapeHtml(store?.storeName || '')}" style="${input}">
            <label style="${label}">${t.address} *</label><input data-f="address" value="${merchantEscapeHtml(store?.address || '')}" style="${input}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div><label style="${label}">${t.longitude}</label><input data-f="longitude" type="number" step="any" value="${store?.longitude ?? ''}" placeholder="e.g. -0.1278" style="${input}"></div>
                <div><label style="${label}">${t.latitude}</label><input data-f="latitude" type="number" step="any" value="${store?.latitude ?? ''}" placeholder="e.g. 51.5074" style="${input}"></div>
            </div>
            <label style="${label}">${t.phone}</label><input data-f="phone" value="${merchantEscapeHtml(store?.phone || '')}" style="${input}">
            ${isEdit ? `<label style="${label}">${t.status}</label><select data-f="status" style="${input}"><option value="active"${String(store.status || 'active') === 'active' ? ' selected' : ''}>${t.active}</option><option value="inactive"${store.status === 'inactive' ? ' selected' : ''}>${t.inactive}</option></select>` : ''}
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">
                <button type="button" data-close style="padding:9px 18px;border:1px solid var(--border-color);background:#fff;border-radius:8px;cursor:pointer;">${t.cancel}</button>
                <button type="button" data-save style="padding:9px 22px;border:0;background:var(--primary-color);color:#fff;border-radius:8px;font-weight:600;cursor:pointer;">${isEdit ? t.save : t.create}</button>
            </div>
            <p data-error style="display:none;margin:12px 0 0;color:#dc2626;font-size:.82rem;"></p>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-close]').addEventListener('click', close);

    overlay.querySelector('[data-save]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const errEl = overlay.querySelector('[data-error]');
        const val = k => overlay.querySelector(`[data-f="${k}"]`).value.trim();
        const storeName = val('storeName'), address = val('address');
        errEl.style.display = 'none';
        if (!storeName || !address) { errEl.textContent = t.required; errEl.style.display = 'block'; return; }
        const lngRaw = val('longitude'), latRaw = val('latitude');
        const longitude = lngRaw === '' ? null : Number(lngRaw);
        const latitude = latRaw === '' ? null : Number(latRaw);
        if ((longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
            (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))) {
            errEl.textContent = t.coordError; errEl.style.display = 'block'; return;
        }
        const body = { storeName, address, longitude, latitude, phone: val('phone') || null };
        if (isEdit) body.status = overlay.querySelector('[data-f="status"]').value;

        btn.disabled = true;
        btn.textContent = t.saving;
        try {
            const url = isEdit
                ? `${merchantApiBaseUrl}/api/brand-stores/${encodeURIComponent(store.id)}`
                : `${merchantApiBaseUrl}/api/brand-stores`;
            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { Authorization: localStorage.getItem('authToken'), 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
            window.__brandStores = null;
            close();
            await loadMerchantPage(true);
        } catch (error) {
            console.error('Save store error:', error);
            errEl.textContent = `${isEdit ? t.saveFailed : t.createFailed}: ${error.message}`;
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = isEdit ? t.save : t.create;
        }
    });
}

async function loadMerchantPage(forceReload = false) {
    const section = document.getElementById('section-merchant');
    if (!section) return;
    if (window.merchantLoaded && !forceReload) return;
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = merchantText(lang);
    const token = localStorage.getItem('authToken');
    const storesList = document.getElementById('merchantStoresList');
    if (!token || !storesList) return;

    storesList.innerHTML = `<p style="margin:0;color:var(--text-muted);font-size:.86rem;">${t.loading}</p>`;
    try {
        const response = await fetch(`${merchantApiBaseUrl}/api/my-brand`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok || data.success === false || !data.brand) throw new Error(data.error || `HTTP ${response.status}`);
        const brand = data.brand;
        window.__brandStores = Array.isArray(brand.stores) ? brand.stores : [];
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set('detValueNameZh', brand.nameZh || '-');
        set('detValueNameEn', brand.nameEn || '-');
        set('detValueIndustry', brand.industry || '-');
        set('detValueEmail', brand.email || '-');
        set('detValuePhone', brand.phone || '-');
        renderMerchantStores(window.__brandStores, storesList, lang);
        window.merchantLoaded = true;
    } catch (error) {
        console.error('Load merchant error:', error);
        storesList.innerHTML = `<p style="margin:0;color:#dc2626;font-size:.86rem;">${t.loadError}: ${merchantEscapeHtml(error.message)}</p>`;
    }
}

function updateMerchantLanguage(lang) {
    const t = merchantText(lang === 'en' ? 'en' : 'zh');
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('merchantStoresTitle', t.storesTitle);
    set('merchantStoresSubtitle', t.storesSubtitle);
    set('btnAddStore', t.addStore);
    if (window.__brandStores) {
        const list = document.getElementById('merchantStoresList');
        if (list) renderMerchantStores(window.__brandStores, list, lang === 'en' ? 'en' : 'zh');
    }
}

window.loadMerchantPage = loadMerchantPage;
window.updateMerchantLanguage = updateMerchantLanguage;
window.openStoreModal = openStoreModal;

window.registerPageComponent('merchant', function (root) {
    root.dataset.componentScript = 'merchant';
    root.querySelector('#btnAddStore')?.addEventListener('click', () => openStoreModal(null));
    loadMerchantPage();
});
