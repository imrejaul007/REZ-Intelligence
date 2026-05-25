import logger from './utils/logger';

/**
 * REZ Web Widget - Embeddable Chat Bubble
 * Version: 1.0.0
 *
 * Usage:
 *   <script src="https://your-domain.com/widget.js"></script>
 *   <div id="rez-chat"></div>
 *
 *   Or initialize with custom options:
 *   window.ReZWidget.init({
 *     container: '#my-chat-container',
 *     serverUrl: 'https://your-domain.com',
 *     userId: 'optional-user-id'
 *   });
 */
(function (window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.ReZWidget && window.ReZWidget.initialized) {
    logger.warn('ReZWidget already initialized');
    return;
  }

  // Configuration with defaults
  const CONFIG = {
    serverUrl: window.location.origin,
    container: '#rez-chat',
    userId: null,
    position: 'bottom-right',
    theme: 'auto', // 'light', 'dark', or 'auto'
    title: 'Chat with us',
    placeholder: 'Type your message...',
    greeting: 'Hi there! How can I help you today?',
    showTimestamp: true,
    typingTimeout: 3000,
    maxMessageLength: 5000,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  };

  // State management
  const state = {
    socket: null,
    sessionId: null,
    connected: false,
    connecting: false,
    typing: false,
    typingTimeout: null,
    messages: [],
    reconnectAttempts: 0,
    widgetOpen: false,
  };

  // DOM Elements
  let container = null;
  let widgetButton = null;
  let chatWindow = null;
  let messagesContainer = null;
  let inputField = null;
  let sendButton = null;

  /**
   * Initialize the widget
   */
  function init(options) {
    // Merge user options with defaults
    Object.assign(CONFIG, options);

    // Find or create container
    container = document.querySelector(CONFIG.container);
    if (!container) {
      container = document.createElement('div');
      container.id = 'rez-chat-container';
      document.body.appendChild(container);
    }

    // Create widget structure
    createWidgetStructure();

    // Load styles
    loadStyles();

    // Connect to WebSocket server
    connectWebSocket();

    // Mark as initialized
    window.ReZWidget.initialized = true;
  }

  /**
   * Create the widget DOM structure
   */
  function createWidgetStructure() {
    // Create chat window
    chatWindow = document.createElement('div');
    chatWindow.className = 'rez-chat-window rez-chat-hidden';
    chatWindow.innerHTML = `
      <div class="rez-chat-header">
        <div class="rez-chat-header-content">
          <div class="rez-chat-avatar">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div class="rez-chat-header-text">
            <span class="rez-chat-title">${CONFIG.title}</span>
            <span class="rez-chat-status">Connecting...</span>
          </div>
        </div>
        <button class="rez-chat-close" aria-label="Close chat">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="rez-chat-messages">
        <div class="rez-chat-welcome">
          <div class="rez-chat-message rez-chat-message-assistant">
            <div class="rez-chat-bubble">${CONFIG.greeting}</div>
            <span class="rez-chat-time">${formatTime(new Date())}</span>
          </div>
        </div>
      </div>
      <div class="rez-chat-input-area">
        <input
          type="text"
          class="rez-chat-input"
          placeholder="${CONFIG.placeholder}"
          maxlength="${CONFIG.maxMessageLength}"
          aria-label="Type your message"
        />
        <button class="rez-chat-send" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;

    // Create floating button
    widgetButton = document.createElement('button');
    widgetButton.className = 'rez-chat-button';
    widgetButton.setAttribute('aria-label', 'Open chat');
    widgetButton.innerHTML = `
      <svg class="rez-chat-icon-main" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
      <svg class="rez-chat-icon-close rez-chat-hidden" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `;

    // Append to container
    container.appendChild(chatWindow);
    container.appendChild(widgetButton);

    // Get DOM references
    messagesContainer = chatWindow.querySelector('.rez-chat-messages');
    inputField = chatWindow.querySelector('.rez-chat-input');
    sendButton = chatWindow.querySelector('.rez-chat-send');

    // Attach event listeners
    attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  function attachEventListeners() {
    // Toggle chat window
    widgetButton.addEventListener('click', toggleChat);

    // Close button
    chatWindow.querySelector('.rez-chat-close').addEventListener('click', () => {
      closeChat();
    });

    // Send message on button click
    sendButton.addEventListener('click', sendMessage);

    // Send message on Enter key
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Enable/disable send button based on input
    inputField.addEventListener('input', () => {
      const hasText = inputField.value.trim().length > 0;
      sendButton.disabled = !hasText || !state.connected;

      // Handle typing indicator
      if (hasText && !state.typing) {
        state.typing = true;
        emitTyping(true);
      }

      // Clear existing timeout
      if (state.typingTimeout) {
        clearTimeout(state.typingTimeout);
      }

      // Set timeout to stop typing indicator
      state.typingTimeout = setTimeout(() => {
        state.typing = false;
        emitTyping(false);
      }, CONFIG.typingTimeout);
    });

    // Auto-resize input height
    inputField.addEventListener('input', autoResizeInput);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.widgetOpen) {
        closeChat();
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (state.widgetOpen && !container.contains(e.target)) {
        closeChat();
      }
    });
  }

  /**
   * Toggle chat window visibility
   */
  function toggleChat() {
    if (state.widgetOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  /**
   * Open chat window
   */
  function openChat() {
    state.widgetOpen = true;
    chatWindow.classList.remove('rez-chat-hidden');
    chatWindow.classList.add('rez-chat-visible');
    widgetButton.classList.add('rez-chat-button-active');
    widgetButton.querySelector('.rez-chat-icon-main').classList.add('rez-chat-hidden');
    widgetButton.querySelector('.rez-chat-icon-close').classList.remove('rez-chat-hidden');
    inputField.focus();

    // Scroll to bottom of messages
    scrollToBottom();
  }

  /**
   * Close chat window
   */
  function closeChat() {
    state.widgetOpen = false;
    chatWindow.classList.remove('rez-chat-visible');
    chatWindow.classList.add('rez-chat-hidden');
    widgetButton.classList.remove('rez-chat-button-active');
    widgetButton.querySelector('.rez-chat-icon-main').classList.remove('rez-chat-hidden');
    widgetButton.querySelector('.rez-chat-icon-close').classList.add('rez-chat-hidden');
  }

  /**
   * Send a message
   */
  function sendMessage() {
    const message = inputField.value.trim();

    if (!message || !state.connected) {
      return;
    }

    // Clear input
    inputField.value = '';
    sendButton.disabled = true;

    // Stop typing indicator
    if (state.typingTimeout) {
      clearTimeout(state.typingTimeout);
    }
    state.typing = false;
    emitTyping(false);

    // Add user message to UI
    addMessage('user', message);

    // Send via WebSocket
    emitMessage(message);
  }

  /**
   * Add a message to the chat
   */
  function addMessage(role, content, timestamp) {
    const time = timestamp || new Date();
    const timeStr = formatTime(time);

    const messageEl = document.createElement('div');
    messageEl.className = `rez-chat-message rez-chat-message-${role}`;

    if (role === 'user') {
      messageEl.innerHTML = `
        <div class="rez-chat-bubble">${escapeHtml(content)}</div>
        <span class="rez-chat-time">${timeStr}</span>
      `;
    } else {
      messageEl.innerHTML = `
        <div class="rez-chat-avatar-small">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <div class="rez-chat-bubble">${escapeHtml(content)}</div>
        <span class="rez-chat-time">${timeStr}</span>
      `;
    }

    // Remove welcome message on first real message
    const welcome = messagesContainer.querySelector('.rez-chat-welcome');
    if (welcome && role === 'user') {
      welcome.remove();
    }

    messagesContainer.appendChild(messageEl);
    scrollToBottom();

    // Store message
    state.messages.push({ role, content, timestamp: time });
  }

  /**
   * Add typing indicator
   */
  function addTypingIndicator() {
    const existing = messagesContainer.querySelector('.rez-chat-typing');
    if (existing) return;

    const typingEl = document.createElement('div');
    typingEl.className = 'rez-chat-message rez-chat-message-assistant rez-chat-typing';
    typingEl.innerHTML = `
      <div class="rez-chat-avatar-small">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      </div>
      <div class="rez-chat-bubble rez-chat-typing-bubble">
        <span class="rez-chat-typing-dot"></span>
        <span class="rez-chat-typing-dot"></span>
        <span class="rez-chat-typing-dot"></span>
      </div>
    `;

    messagesContainer.appendChild(typingEl);
    scrollToBottom();
  }

  /**
   * Remove typing indicator
   */
  function removeTypingIndicator() {
    const typing = messagesContainer.querySelector('.rez-chat-typing');
    if (typing) {
      typing.remove();
    }
  }

  /**
   * Connect to WebSocket server
   */
  function connectWebSocket() {
    if (state.connecting || state.connected) {
      return;
    }

    state.connecting = true;
    updateConnectionStatus('Connecting...');

    // Load Socket.IO client if not available
    if (typeof io === 'undefined') {
      loadSocketIO().then(() => {
        establishConnection();
      });
    } else {
      establishConnection();
    }
  }

  /**
   * Load Socket.IO client library
   */
  function loadSocketIO() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${CONFIG.serverUrl}/socket.io/socket.io.js`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Establish WebSocket connection
   */
  function establishConnection() {
    try {
      state.socket = io(CONFIG.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: CONFIG.reconnectInterval,
        reconnectionAttempts: CONFIG.maxReconnectAttempts,
      });

      // Connection event handlers
      state.socket.on('connect', handleConnect);
      state.socket.on('disconnect', handleDisconnect);
      state.socket.on('connect_error', handleConnectionError);
      state.socket.on('event', handleServerEvent);

      // Reconnection events
      state.socket.io.on('reconnect_attempt', () => {
        updateConnectionStatus('Reconnecting...');
      });

      state.socket.io.on('reconnect', () => {
        state.reconnectAttempts = 0;
      });

    } catch (error) {
      console.error('ReZWidget: Failed to establish connection', error);
      state.connecting = false;
      updateConnectionStatus('Connection failed');
      scheduleReconnect();
    }
  }

  /**
   * Handle successful connection
   */
  function handleConnect() {
    state.connected = true;
    state.connecting = false;
    state.reconnectAttempts = 0;
    updateConnectionStatus('Online');

    // Update send button state
    if (inputField && inputField.value.trim()) {
      sendButton.disabled = false;
    }

    // If we have a session, rejoin it
    if (state.sessionId) {
      state.socket.emit('join_session', {
        sessionId: state.sessionId,
        userId: CONFIG.userId,
      });
    }

    logger.info('ReZWidget: Connected');
  }

  /**
   * Handle disconnection
   */
  function handleDisconnect(reason) {
    state.connected = false;
    state.connecting = false;
    updateConnectionStatus('Offline');

    console.log('ReZWidget: Disconnected', reason);

    // Reconnect if not intentional
    if (reason !== 'io client disconnect') {
      scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   */
  function handleConnectionError(error) {
    state.connecting = false;
    console.error('ReZWidget: Connection error', error);
    updateConnectionStatus('Connection failed');
    scheduleReconnect();
  }

  /**
   * Handle server events
   */
  function handleServerEvent(data) {
    switch (data.type) {
      case 'connected':
        // Initial connection acknowledgment
        break;

      case 'session_created':
        state.sessionId = data.payload.sessionId;
        console.log('ReZWidget: Session created', state.sessionId);
        break;

      case 'response':
        removeTypingIndicator();
        addMessage('assistant', data.payload.message, data.payload.timestamp);
        break;

      case 'typing':
        if (data.payload.isTyping) {
          addTypingIndicator();
        } else {
          removeTypingIndicator();
        }
        break;

      case 'error':
        removeTypingIndicator();
        console.error('ReZWidget: Server error', data.payload);
        addMessage('assistant', 'I encountered an error. Please try again.');
        break;
    }
  }

  /**
   * Emit message to server
   */
  function emitMessage(message) {
    if (!state.socket || !state.connected) {
      logger.warn('ReZWidget: Cannot send message, not connected');
      return;
    }

    state.socket.emit('message', {
      type: 'message',
      payload: {
        sessionId: state.sessionId,
        message: message,
        userId: CONFIG.userId,
      },
    });
  }

  /**
   * Emit typing indicator
   */
  function emitTyping(isTyping) {
    if (!state.socket || !state.connected || !state.sessionId) {
      return;
    }

    state.socket.emit('typing', {
      sessionId: state.sessionId,
      isTyping: isTyping,
    });
  }

  /**
   * Schedule reconnection attempt
   */
  function scheduleReconnect() {
    if (state.reconnectAttempts >= CONFIG.maxReconnectAttempts) {
      updateConnectionStatus('Connection failed');
      return;
    }

    state.reconnectAttempts++;
    setTimeout(() => {
      if (!state.connected) {
        connectWebSocket();
      }
    }, CONFIG.reconnectInterval);
  }

  /**
   * Update connection status display
   */
  function updateConnectionStatus(status) {
    const statusEl = chatWindow?.querySelector('.rez-chat-status');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = `rez-chat-status rez-chat-status-${status.toLowerCase().replace(/\s+/g, '-')}`;
    }
  }

  /**
   * Load widget styles
   */
  function loadStyles() {
    // Check if styles already loaded
    if (document.getElementById('rez-chat-styles')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'rez-chat-styles';
    link.rel = 'stylesheet';
    link.href = `${CONFIG.serverUrl}/widget.css`;
    document.head.appendChild(link);
  }

  // Utility functions

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function autoResizeInput() {
    inputField.style.height = 'auto';
    inputField.style.height = Math.min(inputField.scrollHeight, 120) + 'px';
  }

  // Public API
  window.ReZWidget = {
    initialized: false,
    init: init,
    send: function (message) {
      if (message && state.connected) {
        emitMessage(message);
      }
    },
    setUserId: function (userId) {
      CONFIG.userId = userId;
    },
    getSessionId: function () {
      return state.sessionId;
    },
    isConnected: function () {
      return state.connected;
    },
    open: function () {
      openChat();
    },
    close: function () {
      closeChat();
    },
  };

  // Auto-initialize if container exists
  if (document.querySelector(CONFIG.container)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})(window, document);
