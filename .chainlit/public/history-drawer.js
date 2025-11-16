/**
 * Chat History Drawer for Chainlit
 * Adds a slide-out drawer to view and manage conversation history
 */

(function () {
  'use strict';

  // State
  let drawerOpen = false;
  let conversations = [];

  // Create drawer elements
  function createDrawer() {
    // Check if drawer already exists
    if (document.getElementById('history-drawer')) {
      return;
    }

    // Create history button for left corner
    const historyBtn = document.createElement('button');
    historyBtn.id = 'history-drawer-btn';
    historyBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
    historyBtn.title = 'Chat History';
    historyBtn.onclick = toggleDrawer;

    // Create new chat button
    const newChatBtn = document.createElement('button');
    newChatBtn.id = 'new-chat-btn';
    newChatBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14m-7-7h14"/>
      </svg>
    `;
    newChatBtn.title = 'New Chat';
    newChatBtn.onclick = startNewChat;

    // Create button container
    const btnContainer = document.createElement('div');
    btnContainer.id = 'history-btn-container';
    btnContainer.appendChild(newChatBtn);
    btnContainer.appendChild(historyBtn);

    // Create drawer overlay
    const overlay = document.createElement('div');
    overlay.id = 'history-drawer-overlay';
    overlay.onclick = closeDrawer;

    // Create drawer panel
    const drawer = document.createElement('div');
    drawer.id = 'history-drawer';
    drawer.innerHTML = `
      <div class="drawer-header">
        <h3>Chat History</h3>
        <button class="drawer-close" onclick="window.closeHistoryDrawer()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="drawer-content">
        <div id="conversations-list">
          <div class="loading">Loading conversations...</div>
        </div>
      </div>
    `;

    // Append to body
    document.body.appendChild(btnContainer);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
  }

  // Toggle drawer open/close
  function toggleDrawer() {
    if (drawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  // Open drawer
  function openDrawer() {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('history-drawer-overlay');

    if (drawer && overlay) {
      drawer.classList.add('open');
      overlay.classList.add('visible');
      drawerOpen = true;
      loadConversations();
    }
  }

  // Close drawer
  function closeDrawer() {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('history-drawer-overlay');

    if (drawer && overlay) {
      drawer.classList.remove('open');
      overlay.classList.remove('visible');
      drawerOpen = false;
    }
  }

  // Load conversations from backend
  function loadConversations() {
    const listEl = document.getElementById('conversations-list');
    if (listEl) {
      listEl.innerHTML = '<div class="loading">Loading conversations...</div>';
    }

    // Send command to backend via Chainlit message
    sendCommand('__CMD__LIST_CONVERSATIONS__');
  }

  // Send a command message to Chainlit backend
  function sendCommand(command) {
    // Find the chat input and submit button
    const inputEl = document.querySelector('textarea[data-id="chat-input"]') ||
      document.querySelector('.cl-textarea') ||
      document.querySelector('textarea');

    const submitBtn = document.querySelector('[data-testid="send-button"]') ||
      document.querySelector('button[type="submit"]') ||
      document.querySelector('.send-button');

    if (inputEl) {
      // Store original value and focus state
      const originalValue = inputEl.value;
      const wasFocused = document.activeElement === inputEl;

      // Set the command
      inputEl.value = command;

      // Trigger React's onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(inputEl, command);

      const inputEvent = new Event('input', { bubbles: true });
      inputEl.dispatchEvent(inputEvent);

      // Submit the form
      setTimeout(() => {
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        } else {
          // Try pressing Enter
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          inputEl.dispatchEvent(enterEvent);
        }

        // Restore original state after a brief delay
        setTimeout(() => {
          if (wasFocused) {
            inputEl.focus();
          }
        }, 100);
      }, 50);
    }
  }

  // Render conversations list
  function renderConversations(convList) {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;

    if (!convList || convList.length === 0) {
      listEl.innerHTML = '<div class="no-conversations">No conversation history yet.</div>';
      return;
    }

    let html = '';
    convList.forEach(conv => {
      const date = new Date(conv.updated_at);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const preview = conv.preview || 'No preview available';

      html += `
        <div class="conversation-item" data-id="${conv.id}">
          <div class="conv-header">
            <div class="conv-title">${escapeHtml(conv.title)}</div>
            <button class="conv-delete" onclick="window.deleteConversation('${conv.id}')" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
          <div class="conv-preview">${escapeHtml(preview)}</div>
          <div class="conv-meta">
            <span class="conv-date">${dateStr}</span>
            <span class="conv-count">${conv.message_count} messages</span>
          </div>
          <button class="conv-load" onclick="window.loadConversation('${conv.id}')">
            Load Conversation
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Start new chat
  function startNewChat() {
    // Find and click the new_chat action button if it exists
    const newChatAction = document.querySelector('[data-action="new_chat"]');
    if (newChatAction) {
      newChatAction.click();
    } else {
      // Reload the page to start fresh
      window.location.reload();
    }
  }

  // Load a specific conversation
  window.loadConversation = function (convId) {
    closeDrawer();
    showNotification('Loading conversation...');

    // Send command to load the conversation
    sendCommand(`__CMD__LOAD__${convId}`);
  };

  // Delete a conversation
  window.deleteConversation = function (convId) {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    // Remove from UI immediately for better UX
    const item = document.querySelector(`.conversation-item[data-id="${convId}"]`);
    if (item) {
      item.style.opacity = '0.5';
    }

    showNotification('Deleting conversation...');

    // Send command to delete the conversation
    sendCommand(`__CMD__DELETE__${convId}`);
  };

  // Show notification
  function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'history-notification';
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.classList.add('fade-out');
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }

  // Expose functions globally
  window.closeHistoryDrawer = closeDrawer;
  window.openHistoryDrawer = openDrawer;
  window.toggleHistoryDrawer = toggleDrawer;

  // Monitor for conversation list responses
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent || '';

          // Hide command messages (user sent)
          if (text.startsWith('__CMD__')) {
            node.style.display = 'none';
            node.classList.add('hidden-command');
          }

          // Check for conversation list response
          if (text.includes('__CONV_LIST__') && text.includes('__END_CONV_LIST__')) {
            const match = text.match(/__CONV_LIST__(.+?)__END_CONV_LIST__/);
            if (match) {
              try {
                const convList = JSON.parse(match[1]);
                renderConversations(convList);
                // Hide the message element
                node.style.display = 'none';
                node.classList.add('hidden-command');
              } catch (e) {
                console.error('Failed to parse conversation list:', e);
              }
            }
          }

          // Check for deleted confirmation
          if (text.includes('__CONV_DELETED__')) {
            node.style.display = 'none';
            node.classList.add('hidden-command');
            // Remove the faded item from UI
            const fadedItems = document.querySelectorAll('.conversation-item[style*="opacity"]');
            fadedItems.forEach(item => item.remove());
          }
        }
      });
    });
  });

  // Start observing when DOM is ready
  function init() {
    createDrawer();

    // Observe message container for responses
    const messageContainer = document.querySelector('[data-testid="messages-container"]') ||
      document.querySelector('.cl-message-list') ||
      document.querySelector('.messages-container') ||
      document.body;

    observer.observe(messageContainer, {
      childList: true,
      subtree: true
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure Chainlit UI is fully loaded
    setTimeout(init, 500);
  }
})();
