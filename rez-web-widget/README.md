# REZ Web Widget

Embeddable chat bubble widget for websites, powered by the ReZ AI platform.

## Features

- **Real-time WebSocket communication** via Socket.IO
- **AI-powered responses** through the ReZ Orchestrator service
- **Session management** with Redis-backed state
- **Responsive design** with light/dark theme support
- **Accessible** with keyboard navigation and screen reader support
- **Lightweight** - minimal footprint, lazy-loaded assets

## Quick Start

### Installation

```bash
cd REZ-Intelligence/rez-web-widget
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=4088
ORCHESTRATOR_URL=http://localhost:4006
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"rez-web-widget":"your-secret-token"}
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Embedding in Your Website

### Basic Usage

Add the following to your HTML `<body>`:

```html
<script src="https://your-domain.com/widget.js"></script>
<div id="rez-chat"></div>
```

### Custom Configuration

Initialize with custom options:

```html
<script>
  window.ReZWidget.init({
    container: '#my-chat-container',
    serverUrl: 'https://your-domain.com',
    userId: 'optional-user-id',
    title: 'Chat with Support',
    placeholder: 'Ask us anything...',
    greeting: 'Hello! How can I help you today?'
  });
</script>
<div id="my-chat-container"></div>
```

### Programmatic Control

```javascript
// Open the chat widget
window.ReZWidget.open();

// Close the chat widget
window.ReZWidget.close();

// Set user ID after initialization
window.ReZWidget.setUserId('user-123');

// Send a message programmatically
window.ReZWidget.send('Hello, I need help with my order');

// Check connection status
if (window.ReZWidget.isConnected()) {
  console.log('Widget is connected');
}

// Get current session ID
const sessionId = window.ReZWidget.getSessionId();
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/widget.js` | Widget JavaScript bundle |
| GET | `/widget.css` | Widget styles |
| POST | `/api/session` | Create new chat session |
| GET | `/api/session/:id` | Get session details |
| DELETE | `/api/session/:id` | End session |
| POST | `/api/session/:id/message` | Send message (REST fallback) |
| GET | `/api/health` | Health check |
| WS | `/socket.io` | WebSocket connection |

## WebSocket Events

### Client to Server

```javascript
// Send a message
socket.emit('message', {
  type: 'message',
  payload: {
    sessionId: 'optional-session-id',
    message: 'Hello!',
    userId: 'optional-user-id'
  }
});

// Join existing session
socket.emit('join_session', {
  sessionId: 'session-uuid',
  userId: 'optional-user-id'
});

// Send typing indicator
socket.emit('typing', {
  sessionId: 'session-uuid',
  isTyping: true
});
```

### Server to Client

```javascript
socket.on('event', (data) => {
  switch (data.type) {
    case 'connected':
      // Initial connection acknowledgment
      break;
    case 'session_created':
      // New session created
      console.log('Session:', data.payload.sessionId);
      break;
    case 'response':
      // AI response received
      console.log('Message:', data.payload.message);
      break;
    case 'typing':
      // Assistant is typing
      if (data.payload.isTyping) {
        // Show typing indicator
      }
      break;
    case 'error':
      // Error occurred
      console.error('Error:', data.payload.message);
      break;
  }
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Website                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              REZ Web Widget (widget.js)             │   │
│  │  - Floating chat button                              │   │
│  │  - Chat window UI                                    │   │
│  │  - Socket.IO client                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   REZ Web Widget Server                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Express    │  │  Socket.IO   │  │  REST API    │      │
│  │   (Static)   │  │  (Real-time)│  │  (Fallback)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   WidgetService                      │   │
│  │  - Session management                                │   │
│  │  - Message routing                                   │   │
│  │  - Orchestrator integration                          │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│      Redis       │      │   Orchestrator    │
│  (State/Session)│      │  (AI Processing)  │
└──────────────────┘      └──────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4088` | Server port |
| `ORCHESTRATOR_URL` | `http://localhost:4006` | AI orchestrator service URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `INTERNAL_SERVICE_TOKENS_JSON` | `{}` | JSON map of service tokens |
| `CORS_ORIGINS` | `*` | Comma-separated CORS origins |
| `WIDGET_PING_INTERVAL` | `25000` | Socket.IO ping interval (ms) |
| `WIDGET_SESSION_TIMEOUT` | `3600000` | Session timeout (ms) |
| `WIDGET_MAX_MESSAGE_LENGTH` | `5000` | Max message length |

## Security

- All webhook payloads verified via HMAC-SHA256
- Session tokens stored in Redis with TTL
- CORS origin validation
- Message length limits enforced
- Rate limiting recommended at load balancer level

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Proprietary - ReZ Commerce Platform
