const conversationDetailApiBaseUrl = 'https://geoclientbackend.shandong-buxie.workers.dev';

function conversationDetailText(lang) {
    return lang === 'en'
        ? {
            title: 'Conversation', back: 'Back to conversations', request: 'Campaign', brand: 'You', influencer: 'Creator',
            loading: 'Loading messages...', empty: 'No messages in this conversation yet.', error: 'Could not load conversation'
        }
        : {
            title: '对话详情', back: '返回对话', request: '活动', brand: '我', influencer: '达人',
            loading: '正在加载消息...', empty: '暂无聊天记录。', error: '无法加载对话'
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
}

async function loadConversationDetailPage(claimIdFromRoute) {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/\/index\.html\/conversations\/([^/?]+)/);
    const claimId = claimIdFromRoute || (pathMatch ? decodeURIComponent(pathMatch[1]) : params.get('claimId'));
    const lang = params.get('lang') || localStorage.getItem('lang') || 'zh';
    const labels = conversationDetailText(lang);
    const messagesContainer = document.getElementById('conversationMessages');
    const creatorElement = document.getElementById('conversationDetailCreator');
    const requestElement = document.getElementById('conversationDetailRequest');
    const backLink = document.getElementById('backToConversationsLink');

    if (backLink) backLink.href = `/index.html/conversations?lang=${encodeURIComponent(lang)}`;
    document.title = `${labels.title} - GeoMedia`;
    if (creatorElement) creatorElement.textContent = params.get('creator') || labels.title;
    if (requestElement) requestElement.textContent = `${labels.request}: ${params.get('requestTitle') || ''}`;
    if (!claimId || !messagesContainer) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(`${conversationDetailApiBaseUrl}/api/claims/${encodeURIComponent(claimId)}/conversation`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        const messages = data.conversation?.messages;
        renderConversationDetailMessages(Array.isArray(messages) ? messages : [], messagesContainer, lang);
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

window.loadConversationDetailPage = loadConversationDetailPage;

window.updateConversationDetailLanguage = function (lang) {
    const labels = conversationDetailText(lang);
    const backLabel = document.getElementById('backToConversationsLabel');
    if (backLabel) backLabel.textContent = labels.back;
};

function initializeConversationDetailPage(root) {
    if (root?.dataset) root.dataset.componentScript = 'conversation-detail';
    root?.querySelector('#backToConversationsLink')?.addEventListener('click', event => {
        if (typeof window.showSection !== 'function') return;
        event.preventDefault();
        window.showSection('conversations', true);
    });
}

if (typeof window.registerPageComponent === 'function') {
    window.registerPageComponent('conversation-detail', initializeConversationDetailPage);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadConversationDetailPage(), { once: true });
} else {
    loadConversationDetailPage();
}
