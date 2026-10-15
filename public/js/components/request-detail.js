function prepareImageForUpload(file) {
    return new Promise((resolve, reject) => {
        const source = new Image();
        const objectUrl = URL.createObjectURL(file);
        source.onload = () => {
            const aspectRatio = 16 / 9;
            const baseCropWidth = source.width / source.height > aspectRatio ? source.height * aspectRatio : source.width;
            const baseCropHeight = baseCropWidth / aspectRatio;
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,20,33,.86);display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `<div style="width:min(92vw,560px);background:#fff;border-radius:12px;padding:20px;color:#111827;"><h3 style="margin:0 0 14px;font-size:1rem;">裁切图片（16:9）</h3><div style="display:flex;justify-content:center;background:#f3f4f6;border-radius:8px;padding:12px;"><canvas style="width:min(88vw,512px);height:auto;aspect-ratio:16/9;cursor:grab;touch-action:none;"></canvas></div><label style="display:flex;align-items:center;gap:10px;margin:16px 0;font-size:.85rem;">缩放<input type="range" min="1" max="3" step=".01" value="1" style="flex:1;"><output>1.00x</output></label><div style="display:flex;justify-content:flex-end;gap:10px;"><button type="button" data-cancel style="padding:8px 14px;border:1px solid #d1d5db;background:#fff;border-radius:6px;cursor:pointer;">取消</button><button type="button" data-confirm style="padding:8px 14px;border:0;background:#667eea;color:#fff;border-radius:6px;cursor:pointer;">确认裁切</button></div></div>`;
            document.body.appendChild(modal);
            const canvas = modal.querySelector('canvas');
            const zoomInput = modal.querySelector('input');
            const output = modal.querySelector('output');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 288;
            let offsetX = 0;
            let offsetY = 0;
            let dragging = false;
            let lastPointerX = 0;
            let lastPointerY = 0;

            const draw = () => {
                const zoom = Number(zoomInput.value);
                const cropWidth = baseCropWidth / zoom;
                const cropHeight = baseCropHeight / zoom;
                const maxOffsetX = (source.width - cropWidth) / 2;
                const maxOffsetY = (source.height - cropHeight) / 2;
                offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
                offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
                const sx = (source.width - cropWidth) / 2 + offsetX;
                const sy = (source.height - cropHeight) / 2 + offsetY;
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(source, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
                output.value = `${zoom.toFixed(2)}x`;
            };
            const close = () => { URL.revokeObjectURL(objectUrl); modal.remove(); };
            zoomInput.addEventListener('input', draw);
            canvas.addEventListener('pointerdown', event => {
                dragging = true;
                lastPointerX = event.clientX;
                lastPointerY = event.clientY;
                canvas.setPointerCapture(event.pointerId);
                canvas.style.cursor = 'grabbing';
            });
            canvas.addEventListener('pointermove', event => {
                if (!dragging) return;
                const zoom = Number(zoomInput.value);
                const cropWidth = baseCropWidth / zoom;
                const cropHeight = baseCropHeight / zoom;
                offsetX -= (event.clientX - lastPointerX) * cropWidth / canvas.clientWidth;
                offsetY -= (event.clientY - lastPointerY) * cropHeight / canvas.clientHeight;
                lastPointerX = event.clientX;
                lastPointerY = event.clientY;
                draw();
            });
            canvas.addEventListener('pointerup', () => { dragging = false; canvas.style.cursor = 'grab'; });
            canvas.addEventListener('pointercancel', () => { dragging = false; canvas.style.cursor = 'grab'; });
            modal.querySelector('[data-cancel]').addEventListener('click', () => { close(); resolve(null); });
            modal.querySelector('[data-confirm]').addEventListener('click', () => {
                canvas.toBlob(blob => {
                    if (!blob) { close(); reject(new Error('Failed to crop image')); return; }
                    close();
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                }, 'image/jpeg', .92);
            });
            draw();
        };
        source.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to read image')); };
        source.src = objectUrl;
    });
}

async function uploadRequestImageFromDetail(file) {
    const requestId = window.currentDetailRequestId;
    if (!requestId) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const lang = localStorage.getItem('lang') || 'zh';
    const allowedTypes = { 'image/jpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp' };
    if (!allowedTypes[file.type]) {
        alert(lang === 'en' ? 'Unsupported file type. Please upload JPG, PNG or WebP.' : '不支持的文件格式，请上传 JPG、PNG 或 WebP 图片。');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert(lang === 'en' ? 'File too large. Maximum size is 10MB.' : '文件过大，最大支持 10MB。');
        return;
    }

    let preparedFile;
    try {
        preparedFile = await prepareImageForUpload(file);
    } catch (error) {
        console.error('Image crop error:', error);
        return;
    }
    if (!preparedFile) return;
    file = preparedFile;

    const progressEl = document.getElementById('imageUploadProgress');
    const statusEl = document.getElementById('imageUploadStatus');
    const barEl = document.getElementById('imageUploadBar');
    const contentType = 'image/jpeg';

    if (progressEl) progressEl.style.display = 'block';
    if (statusEl) statusEl.textContent = lang === 'en' ? 'Requesting upload URL...' : '正在获取上传地址...';
    if (barEl) barEl.style.width = '20%';

    try {
        const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/images`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType })
        });
        const data = await response.json();
        const upload = data.upload;
        if (!data.success || !upload || !upload.url) throw new Error(data.error || 'Failed to get upload URL');

        const method = 'PUT';
        if (statusEl) statusEl.textContent = lang === 'en' ? 'Uploading image...' : '正在上传图片...';
        if (barEl) barEl.style.width = '50%';

        const uploadResponse = await fetch(upload.url, {
            method,
            headers: { ...(upload.headers || {}), 'Content-Type': contentType },
            body: file
        });
        if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

        if (barEl) barEl.style.width = '100%';
        if (statusEl) statusEl.textContent = lang === 'en' ? 'Upload complete!' : '上传完成！';
        if (data.image && typeof window.renderImageThumb === 'function') {
            const grid = document.getElementById('detailImageGrid');
            if (grid) window.renderImageThumb(data.image, grid, requestId);
        }
    } catch (error) {
        console.error('Upload error:', error);
        if (statusEl) statusEl.textContent = lang === 'en' ? `Upload failed: ${error.message}` : `上传失败：${error.message}`;
        if (barEl) barEl.style.background = '#ef4444';
    } finally {
        setTimeout(() => {
            if (progressEl) progressEl.style.display = 'none';
            if (barEl) { barEl.style.width = '0%'; barEl.style.background = 'var(--primary-color)'; }
        }, 1500);
    }
}

async function loadRequestImagesFromDetail(requestId) {
    window.currentDetailRequestId = requestId;
    const detailsTab = document.getElementById('detailTabBtn');
    if (detailsTab?.getAttribute('aria-selected') !== 'true') detailsTab?.click();
    const grid = document.getElementById('detailImageGrid');
    const countEl = document.getElementById('detailImageCount');
    if (!grid) return;

    grid.innerHTML = '';
    if (countEl) countEl.textContent = '';
    const deleteAllButton = document.getElementById('deleteAllImagesBtn');
    if (deleteAllButton) deleteAllButton.style.display = 'none';
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/images`, { headers: { Authorization: token } });
        const data = await response.json();
        const images = data.images && data.images.length > 0
            ? data.images
            : (data.urls || []).map(url => ({ url }));
        if (data.success && images.length > 0) {
            const lang = localStorage.getItem('lang') || 'zh';
            if (countEl) countEl.textContent = lang === 'en' ? `${images.length} image(s)` : `${images.length} 张图片`;
            if (deleteAllButton) deleteAllButton.style.display = 'inline-block';
            images.forEach(image => renderImageThumbFromDetail(image, grid, requestId));
        }
    } catch (error) {
        console.error('Load images error:', error);
    }
}

function renderRequestClaimsFromDetail(claims, container, lang) {
    container.innerHTML = '';
    if (!claims.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'margin:0;color:var(--text-muted);';
        empty.textContent = lang === 'en' ? 'No claims for this campaign yet.' : '当前活动暂无报名。';
        container.appendChild(empty);
        return;
    }

    const labels = lang === 'en'
        ? { anonymous: 'Creator', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' }
        : { anonymous: '达人', pending: '待审核', approved: '已通过', rejected: '已拒绝', completed: '已完成' };

    claims.forEach((claim, index) => {
        const profile = claim.influencer || claim.creator || claim.applicant || claim.user || {};
        const platformValue = claim.platformName || claim.platform || claim.platformKey || profile.platformName || profile.platform || '';
        const platform = typeof platformValue === 'object' ? (platformValue.name || platformValue.platformKey || '') : platformValue;
        const name = claim.influencerName || claim.creatorName || claim.applicantName || profile.displayName || profile.name || profile.username || profile.handle || `${labels.anonymous} ${index + 1}`;
        const statusValue = String(claim.status || 'pending').toLowerCase();
        const statusKey = ['approved', 'accepted', 'confirmed'].includes(statusValue)
            ? 'approved'
            : (['rejected', 'declined', 'denied'].includes(statusValue)
                ? 'rejected'
                : (statusValue === 'completed' ? 'completed' : 'pending'));
        const statusText = claim.statusLabel || labels[statusKey];
        const card = document.createElement('article');
        card.className = 'content-card';
        card.style.cssText = 'margin-bottom:12px;padding:16px;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';
        const identity = document.createElement('div');
        identity.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;';
        const nameEl = document.createElement('h4');
        nameEl.style.cssText = 'margin:0;font-size:.98rem;color:var(--text-main);';
        nameEl.textContent = name;
        const statusEl = document.createElement('span');
        statusEl.style.cssText = statusKey === 'completed'
            ? 'flex-shrink:0;padding:3px 9px;border-radius:12px;font-size:.75rem;background:rgba(59,130,246,.13);color:#2563eb;'
            : (statusKey === 'approved'
                ? 'flex-shrink:0;padding:3px 9px;border-radius:12px;font-size:.75rem;background:rgba(16,185,129,.13);color:#059669;'
                : (statusKey === 'rejected'
                    ? 'flex-shrink:0;padding:3px 9px;border-radius:12px;font-size:.75rem;background:rgba(239,68,68,.12);color:#dc2626;'
                    : 'flex-shrink:0;padding:3px 9px;border-radius:12px;font-size:.75rem;background:rgba(245,158,11,.14);color:#b45309;'));
        statusEl.textContent = statusText;
        identity.append(nameEl, statusEl);
        header.appendChild(identity);
        const claimActions = document.createElement('div');
        claimActions.dataset.claimActions = 'true';
        claimActions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;';
        if (statusKey === 'pending' && claim.id) {
            const approveButton = document.createElement('button');
            approveButton.type = 'button';
            approveButton.textContent = lang === 'en' ? 'Approve' : '通过';
            approveButton.style.cssText = 'flex-shrink:0;padding:5px 12px;border:0;border-radius:6px;background:#10b981;color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;';
            approveButton.addEventListener('click', () => approveRequestClaimFromDetail(claim, approveButton, statusEl, lang));
            approveButton.dataset.reviewAction = 'true';
            claimActions.appendChild(approveButton);
            const rejectButton = document.createElement('button');
            rejectButton.type = 'button';
            rejectButton.dataset.reviewAction = 'true';
            rejectButton.textContent = lang === 'en' ? 'Reject' : '拒绝';
            rejectButton.style.cssText = 'flex-shrink:0;padding:5px 12px;border:1px solid #fecaca;border-radius:6px;background:#fff;color:#dc2626;font-size:.78rem;font-weight:600;cursor:pointer;';
            rejectButton.addEventListener('click', () => rejectRequestClaimFromDetail(claim, rejectButton, statusEl, lang));
            claimActions.appendChild(rejectButton);
        }
        if (claim.id) {
            const t2 = requestDetailPageText(lang);
            const postsButton = document.createElement('button');
            postsButton.type = 'button';
            const postCount = claim.meta?.totalPostCountPerPlatform
                ? Object.values(claim.meta.totalPostCountPerPlatform).reduce((a, b) => a + Number(b), 0)
                : 0;
            postsButton.textContent = `${t2.loadPosts}${postCount ? ` (${postCount})` : ''}`;
            postsButton.style.cssText = 'flex-shrink:0;padding:5px 12px;border:1px solid rgba(102,126,234,.3);border-radius:6px;background:rgba(102,126,234,.12);color:#818cf8;font-size:.78rem;font-weight:600;cursor:pointer;';
            claimActions.appendChild(postsButton);
            // Posts container is appended to the card below; wire after card assembly.
            postsButton.addEventListener('click', () => {
                const postsContainer = card.querySelector('[data-posts-container]');
                if (postsContainer) toggleClaimPostsFromDetail(claim, postsContainer, postsButton, lang);
            });
        }
        header.appendChild(claimActions);
        card.appendChild(header);

        const metadata = [];
        if (platform) metadata.push(String(platform));
        const email = claim.influencerEmail || profile.email;
        if (email) metadata.push(String(email));
        const followers = claim.followerCount ?? claim.followers ?? profile.followerCount ?? profile.followers;
        if (followers !== undefined && followers !== null && followers !== '') {
            metadata.push(`${lang === 'en' ? 'Followers' : '粉丝'}: ${Number(followers).toLocaleString()}`);
        }
        const submittedAt = claim.submittedAt || claim.appliedAt || claim.createdAt;
        if (submittedAt) metadata.push(new Date(submittedAt).toLocaleDateString(lang === 'en' ? 'en' : 'zh-CN'));
        if (metadata.length) {
            const metaEl = document.createElement('p');
            metaEl.style.cssText = 'margin:8px 0 0;color:var(--text-muted);font-size:.82rem;';
            metaEl.textContent = metadata.join(' · ');
            card.appendChild(metaEl);
        }

        const note = claim.notes || claim.message || claim.note || claim.bio || profile.bio;
        if (note) {
            const noteEl = document.createElement('p');
            noteEl.style.cssText = 'margin:10px 0 0;color:var(--text-main);font-size:.88rem;white-space:pre-wrap;';
            noteEl.textContent = note;
            card.appendChild(noteEl);
        }
        const bookingDate = claim.bookingDate;
        if (bookingDate) {
            const t3 = requestDetailPageText(lang);
            const bookingEl = document.createElement('p');
            bookingEl.style.cssText = 'margin:8px 0 0;color:var(--text-muted);font-size:.82rem;';
            bookingEl.textContent = `${t3.bookingDate}: ${String(bookingDate).slice(0, 10)}`;
            card.appendChild(bookingEl);
        }
        if (claim.id) {
            const postsContainer = document.createElement('div');
            postsContainer.dataset.postsContainer = 'true';
            postsContainer.style.cssText = 'display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color);';
            card.appendChild(postsContainer);
        }
        container.appendChild(card);
    });
}

async function approveRequestClaimFromDetail(claim, button, statusEl, lang) {
    if (!claim?.id || button.disabled) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    button.disabled = true;
    button.textContent = lang === 'en' ? 'Approving...' : '处理中...';
    try {
        const response = await fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claim.id)}/approve`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.error || data.message || `Request failed (${response.status})`);
        }

        claim.status = data.claim?.status || data.status || 'approved';
        statusEl.textContent = lang === 'en' ? 'Approved' : '已通过';
        statusEl.style.background = 'rgba(16,185,129,.14)';
        statusEl.style.color = '#059669';
        button.closest('[data-claim-actions]')?.querySelectorAll('[data-review-action]').forEach(b => b.remove());
    } catch (error) {
        console.error('Approve claim error:', error);
        button.disabled = false;
        button.textContent = lang === 'en' ? 'Approve' : '通过';
        let errorEl = button.closest('article')?.querySelector('[data-claim-approve-error]');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.dataset.claimApproveError = 'true';
            errorEl.style.cssText = 'margin:10px 0 0;color:#dc2626;font-size:.82rem;';
            button.closest('article')?.appendChild(errorEl);
        }
        if (errorEl) errorEl.textContent = lang === 'en' ? `Could not approve: ${error.message}` : `审核失败：${error.message}`;
    }
}

async function loadRequestClaimsFromDetail(requestId) {
    const container = document.getElementById('requestClaimsList');
    if (!requestId || !container) return;
    const requestKey = String(requestId);
    if (container.dataset.loadedRequestId === requestKey) return;
    if (container.dataset.loadingRequestId === requestKey) return;

    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    container.dataset.loadingRequestId = requestKey;
    container.textContent = lang === 'en' ? 'Loading claims...' : '正在加载报名信息...';
    try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        let request = window.currentDetailRequest?.id === requestKey ? window.currentDetailRequest : null;
        let claims = Array.isArray(request?.claims) && request.claims.length ? request.claims : null;
        if (!claims) {
            const response = await fetch(`${API_BASE_URL}/api/requests/${encodeURIComponent(requestKey)}`, {
                headers: { Authorization: token, 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok || data.success === false) throw new Error(data.error || data.message || `Request failed (${response.status})`);
            request = data.request || data;
            claims = Array.isArray(request.claims) ? request.claims : [];
            if (request.id === requestKey) window.currentDetailRequest = request;
        }
        if (String(window.currentDetailRequestId) !== requestKey) return;
        renderRequestClaimsFromDetail(claims, container, lang);
        container.dataset.loadedRequestId = requestKey;
    } catch (error) {
        if (String(window.currentDetailRequestId) !== requestKey) return;
        console.error('Load request claims error:', error);
        container.textContent = lang === 'en' ? `Failed to load claims: ${error.message}` : `加载报名信息失败：${error.message}`;
    } finally {
        if (container.dataset.loadingRequestId === requestKey) delete container.dataset.loadingRequestId;
    }
}

async function deleteAllRequestImages() {
    const requestId = window.currentDetailRequestId;
    if (!requestId) return;
    const lang = localStorage.getItem('lang') || 'zh';
    if (!confirm(lang === 'en' ? 'Delete all images for this activity?' : '确定删除该活动的全部图片吗？')) return;

    const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/images`, {
        method: 'DELETE',
        headers: { Authorization: localStorage.getItem('authToken') }
    });
    if (!response.ok) {
        alert(lang === 'en' ? 'Failed to delete images.' : '删除图片失败。');
        return;
    }

    const grid = document.getElementById('detailImageGrid');
    const countEl = document.getElementById('detailImageCount');
    const deleteAllButton = document.getElementById('deleteAllImagesBtn');
    if (grid) grid.innerHTML = '';
    if (countEl) countEl.textContent = '';
    if (deleteAllButton) deleteAllButton.style.display = 'none';
}

function renderImageThumbFromDetail(image, container, requestId) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--border-color);aspect-ratio:1;background:var(--bg-page);';
    const imageElement = document.createElement('img');
    imageElement.src = image.url;
    imageElement.alt = '';
    imageElement.loading = 'lazy';
    imageElement.style.cssText = 'width:100%;height:100%;object-fit:cover;cursor:pointer;display:block;';
    imageElement.onclick = () => openImagePreviewFromDetail(image.url);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '✕';
    deleteButton.style.cssText = 'position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;cursor:pointer;font-size:12px;opacity:0;';
    if (!image.id) deleteButton.style.display = 'none';
    deleteButton.onclick = async event => {
        event.stopPropagation();
        if (!confirm(localStorage.getItem('lang') === 'en' ? 'Delete this image?' : '确定删除这张图片？')) return;
        const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}/images/${image.id}`, { method: 'DELETE', headers: { Authorization: localStorage.getItem('authToken') } });
        if (response.ok) wrapper.remove();
    };
    wrapper.onmouseenter = () => deleteButton.style.opacity = '1';
    wrapper.onmouseleave = () => deleteButton.style.opacity = '0';
    wrapper.append(imageElement, deleteButton);
    container.appendChild(wrapper);
}

function openImagePreviewFromDetail(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.onclick = () => overlay.remove();
    const image = document.createElement('img');
    image.src = url;
    image.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;';
    overlay.appendChild(image);
    document.body.appendChild(overlay);
}

window.uploadRequestImageFromDetail = uploadRequestImageFromDetail;
window.loadRequestImagesFromDetail = loadRequestImagesFromDetail;
window.loadRequestClaimsFromDetail = loadRequestClaimsFromDetail;
window.renderImageThumb = renderImageThumbFromDetail;
window.deleteAllRequestImages = deleteAllRequestImages;

window.registerPageComponent('request-detail', function (root) {
    root.dataset.componentScript = 'request-detail';
    root.querySelector('#detailBackBtn')?.addEventListener('click', () => {
        if (typeof window.showSection === 'function') window.showSection('campaigns', true);
        else window.location.href = '/requests';
    });
    const imageHeader = root.querySelector('#detailImagesCard h4')?.parentElement;
    let deleteAllButton = root.querySelector('#deleteAllImagesBtn');
    if (!deleteAllButton && imageHeader) {
        deleteAllButton = document.createElement('button');
        deleteAllButton.id = 'deleteAllImagesBtn';
        deleteAllButton.type = 'button';
        deleteAllButton.textContent = '删除全部';
        deleteAllButton.style.cssText = 'display:none;border:0;background:none;color:#ef4444;cursor:pointer;font-size:.78rem;padding:0;';
        imageHeader.appendChild(deleteAllButton);
    }
    deleteAllButton?.addEventListener('click', deleteAllRequestImages);
    const detailTab = root.querySelector('#detailTabBtn');
    const claimsTab = root.querySelector('#claimsTabBtn');
    const detailPanel = root.querySelector('#requestDetailPanel');
    const claimsPanel = root.querySelector('#requestClaimsPanel');
    const activateTab = tab => {
        const isClaims = tab === claimsTab;
        detailTab?.setAttribute('aria-selected', String(!isClaims));
        claimsTab?.setAttribute('aria-selected', String(isClaims));
        if (detailTab) {
            detailTab.style.borderBottomColor = isClaims ? 'transparent' : 'var(--primary-color)';
            detailTab.style.color = isClaims ? 'var(--text-muted)' : 'var(--primary-color)';
        }
        if (claimsTab) {
            claimsTab.style.borderBottomColor = isClaims ? 'var(--primary-color)' : 'transparent';
            claimsTab.style.color = isClaims ? 'var(--primary-color)' : 'var(--text-muted)';
        }
        if (detailPanel) {
            detailPanel.hidden = isClaims;
            detailPanel.style.display = isClaims ? 'none' : 'block';
        }
        if (claimsPanel) {
            claimsPanel.hidden = !isClaims;
            claimsPanel.style.display = isClaims ? 'block' : 'none';
        }
        if (isClaims) loadRequestClaimsFromDetail(window.currentDetailRequestId);
    };
    detailTab?.addEventListener('click', () => activateTab(detailTab));
    claimsTab?.addEventListener('click', () => activateTab(claimsTab));
    const dropZone = root.querySelector('#imageDropZone');
    const fileInput = root.querySelector('#imageFileInput');
    if (!dropZone || !fileInput || dropZone.dataset.bound === 'true') return;

    dropZone.dataset.bound = 'true';
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        Array.from(fileInput.files).forEach(uploadRequestImageFromDetail);
        fileInput.value = '';
    });
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
    });
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/')).forEach(uploadRequestImageFromDetail);
        dropZone.style.borderColor = 'var(--border-color)';
    });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Request detail page — data loading, editing, status actions,
 * claim review (approve/reject) and claim-post review.
 * Follows the existing vanilla-JS + inline-style + zh/en i18n conventions.
 * ══════════════════════════════════════════════════════════════════════════ */

function requestDetailPageText(lang) {
    return lang === 'en'
        ? {
            loading: 'Loading campaign...', loadError: 'Could not load campaign',
            edit: 'Edit', cancelCampaign: 'Cancel campaign', completeCampaign: 'Mark complete', reopenCampaign: 'Reopen',
            confirmCancel: 'Cancel this campaign? Creators will no longer be able to apply.',
            confirmComplete: 'Mark this campaign as complete?',
            confirmReopen: 'Reopen this campaign for applications?',
            statusUpdated: 'Status updated', updateFailed: 'Update failed',
            save: 'Save', saving: 'Saving...', close: 'Close',
            title: 'Title', description: 'Description', rewardType: 'Reward type', budget: 'Budget (£)',
            perks: 'Perks', startDate: 'Start date', endDate: 'End date',
            requirements: 'Platform requirements', platform: 'Platform', creators: 'Creators', contentType: 'Content',
            addRequirement: '+ Add requirement', remove: 'Remove',
            stores: 'Stores', noStores: 'No stores linked',
            dateError: 'Start date must be before or equal to end date.',
            required: 'Title, description, start and end dates are required.',
            rewardTypes: { free_meal: 'Free meal', paid: 'Paid', commission: 'Commission', mixed: 'Mixed' },
            contentTypes: { video: 'Video', image: 'Image', both: 'Both' },
            statuses: { draft: '🟡 Draft', open: '🟢 Recruiting', completed: '✅ Completed', cancelled: '⚫ Cancelled', closed: '🔴 Closed' },
            reject: 'Reject', rejecting: 'Rejecting...', rejectConfirm: 'Reject this application?',
            posts: 'Submitted works', loadPosts: 'View works', noPosts: 'No works submitted yet.', submitted: 'Submitted',
            approve: 'Approve', approvePost: 'Approve', rejectPost: 'Reject', openConversation: 'Message creator',
            reviewNotes: 'Review notes (optional)', reviewNotesPh: 'Reason for rejection / feedback...',
            viewPost: 'Open', statsViews: 'Views', statsLikes: 'Likes', statsComments: 'Comments', statsCollects: 'Collects',
            notes: 'Notes', bookingDate: 'Booking date'
        }
        : {
            loading: '正在加载活动...', loadError: '无法加载活动',
            edit: '编辑', cancelCampaign: '取消活动', completeCampaign: '标记完成', reopenCampaign: '重新开放',
            confirmCancel: '确定取消该活动吗？取消后达人将无法继续报名。',
            confirmComplete: '确定将该活动标记为完成吗？',
            confirmReopen: '确定重新开放该活动吗？',
            statusUpdated: '状态已更新', updateFailed: '更新失败',
            save: '保存', saving: '保存中...', close: '关闭',
            title: '标题', description: '活动描述', rewardType: '奖励类型', budget: '预算金额（£）',
            perks: '福利', startDate: '开始日期', endDate: '结束日期',
            requirements: '平台招募要求', platform: '平台', creators: '人数', contentType: '内容形式',
            addRequirement: '+ 添加要求', remove: '删除',
            stores: '关联门店', noStores: '未关联门店',
            dateError: '开始日期不能晚于结束日期。',
            required: '标题、描述、开始和结束日期为必填。',
            rewardTypes: { free_meal: '免费餐饮', paid: '付费', commission: '佣金', mixed: '混合' },
            contentTypes: { video: '视频', image: '图文', both: '视频+图文' },
            statuses: { draft: '🟡 草稿', open: '🟢 招募中', completed: '✅ 已完成', cancelled: '⚫ 已取消', closed: '🔴 已关闭' },
            reject: '拒绝', rejecting: '处理中...', rejectConfirm: '确定拒绝这条报名吗？',
            posts: '提交的作品', loadPosts: '查看作品', noPosts: '暂无提交的作品。', submitted: '已提交',
            approve: '通过', approvePost: '通过', rejectPost: '驳回', openConversation: '联系达人',
            reviewNotes: '审核备注（选填）', reviewNotesPh: '驳回原因 / 反馈意见...',
            viewPost: '打开', statsViews: '播放', statsLikes: '点赞', statsComments: '评论', statsCollects: '收藏',
            notes: '备注', bookingDate: '预约日期'
        };
}

const requestDetailEscapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const requestDetailDate = value => value ? String(value).slice(0, 10) : '—';

function openRequestActionModal(title, message, confirmLabel, cancelLabel) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `<div style="width:min(92vw,460px);background:#1a1f2e;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;color:#f9fafb;position:relative;"><button type="button" data-close style="position:absolute;top:14px;right:14px;background:transparent;border:0;color:#9ca3af;cursor:pointer;font-size:20px;line-height:1;">✕</button><h3 style="margin:0 0 8px;font-size:1.15rem;">${requestDetailEscapeHtml(title)}</h3><p style="margin:0 0 24px;color:#9ca3af;font-size:.88rem;line-height:1.6;">${requestDetailEscapeHtml(message)}</p><div style="display:flex;justify-content:flex-end;gap:10px;"><button type="button" data-cancel style="padding:10px 18px;background:transparent;border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#9ca3af;cursor:pointer;font-size:.88rem;">${requestDetailEscapeHtml(cancelLabel)}</button><button type="button" data-confirm style="padding:10px 22px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:8px;color:#fff;cursor:pointer;font-size:.88rem;font-weight:600;">${requestDetailEscapeHtml(confirmLabel)}</button></div></div>`;
        document.body.appendChild(overlay);
        const close = result => { overlay.remove(); resolve(result); };
        overlay.querySelector('[data-close]').addEventListener('click', () => close(false));
        overlay.querySelector('[data-cancel]').addEventListener('click', () => close(false));
        overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
        overlay.addEventListener('click', event => { if (event.target === overlay) close(false); });
    });
}

function openRequestNoticeModal(title, message, closeLabel) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `<div style="width:min(92vw,460px);background:#1a1f2e;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;color:#f9fafb;position:relative;"><button type="button" data-close-x style="position:absolute;top:14px;right:14px;background:transparent;border:0;color:#9ca3af;cursor:pointer;font-size:20px;line-height:1;">✕</button><h3 style="margin:0 0 8px;font-size:1.15rem;">${requestDetailEscapeHtml(title)}</h3><p style="margin:0 0 24px;color:#9ca3af;font-size:.88rem;line-height:1.6;">${requestDetailEscapeHtml(message)}</p><div style="display:flex;justify-content:flex-end;"><button type="button" data-close style="padding:10px 22px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:8px;color:#fff;cursor:pointer;font-size:.88rem;font-weight:600;">${requestDetailEscapeHtml(closeLabel)}</button></div></div>`;
        document.body.appendChild(overlay);
        const close = () => { overlay.remove(); resolve(); };
        overlay.querySelector('[data-close-x]').addEventListener('click', close);
        overlay.querySelector('[data-close]').addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    });
}

async function fetchPlatformOptions() {
    if (Array.isArray(window.__platformOptions)) return window.__platformOptions;
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/platforms`, { headers: { Authorization: token } });
        const data = await response.json();
        window.__platformOptions = Array.isArray(data.platforms) ? data.platforms : [];
    } catch (e) {
        console.error('Load platforms error:', e);
        window.__platformOptions = [];
    }
    return window.__platformOptions;
}

async function fetchBrandStores() {
    if (Array.isArray(window.__brandStores)) return window.__brandStores;
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/my-brand`, { headers: { Authorization: token } });
        const data = await response.json();
        window.__brandStores = Array.isArray(data.brand?.stores) ? data.brand.stores : [];
    } catch (e) {
        console.error('Load brand stores error:', e);
        window.__brandStores = [];
    }
    return window.__brandStores;
}

function platformNameOf(platforms, key, lang) {
    const found = (platforms || []).find(p => p.platformKey === key);
    if (!found) return key || '—';
    return lang === 'en' ? (found.nameEn || found.nameZh || key) : (found.nameZh || found.nameEn || key);
}

/* ── Detail header + sections ──────────────────────────────────────────── */
async function loadRequestDetailPage(requestId) {
    if (!requestId) return;
    if (window.currentDetailRequestId === requestId && window.currentDetailRequest) {
        renderRequestDetailHeader(window.currentDetailRequest);
        renderRequestDetailActions(window.currentDetailRequest);
        return;
    }
    window.currentDetailRequestId = requestId;
    window.currentDetailRequest = null;
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = requestDetailPageText(lang);
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const titleEl = document.getElementById('detailTitle');
    if (titleEl) titleEl.textContent = t.loading;
    try {
        const response = await fetch(`${API_BASE_URL}/api/requests/${encodeURIComponent(requestId)}`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok || data.success === false || !data.request) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }
        if (String(window.currentDetailRequestId) !== String(requestId)) return;
        window.currentDetailRequest = data.request;
        renderRequestDetailHeader(data.request);
        renderRequestDetailActions(data.request);
        // Reset claims tab cache so it reloads with fresh data
        const claimsList = document.getElementById('requestClaimsList');
        if (claimsList) delete claimsList.dataset.loadedRequestId;
        loadRequestImagesFromDetail(requestId);
    } catch (error) {
        console.error('Load request detail error:', error);
        if (titleEl) titleEl.textContent = `${t.loadError}: ${error.message}`;
    }
}

function renderRequestDetailHeader(request) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = requestDetailPageText(lang);
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    set('detailTitle', request.title || '—');
    const statusBadge = document.getElementById('detailStatusBadge');
    if (statusBadge) {
        const key = String(request.status || 'open').toLowerCase();
        statusBadge.textContent = t.statuses[key] || request.status;
    }
    const rewardBadge = document.getElementById('detailRewardBadge');
    if (rewardBadge) rewardBadge.textContent = t.rewardTypes[request.rewardType] || request.rewardType || '—';
    const rewardIcon = document.getElementById('detailRewardIcon');
    if (rewardIcon) {
        const icons = { free_meal: '🍽️', paid: '💰', commission: '🤝', mixed: '🎁' };
        rewardIcon.textContent = icons[request.rewardType] || '🎁';
    }
    set('detailDateRange', `${requestDetailDate(request.startDate)} → ${requestDetailDate(request.endDate)}`);
    const budget = Number(request.budgetAmount || 0);
    set('detailBudget', budget > 0 ? `£${budget.toLocaleString()}` : '—');
    set('detailCreatedAt', requestDetailDate(request.createdAt));
    set('detailPerks', request.perks || '—');
    set('detailDescription', request.description || '—');

    fetchPlatformOptions().then(platforms => {
        const list = document.getElementById('detailRequirementsList');
        if (!list) return;
        const reqs = Array.isArray(request.requirements) ? request.requirements : [];
        if (!reqs.length) {
            list.innerHTML = `<p style="margin:0;color:var(--text-muted);font-size:.85rem;">—</p>`;
            return;
        }
        list.innerHTML = reqs.map(r => {
            const extra = r.extraRequirements && typeof r.extraRequirements === 'object'
                ? Object.entries(r.extraRequirements).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${requestDetailEscapeHtml(k)}: ${requestDetailEscapeHtml(v)}`).join(' · ')
                : '';
            return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:.86rem;">`
                + `<strong style="color:var(--text-main);">${requestDetailEscapeHtml(platformNameOf(platforms, r.platformKey, lang))}</strong>`
                + `<span style="color:var(--text-muted);">${t.creators}: ${Number(r.influencerCount) || 1}</span>`
                + `<span style="color:var(--text-muted);">${t.contentType}: ${t.contentTypes[r.contentType] || r.contentType || '—'}</span>`
                + (extra ? `<span style="color:var(--text-muted);font-size:.78rem;">${extra}</span>` : '')
                + `</div>`;
        }).join('');
    });

    const storesCard = document.getElementById('detailStoresCard');
    const stores = Array.isArray(request.stores) ? request.stores : [];
    if (storesCard) {
        const list = document.getElementById('detailStoresList');
        if (list) {
            list.innerHTML = stores.length
                ? stores.map(s => `<div style="padding:8px 0;border-bottom:1px solid var(--border-color);font-size:.86rem;"><strong style="color:var(--text-main);">${requestDetailEscapeHtml(s.storeName)}</strong><span style="color:var(--text-muted);"> · ${requestDetailEscapeHtml(s.address || '')}</span></div>`).join('')
                : `<p style="margin:0;color:var(--text-muted);font-size:.85rem;">${t.noStores}</p>`;
        }
        const label = document.getElementById('detailLabelStores');
        if (label) label.textContent = t.stores;
    }
}

function renderRequestDetailActions(request) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = requestDetailPageText(lang);
    let bar = document.getElementById('detailActionsBar');
    if (!bar) {
        const header = document.querySelector('#section-request-detail .pane-header > div');
        if (!header) return;
        bar = document.createElement('div');
        bar.id = 'detailActionsBar';
        bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;padding:16px 0 8px;';
        header.parentElement.insertBefore(bar, header.nextSibling);
    }
    bar.replaceChildren();
    const status = String(request.status || '').toLowerCase();

    const mkBtn = (label, style, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = style;
        btn.addEventListener('click', onClick);
        bar.appendChild(btn);
        return btn;
    };
    const primary = 'padding:10px 20px;border:0;border-radius:8px;background:var(--primary-color);color:#fff;font-size:.85rem;font-weight:600;cursor:pointer;';
    const ghost = 'padding:8px 16px;border:1px solid var(--border-color);border-radius:8px;background:#fff;color:var(--text-main);font-size:.85rem;cursor:pointer;';
    const danger = 'padding:8px 16px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#dc2626;font-size:.85rem;cursor:pointer;';

    mkBtn(t.edit, primary, () => openRequestEditModal(request));
    if (status === 'open' || status === 'draft') {
        mkBtn(t.completeCampaign, ghost, async () => {
            if (!await openRequestActionModal(t.completeCampaign, t.confirmComplete, t.completeCampaign, t.close)) return;
            await updateRequestStatus(request.id, 'completed');
        });
        mkBtn(t.cancelCampaign, danger, async () => {
            if (!await openRequestActionModal(t.cancelCampaign, t.confirmCancel, t.cancelCampaign, t.close)) return;
            await updateRequestStatus(request.id, 'cancelled');
        });
    }
    if (status === 'cancelled' || status === 'completed' || status === 'closed') {
        mkBtn(t.reopenCampaign, ghost, async () => {
            if (!confirm(t.confirmReopen)) return;
            await updateRequestStatus(request.id, 'open');
        });
    }
}

async function updateRequestStatus(requestId, status) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = requestDetailPageText(lang);
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/requests/${encodeURIComponent(requestId)}`, {
            method: 'PUT',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
        window.currentDetailRequest = data.request || window.currentDetailRequest;
        if (window.currentDetailRequest) window.currentDetailRequest.status = data.request?.status || status;
        renderRequestDetailHeader(window.currentDetailRequest);
        renderRequestDetailActions(window.currentDetailRequest);
    } catch (error) {
        console.error('Update request status error:', error);
        alert(`${t.updateFailed}: ${error.message}`);
    }
}

/* ── Edit modal (PUT /api/requests/:id) ─────────────────────────────────── */
function requirementRowHtml(platforms, lang, req) {
    const t = requestDetailPageText(lang);
    req = req || {};
    const options = (platforms || []).map(p => {
        const name = lang === 'en' ? (p.nameEn || p.nameZh) : (p.nameZh || p.nameEn);
        const sel = p.platformKey === req.platformKey ? ' selected' : '';
        return `<option value="${requestDetailEscapeHtml(p.platformKey)}"${sel}>${requestDetailEscapeHtml(name || p.platformKey)}</option>`;
    }).join('');
    const ct = req.contentType || 'both';
    return `<div data-req-row style="display:grid;grid-template-columns:1fr 90px 120px 32px;gap:8px;margin-bottom:8px;align-items:center;">`
        + `<select data-req-platform style="padding:8px;border:1px solid var(--border-color);border-radius:6px;">${options}</select>`
        + `<input data-req-count type="number" min="1" value="${Number(req.influencerCount) || 1}" style="padding:8px;border:1px solid var(--border-color);border-radius:6px;">`
        + `<select data-req-content style="padding:8px;border:1px solid var(--border-color);border-radius:6px;">`
        + ['video', 'image', 'both'].map(k => `<option value="${k}"${k === ct ? ' selected' : ''}>${t.contentTypes[k]}</option>`).join('')
        + `</select>`
        + `<button type="button" data-req-remove style="border:0;background:none;color:#dc2626;cursor:pointer;font-size:1rem;">✕</button>`
        + `</div>`;
}

async function openRequestEditModal(request) {
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const t = requestDetailPageText(lang);
    const platforms = await fetchPlatformOptions();
    const stores = await fetchBrandStores();
    const linkedStoreIds = new Set((request.stores || []).map(s => s.id));

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;';
    const input = 'width:100%;padding:10px 14px;background:#0f1421;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f9fafb;font-size:.9rem;box-sizing:border-box;outline:none;';
    const label = 'display:block;margin:14px 0 6px;font-size:.82rem;color:#d1d5db;font-weight:600;';
    overlay.innerHTML = `
        <div style="width:min(94vw,620px);background:#1a1f2e;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px;color:#f9fafb;margin:auto;position:relative;">
            <button type="button" data-close-x style="position:absolute;top:16px;right:16px;background:transparent;border:0;color:#9ca3af;cursor:pointer;font-size:20px;line-height:1;">✕</button>
            <h3 style="margin:0 0 6px;font-size:1.2rem;">${t.edit}</h3>
            <label style="${label}">${t.title} *</label><input data-f="title" value="${requestDetailEscapeHtml(request.title)}" style="${input}">
            <label style="${label}">${t.description} *</label><textarea data-f="description" rows="4" style="${input}resize:vertical;">${requestDetailEscapeHtml(request.description)}</textarea>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div><label style="${label}">${t.rewardType}</label><select data-f="rewardType" style="${input}">${Object.entries(t.rewardTypes).map(([k, v]) => `<option value="${k}"${request.rewardType === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
                <div><label style="${label}">${t.budget}</label><input data-f="budgetAmount" type="number" min="0" step="0.01" value="${Number(request.budgetAmount) || 0}" style="${input}"></div>
            </div>
            <label style="${label}">${t.perks}</label><input data-f="perks" value="${requestDetailEscapeHtml(request.perks || '')}" style="${input}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div><label style="${label}">${t.startDate} *</label><input data-f="startDate" type="date" value="${requestDetailDate(request.startDate) === '—' ? '' : requestDetailDate(request.startDate)}" style="${input}"></div>
                <div><label style="${label}">${t.endDate} *</label><input data-f="endDate" type="date" value="${requestDetailDate(request.endDate) === '—' ? '' : requestDetailDate(request.endDate)}" style="${input}"></div>
            </div>
            <label style="${label}">${t.requirements}</label>
            <div data-req-list></div>
            <button type="button" data-req-add style="border:1px dashed var(--border-color);background:#fff;border-radius:8px;padding:7px 12px;font-size:.82rem;color:var(--primary-color);cursor:pointer;">${t.addRequirement}</button>
            ${stores.length ? `<label style="${label}">${t.stores}</label><div data-store-list style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto;">${stores.filter(s => s.status === 'active').map(s => `<label style="display:flex;gap:8px;align-items:center;font-size:.85rem;"><input type="checkbox" data-store-id="${requestDetailEscapeHtml(s.id)}"${linkedStoreIds.has(s.id) ? ' checked' : ''}> ${requestDetailEscapeHtml(s.storeName)} <span style="color:var(--text-muted);">${requestDetailEscapeHtml(s.address || '')}</span></label>`).join('')}</div>` : ''}
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">
                <button type="button" data-close style="padding:10px 18px;background:transparent;border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#9ca3af;cursor:pointer;">${t.close}</button>
                <button type="button" data-save style="padding:10px 22px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:8px;color:#fff;font-weight:600;cursor:pointer;">${t.save}</button>
            </div>
            <p data-error style="display:none;margin:12px 0 0;color:#dc2626;font-size:.82rem;"></p>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-close-x]').addEventListener('click', close);

    const reqList = overlay.querySelector('[data-req-list]');
    const addRow = (req) => {
        const wrap = document.createElement('div');
        wrap.innerHTML = requirementRowHtml(platforms, lang, req);
        const row = wrap.firstChild;
        row.querySelector('[data-req-remove]').addEventListener('click', () => row.remove());
        reqList.appendChild(row);
    };
    (request.requirements && request.requirements.length ? request.requirements : [{}]).forEach(addRow);
    overlay.querySelector('[data-req-add]').addEventListener('click', () => addRow({}));
    overlay.querySelector('[data-close]').addEventListener('click', close);

    overlay.querySelector('[data-save]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const errEl = overlay.querySelector('[data-error]');
        const val = k => overlay.querySelector(`[data-f="${k}"]`).value.trim();
        const title = val('title'), description = val('description'), startDate = val('startDate'), endDate = val('endDate');
        errEl.style.display = 'none';
        if (!title || !description || !startDate || !endDate) { errEl.textContent = t.required; errEl.style.display = 'block'; return; }
        if (Date.parse(startDate) > Date.parse(endDate)) { errEl.textContent = t.dateError; errEl.style.display = 'block'; return; }
        const requirements = Array.from(reqList.querySelectorAll('[data-req-row]')).map(row => ({
            platformKey: row.querySelector('[data-req-platform]').value,
            influencerCount: Math.max(1, parseInt(row.querySelector('[data-req-count]').value, 10) || 1),
            contentType: row.querySelector('[data-req-content]').value,
            extraRequirements: {}
        })).filter(r => r.platformKey);
        const storeIds = Array.from(overlay.querySelectorAll('[data-store-id]:checked')).map(el => el.dataset.storeId);

        btn.disabled = true;
        btn.textContent = t.saving;
        try {
            const response = await fetch(`${API_BASE_URL}/api/requests/${encodeURIComponent(request.id)}`, {
                method: 'PUT',
                headers: { Authorization: localStorage.getItem('authToken'), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, description,
                    rewardType: overlay.querySelector('[data-f="rewardType"]').value,
                    budgetAmount: Math.max(0, parseFloat(val('budgetAmount')) || 0),
                    perks: val('perks') || null,
                    startDate, endDate,
                    requirements,
                    ...(overlay.querySelector('[data-store-list]') ? { storeIds } : {})
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
            window.currentDetailRequest = data.request;
            renderRequestDetailHeader(data.request);
            renderRequestDetailActions(data.request);
            const claimsList = document.getElementById('requestClaimsList');
            if (claimsList) delete claimsList.dataset.loadedRequestId;
            close();
        } catch (error) {
            console.error('Save request error:', error);
            errEl.textContent = `${t.updateFailed}: ${error.message}`;
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = t.save;
        }
    });
}

window.loadRequestDetailPage = loadRequestDetailPage;
window.openRequestEditModal = openRequestEditModal;

/* ── Claim reject (POST /api/claims/:id/reject) ──────────────────────────── */
async function rejectRequestClaimFromDetail(claim, button, statusEl, lang) {
    if (!claim?.id || button.disabled) return;
    const t = requestDetailPageText(lang);
    if (!confirm(t.rejectConfirm)) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    button.disabled = true;
    button.textContent = t.rejecting;
    try {
        const response = await fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claim.id)}/reject`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        claim.status = data.claim?.status || 'rejected';
        statusEl.textContent = lang === 'en' ? 'Rejected' : '已拒绝';
        statusEl.style.background = 'rgba(239,68,68,.12)';
        statusEl.style.color = '#dc2626';
        button.closest('[data-claim-actions]')?.querySelectorAll('[data-review-action]').forEach(b => b.remove());
    } catch (error) {
        console.error('Reject claim error:', error);
        button.disabled = false;
        button.textContent = t.reject;
        alert(`${t.updateFailed}: ${error.message}`);
    }
}

/* ── Claim posts review (GET /api/claims/:id/posts, PUT /api/claim-posts/:id) */
async function toggleClaimPostsFromDetail(claim, container, button, lang) {
    const t = requestDetailPageText(lang);
    if (container.dataset.open === 'true') {
        container.dataset.open = 'false';
        container.style.display = 'none';
        button.textContent = `${t.loadPosts}${claim.meta?.totalPostCountPerPlatform ? ` (${Object.values(claim.meta.totalPostCountPerPlatform).reduce((a, b) => a + Number(b), 0)})` : ''}`;
        return;
    }
    container.dataset.open = 'true';
    container.style.display = 'block';
    button.textContent = t.posts;
    if (container.dataset.loaded === claim.id) return;
    container.innerHTML = `<p style="margin:0;color:var(--text-muted);font-size:.82rem;">…</p>`;
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claim.id)}/posts`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
        container.dataset.loaded = claim.id;
        renderClaimPostsFromDetail(data.posts || [], container, lang, claim);
    } catch (error) {
        console.error('Load claim posts error:', error);
        container.innerHTML = `<p style="margin:0;color:#dc2626;font-size:.82rem;">${t.loadError}: ${requestDetailEscapeHtml(error.message)}</p>`;
    }
}

function renderClaimPostsFromDetail(posts, container, lang, claim) {
    const t = requestDetailPageText(lang);
    container.replaceChildren();
    if (!posts.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'margin:0;color:var(--text-muted);font-size:.82rem;';
        empty.textContent = t.noPosts;
        container.appendChild(empty);
        return;
    }
    const statusColor = s => s === 'approved'
        ? 'background:rgba(16,185,129,.13);color:#059669;'
        : (s === 'rejected' ? 'background:rgba(239,68,68,.12);color:#dc2626;' : 'background:rgba(59,130,246,.13);color:#2563eb;');
    posts.forEach(post => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:10px;background:#fff;';
        const statusKey = String(post.status || 'submitted').toLowerCase();
        const statusLabel = statusKey === 'approved' ? t.approve : (statusKey === 'rejected' ? t.reject : t.submitted);
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <div style="min-width:0;">
                    <div style="font-weight:600;font-size:.88rem;color:var(--text-main);">${requestDetailEscapeHtml(post.title || post.platformKey || '')}</div>
                    <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px;">${requestDetailEscapeHtml(post.platformKey || '')} · ${t.statsViews} ${Number(post.viewCount) || 0} · ${t.statsLikes} ${Number(post.likeCount) || 0} · ${t.statsComments} ${Number(post.commentCount) || 0} · ${t.statsCollects} ${Number(post.collectCount) || 0}</div>
                </div>
                <span data-post-status style="padding:3px 10px;border-radius:12px;font-size:.74rem;font-weight:600;${statusColor(statusKey)}">${statusLabel}</span>
            </div>
            <div style="margin-top:10px;padding:10px 12px;background:var(--bg-page);border:1px solid var(--border-color);border-radius:8px;">
                <a href="${requestDetailEscapeHtml(post.postUrl || '#')}" target="_blank" rel="noopener" style="display:block;overflow:hidden;color:var(--primary-color);font-size:.8rem;font-weight:600;text-overflow:ellipsis;white-space:nowrap;">${t.viewPost} ↗</a>
                <span style="display:block;margin-top:4px;overflow:hidden;color:var(--text-muted);font-size:.75rem;text-overflow:ellipsis;white-space:nowrap;">${requestDetailEscapeHtml(post.postUrl || '—')}</span>
            </div>
            <div data-post-actions style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;"></div>`;
        const actions = card.querySelector('[data-post-actions]');
        if (claim?.influencerEmail && window.currentDetailRequestId) {
            const langParam = localStorage.getItem('lang') || 'zh';
            const conversationLink = document.createElement('a');
            conversationLink.href = `/conversations/${encodeURIComponent(window.currentDetailRequestId)}?lang=${encodeURIComponent(langParam)}&email=${encodeURIComponent(claim.influencerEmail)}`;
            conversationLink.target = '_self';
            conversationLink.textContent = t.openConversation;
            conversationLink.style.cssText = 'padding:6px 12px;border:1px solid rgba(102,126,234,.3);border-radius:6px;background:rgba(102,126,234,.12);color:#667eea;font-size:.78rem;text-decoration:none;';
            actions.appendChild(conversationLink);
        }
        if (post.id) {
            const createReviewButton = (label, status, background) => {
                const reviewButton = document.createElement('button');
                reviewButton.type = 'button';
                reviewButton.textContent = label;
                reviewButton.style.cssText = `padding:6px 12px;border:0;border-radius:6px;background:${background};color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;`;
                reviewButton.addEventListener('click', () => reviewClaimPostFromDetail(post, status, '', reviewButton, lang));
                actions.appendChild(reviewButton);
            };
            if (statusKey !== 'approved') createReviewButton(t.approvePost, 'approved', '#10b981');
            if (statusKey !== 'rejected') createReviewButton(t.rejectPost, 'rejected', '#ef4444');
        }
        container.appendChild(card);
    });
}

async function reviewClaimPostFromDetail(post, status, reviewNotes, button, lang) {
    const t = requestDetailPageText(lang);
    if (!post?.id || button.disabled) return;
    const token = localStorage.getItem('authToken');
    button.disabled = true;
    const original = button.textContent;
    button.textContent = '…';
    try {
        const response = await fetch(`${API_BASE_URL}/api/claim-posts/${encodeURIComponent(post.id)}`, {
            method: 'PUT',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reviewNotes: reviewNotes || '' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || `HTTP ${response.status}`);
        post.status = data.post?.status || status;
        post.reviewNotes = data.post?.reviewNotes ?? reviewNotes;
        const card = button.closest('[data-post-actions]')?.parentElement;
        const statusEl = card?.querySelector('[data-post-status]');
        if (statusEl) {
            statusEl.textContent = status === 'approved' ? t.approvePost : t.rejectPost;
            statusEl.style.cssText = status === 'approved'
                ? 'padding:3px 10px;border-radius:12px;font-size:.74rem;font-weight:600;background:rgba(16,185,129,.13);color:#059669;'
                : 'padding:3px 10px;border-radius:12px;font-size:.74rem;font-weight:600;background:rgba(239,68,68,.12);color:#dc2626;';
        }
        button.closest('[data-post-actions]')?.querySelectorAll('button').forEach(reviewButton => reviewButton.remove());
        const container = button.closest('[data-posts-container]');
        if (container) { delete container.dataset.loaded; }
        await openRequestNoticeModal(t.statusUpdated, lang === 'en' ? 'Review saved.' : '审核已保存。', t.close);
    } catch (error) {
        console.error('Review claim post error:', error);
        alert(`${t.updateFailed}: ${error.message}`);
        button.disabled = false;
        button.textContent = original;
    }
}

window.rejectRequestClaimFromDetail = rejectRequestClaimFromDetail;
window.toggleClaimPostsFromDetail = toggleClaimPostsFromDetail;
