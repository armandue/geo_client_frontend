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
window.renderImageThumb = renderImageThumbFromDetail;
window.deleteAllRequestImages = deleteAllRequestImages;

window.registerPageComponent('request-detail', function (root) {
    root.dataset.componentScript = 'request-detail';
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
