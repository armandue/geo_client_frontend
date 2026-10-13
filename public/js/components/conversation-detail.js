/* Conversation detail — request-scoped chat with one influencer.
 * Backend contract (v3): GET/POST /api/requests/:id/conversation?influencer_email=
 * and POST /api/requests/:id/conversation/read */
const conversationDetailApiBaseUrl = 'https://geoclientbackend.shandong-buxie.workers.dev';

function conversationDetailText(lang) {
    return lang === 'en'
        ? {
            title: 'Conversation', back: 'Back to conversations', request: 'Campaign', brand: 'You', influencer: 'Creator',
            loading: 'Loading messages...', empty: 'No messages in this conversation yet.', error: 'Could not load conversation',
            messagePh: 'Type a message...', send: 'Send', sending: 'Sending...', sendFailed: 'Failed to send message',
            refresh: 'Refresh', missingContext: 'Missing conversation context (request or influencer).'
        }
        : {
            title: '对话详情', back: '返回对话', request: '活动', brand: '我', influencer: '达人',
            loading: '正在加载消息...', empty: '暂无聊天记录。', error: '无法加载对话',
            messagePh: '输入消息...', send: '发送', sending: '发送中...', sendFailed: '发送失败',
            refresh: '刷新', missingContext: '缺少对话上下文（活动或达人信息）。'
        };
}

function formatConversationDetailDate(value, lang) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(lang === 'en' ? 'en' : 'zh-CN');
}

function renderConversationDetailMessages(messages, container, lang) {
    const labels = conversationDetailText(lang);
    container.replaceChildren();
    if (!messages.length) {
        const empty = document.createElement('p');
        empty.style.cssText = 'margin:auto;color:var(--text-muted);text-align:center;';
        empty.textContent = labels.empty;
        container.appendChild(empty);
        return;
    }

    messages.forEach(message => {
        const isBrand = String(message.senderRole || '').toLowerCase() === 'brand';
        const row = document.createElement('div');
        row.style.cssText = `display:flex;flex-direction:column;align-items:${isBrand ? 'flex-end' : 'flex-start'};gap:4px;`;

        const sender = document.createElement('span');
        sender.style.cssText = 'font-size:.74rem;color:var(--text-muted);';
        sender.textContent = isBrand ? labels.brand : labels.influencer;

        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:min(78%,640px);padding:11px 14px;border-radius:${isBrand ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${isBrand ? 'var(--primary-color)' : 'var(--bg-page)'};color:${isBrand ? '#fff' : 'var(--text-main)'};white-space:pre-wrap;overflow-wrap:anywhere;`;
        bubble.textContent = message.content || '';

        const timestamp = document.createElement('time');
        timestamp.className = 'message-time';
        timestamp.dateTime = message.createdAt || '';
        timestamp.textContent = formatConversationDetailDate(message.createdAt, lang);
        row.append(sender, bubble, timestamp);
        container.appendChild(row);
    });
    container.scrollTop = container.scrollHeight;
}

function resolveConversationContext(requestIdFromRoute) {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/\/index\.html\/conversations\/([^/?]+)/);
    const requestId = requestIdFromRoute
        || (window.__conversationContext && window.__conversationContext.requestId)
        || (pathMatch ? decodeURIComponent(pathMatch[1]) : null);
    let ctx = window.__conversationContext;
    if (!ctx || ctx.requestId !== requestId) ctx = {};
    return {
        requestId,
        influencerEmail: ctx.influencerEmail || params.get('email'),
        influencerName: ctx.influencerName || params.get('creator'),
        requestTitle: ctx.requestTitle || params.get('requestTitle')
    };
}

async function markConversationRead(requestId, influencerEmail) {
    const token = localStorage.getItem('authToken');
    if (!token || !requestId || !influencerEmail) return;
    try {
        await fetch(`${conversationDetailApiBaseUrl}/api/requests/${encodeURIComponent(requestId)}/conversation/read`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ influencerEmail })
        });
        if (typeof window.loadConversationsFromComponent === 'function') window.conversationsLoaded = false;
    } catch (e) {
        console.error('Mark conversation read error:', e);
    }
}

async function loadConversationDetailPage(requestIdFromRoute) {
    const lang = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('lang') || 'zh';
    const labels = conversationDetailText(lang === 'en' ? 'en' : 'zh');
    const ctx = resolveConversationContext(requestIdFromRoute);
    window.__conversationContext = ctx;

    const messagesContainer = document.getElementById('conversationMessages');
    const creatorElement = document.getElementById('conversationDetailCreator');
    const requestElement = document.getElementById('conversationDetailRequest');
    const backLink = document.getElementById('backToConversationsLink');
    const form = document.getElementById('conversationSendForm');
    const input = document.getElementById('conversationInput');

    if (backLink) backLink.href = `/index.html/conversations?lang=${encodeURIComponent(lang)}`;
    document.title = `${labels.title} - GeoMedia`;
    if (creatorElement) creatorElement.textContent = ctx.influencerName || labels.title;
    if (requestElement) requestElement.textContent = `${labels.request}: ${ctx.requestTitle || ''}`;
    if (form) form.style.display = '';
    if (!ctx.requestId || !ctx.influencerEmail || !messagesContainer) {
        if (messagesContainer) {
            messagesContainer.replaceChildren();
            const warn = document.createElement('p');
            warn.style.cssText = 'margin:auto;color:#dc2626;text-align:center;';
            warn.textContent = labels.missingContext;
            messagesContainer.appendChild(warn);
        }
        if (form) form.style.display = 'none';
        return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) return;
    messagesContainer.replaceChildren();
    const loading = document.createElement('p');
    loading.style.cssText = 'margin:auto;color:var(--text-muted);text-align:center;';
    loading.textContent = labels.loading;
    messagesContainer.appendChild(loading);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const url = `${conversationDetailApiBaseUrl}/api/requests/${encodeURIComponent(ctx.requestId)}/conversation?influencer_email=${encodeURIComponent(ctx.influencerEmail)}`;
        const response = await fetch(url, {
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        const messages = Array.isArray(data.messages) ? data.messages : (data.conversation?.messages || []);
        renderConversationDetailMessages(messages, messagesContainer, lang === 'en' ? 'en' : 'zh');
        markConversationRead(ctx.requestId, ctx.influencerEmail);
    } catch (error) {
        messagesContainer.replaceChildren();
        const errorMessage = document.createElement('p');
        errorMessage.style.cssText = 'margin:auto;color:#dc2626;text-align:center;';
        errorMessage.textContent = error.name === 'AbortError'
            ? (lang === 'en' ? 'The request timed out. Please retry.' : '请求超时，请重试。')
            : `${labels.error}: ${error.message}`;
        messagesContainer.appendChild(errorMessage);
        console.error('Load conversation detail error:', error);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function sendConversationMessage(event) {
    if (event) event.preventDefault();
    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const labels = conversationDetailText(lang);
    const input = document.getElementById('conversationInput');
    const sendBtn = document.getElementById('conversationSendBtn');
    const ctx = window.__conversationContext || {};
    const content = (input?.value || '').trim();
    if (!content || !ctx.requestId || !ctx.influencerEmail || sendBtn.disabled) return;

    const token = localStorage.getItem('authToken');
    sendBtn.disabled = true;
    sendBtn.textContent = labels.sending;
    try {
        const response = await fetch(`${conversationDetailApiBaseUrl}/api/requests/${encodeURIComponent(ctx.requestId)}/conversation`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ influencerEmail: ctx.influencerEmail, content })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        if (input) input.value = '';
        // Reload the thread so the new message renders in order.
        await loadConversationDetailPage(ctx.requestId);
    } catch (error) {
        console.error('Send message error:', error);
        alert(`${labels.sendFailed}: ${error.message}`);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = labels.send;
    }
}

/** Open a conversation thread. Call instead of showSection('conversation-detail', …) directly. */
window.openConversationDetail = function (requestId, influencerEmail, influencerName, requestTitle) {
    window.__conversationContext = { requestId, influencerEmail, influencerName, requestTitle };
    if (typeof window.showSection === 'function') window.showSection('conversation-detail', true, requestId);
};

window.loadConversationDetailPage = loadConversationDetailPage;
window.sendConversationMessage = sendConversationMessage;

window.updateConversationDetailLanguage = function (lang) {
    const labels = conversationDetailText(lang === 'en' ? 'en' : 'zh');
    const backLabel = document.getElementById('backToConversationsLabel');
    if (backLabel) backLabel.textContent = labels.back;
    const input = document.getElementById('conversationInput');
    if (input) input.placeholder = labels.messagePh;
    const sendBtn = document.getElementById('conversationSendBtn');
    if (sendBtn && !sendBtn.disabled) sendBtn.textContent = labels.send;
};

function initializeConversationDetailPage(root) {
    if (root?.dataset) root.dataset.componentScript = 'conversation-detail';
    root?.querySelector('#backToConversationsLink')?.addEventListener('click', event => {
        if (typeof window.showSection !== 'function') return;
        event.preventDefault();
        window.showSection('conversations', true);
    });
    const form = root?.querySelector('#conversationSendForm') || document.getElementById('conversationSendForm');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', sendConversationMessage);
    }
    root?.querySelector('#conversationRefreshBtn')?.addEventListener('click', () => {
        const ctx = window.__conversationContext || {};
        if (ctx.requestId) loadConversationDetailPage(ctx.requestId);
    });
}

if (typeof window.registerPageComponent === 'function') {
    window.registerPageComponent('conversation-detail', initializeConversationDetailPage);
} else {
    // Standalone page (not inside the SPA): page-components.js is absent,
    // so initialize and load directly.
    const boot = () => {
        initializeConversationDetailPage(document);
        const pathMatch = window.location.pathname.match(/\/index\.html\/conversations\/([^/?]+)/);
        loadConversationDetailPage(pathMatch ? decodeURIComponent(pathMatch[1]) : null);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
}
