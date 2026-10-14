const conversationsApiBaseUrl = 'https://geoclientbackend.shandong-buxie.workers.dev';
let conversationsRequestInProgress = false;
let conversationsPageInitialized = false;

function conversationsText(lang) {
    return lang === 'en'
        ? {
            loading: 'Loading conversations...', empty: 'No conversations yet.', error: 'Could not load conversations',
            retry: 'Retry', total: 'Conversations', unread: 'Unread', request: 'Campaign', creator: 'Creator',
            lastMessage: 'Last message', noMessages: 'No messages yet', viewCampaign: 'View campaign', openConversation: 'Open conversation'
        }
        : {
            loading: '正在加载对话...', empty: '暂无对话。', error: '无法加载对话',
            retry: '重试', total: '对话数', unread: '未读消息', request: '活动', creator: '达人',
            lastMessage: '最后消息', noMessages: '暂无消息', viewCampaign: '查看活动', openConversation: '打开对话'
        };
}

function formatConversationDate(value, lang) {
    if (!value) return '';
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime())
        ? String(value)
        : parsed.toLocaleString(lang === 'en' ? 'en' : 'zh-CN');
}

function renderConversationsSummary(conversations, summary, lang) {
    const labels = conversationsText(lang);
    const unread = conversations.reduce((count, conversation) => count + (Number(conversation.unreadCount) || 0), 0);
    summary.replaceChildren();
    summary.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;';

    [
        [labels.total, conversations.length],
        [labels.unread, unread]
    ].forEach(([label, value]) => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.style.cssText = 'margin:0;padding:12px 16px;min-width:120px;';
        const labelElement = document.createElement('span');
        labelElement.style.cssText = 'display:block;color:var(--text-muted);font-size:.78rem;';
        labelElement.textContent = label;
        const valueElement = document.createElement('strong');
        valueElement.style.cssText = 'display:block;margin-top:4px;color:var(--text-main);font-size:1.2rem;';
        valueElement.textContent = value;
        card.append(labelElement, valueElement);
        summary.appendChild(card);
    });

    const navBadge = document.getElementById('conversationUnreadBadge');
    if (navBadge) {
        navBadge.textContent = unread > 99 ? '99+' : String(unread);
        navBadge.style.display = unread ? '' : 'none';
        navBadge.setAttribute('aria-label', `${unread} ${labels.unread}`);
    }
}

function renderConversationCard(conversation, lang) {
    const labels = conversationsText(lang);
    const card = document.createElement('article');
    card.className = 'message-item';
    card.dataset.requestId = conversation.requestId || conversation.request?.id || '';
    card.style.cssText = 'align-items:center;gap:14px;';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = String(conversation.influencer?.title || '?').trim().charAt(0).toUpperCase();
    avatar.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'message-content';
    content.style.cssText = 'flex:1;min-width:0;';

    const heading = document.createElement('h5');
    heading.style.cssText = 'margin:0 0 4px;';
    heading.textContent = conversation.influencer?.title || `${labels.creator} —`;
    content.appendChild(heading);

    const request = conversation.request || {};
    const requestText = document.createElement('p');
    requestText.style.cssText = 'margin:0;color:var(--text-main);';
    requestText.textContent = `${labels.request}: ${request.title || '—'}`;
    content.appendChild(requestText);

    const lastMessage = document.createElement('span');
    lastMessage.className = 'message-time';
    const formattedDate = formatConversationDate(conversation.lastMessageAt, lang);
    lastMessage.textContent = `${labels.lastMessage}: ${formattedDate || labels.noMessages}`;
    content.appendChild(lastMessage);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;align-items:center;gap:10px;flex-shrink:0;';
    const unreadCount = Number(conversation.unreadCount) || 0;
    if (unreadCount > 0) {
        const unreadBadge = document.createElement('span');
        unreadBadge.className = 'menu-badge';
        unreadBadge.style.cssText = 'position:static;';
        unreadBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        unreadBadge.setAttribute('aria-label', `${unreadCount} ${labels.unread}`);
        actions.appendChild(unreadBadge);
    }

    if (request.id) {
        const campaignLink = document.createElement('a');
        const langParam = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('lang') || 'zh';
        campaignLink.href = `/request-detail.html?id=${encodeURIComponent(request.id)}&lang=${encodeURIComponent(langParam)}`;
        campaignLink.textContent = labels.viewCampaign;
        campaignLink.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;background:rgba(102,126,234,.15);border:1px solid rgba(102,126,234,.3);border-radius:8px;color:#818cf8;cursor:pointer;font-family:inherit;font-size:.85rem;line-height:1.2;text-decoration:none;white-space:nowrap;';
        campaignLink.addEventListener('click', event => {
            if (typeof window.showSection !== 'function') return;
            event.preventDefault();
            window.showSection('request-detail', true, request.id);
        });
        actions.appendChild(campaignLink);
    }

    const threadRequestId = conversation.requestId || request.id;
    const threadEmail = conversation.influencer?.email;
    if (threadRequestId && threadEmail) {
        const conversationLink = document.createElement('a');
        const langParam = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('lang') || 'zh';
        const detailUrl = new URL('/conversation-detail.html', window.location.origin);
        detailUrl.searchParams.set('request_id', threadRequestId);
        detailUrl.searchParams.set('lang', langParam);
        detailUrl.searchParams.set('email', threadEmail);
        conversationLink.href = detailUrl.toString();
        conversationLink.textContent = labels.openConversation;
        conversationLink.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;background:rgba(102,126,234,.15);border:1px solid rgba(102,126,234,.3);border-radius:8px;color:#818cf8;cursor:pointer;font-family:inherit;font-size:.85rem;line-height:1.2;text-decoration:none;white-space:nowrap;';
        conversationLink.addEventListener('click', event => {
            event.preventDefault();
            if (typeof window.openConversationDetail === 'function') {
                window.openConversationDetail(threadRequestId, threadEmail, conversation.influencer?.title, request.title);
            } else if (typeof window.showSection === 'function') {
                window.showSection('conversation-detail', true, threadRequestId);
            }
        });
        actions.appendChild(conversationLink);
    }

    card.append(avatar, content, actions);
    if (unreadCount > 0) card.style.borderLeft = '3px solid var(--primary-color)';
    return card;
}

async function loadConversationsFromComponent(forceReload = false) {
    const list = document.getElementById('conversationsList');
    const summary = document.getElementById('conversationSummary');
    if (!list || !summary || conversationsRequestInProgress) return;
    if (window.conversationsLoaded && !forceReload) return;

    const lang = localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
    const labels = conversationsText(lang);
    const token = localStorage.getItem('authToken');
    if (!token) {
        list.replaceChildren();
        const message = document.createElement('div');
        message.className = 'content-card';
        message.style.cssText = 'padding:20px;color:var(--text-muted);';
        message.textContent = lang === 'en' ? 'Please sign in to view conversations.' : '请登录后查看对话。';
        list.appendChild(message);
        return;
    }

    conversationsRequestInProgress = true;
    list.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'content-card';
    loading.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);';
    loading.textContent = labels.loading;
    list.appendChild(loading);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(`${conversationsApiBaseUrl}/api/conversations`, {
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }

        const conversations = Array.isArray(data.conversations) ? data.conversations : [];
        window.allConversations = conversations;
        renderConversationsSummary(conversations, summary, lang);
        list.replaceChildren();
        if (!conversations.length) {
            const empty = document.createElement('div');
            empty.className = 'content-card';
            empty.style.cssText = 'text-align:center;padding:40px;color:var(--text-muted);';
            empty.textContent = labels.empty;
            list.appendChild(empty);
        } else {
            conversations.forEach(conversation => list.appendChild(renderConversationCard(conversation, lang)));
        }
        window.conversationsLoaded = true;
    } catch (error) {
        list.replaceChildren();
        const errorCard = document.createElement('div');
        errorCard.className = 'content-card';
        errorCard.style.cssText = 'padding:20px;color:#dc2626;';
        const errorText = document.createElement('p');
        errorText.style.cssText = 'margin:0 0 12px;';
        errorText.textContent = error.name === 'AbortError'
            ? (lang === 'en' ? 'The request timed out.' : '请求超时。')
            : `${labels.error}: ${error.message}`;
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'action-btn';
        retryButton.style.cssText = 'padding:7px 12px;';
        retryButton.textContent = labels.retry;
        retryButton.addEventListener('click', () => loadConversationsFromComponent(true));
        errorCard.append(errorText, retryButton);
        list.appendChild(errorCard);
        console.error('Load conversations error:', error);
    } finally {
        clearTimeout(timeoutId);
        conversationsRequestInProgress = false;
    }
}

window.loadConversationsFromComponent = loadConversationsFromComponent;

function initializeConversationsPage(root) {
    if (conversationsPageInitialized) return;
    conversationsPageInitialized = true;
    if (root?.dataset) root.dataset.componentScript = 'conversations';
    document.getElementById('refreshConversationsBtn')?.addEventListener('click', () => loadConversationsFromComponent(true));
    loadConversationsFromComponent();
}

if (typeof window.registerPageComponent === 'function') {
    window.registerPageComponent('conversations', initializeConversationsPage);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeConversationsPage(document), { once: true });
} else {
    initializeConversationsPage(document);
}
