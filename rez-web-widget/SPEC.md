# REZ Web Widget - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** UI Component

---

## Overview

Embeddable chat bubble widget for websites. Provides real-time chat functionality using Socket.IO for bidirectional communication. Can be embedded via JavaScript snippet.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Web Widget                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Widget Client      → Embeddable JS/CSS                              │
│  ├── WebSocket Server  → Socket.IO for real-time                        │
│  └── Chat API          → Message handling & storage                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| Chat Bubble | Floating chat button |
| Real-time Messaging | Socket.IO bidirectional |
| Message History | Redis-backed session storage |
| Typing Indicators | Real-time typing status |
| Notifications | New message alerts |

---

## API Endpoints

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages` | Send message |
| GET | `/api/messages/:sessionId` | Get message history |
| POST | `/api/sessions` | Create chat session |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:message` | Both | Send/receive message |
| `chat:typing` | Both | Typing indicator |
| `chat:read` | Client→Server | Mark as read |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "redis": "^4.6.10",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "cors": "^2.8.5"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Orchestrator | Read | Route to agents |
| RABTUL Auth | Read | User authentication |
| REZ Care Service | Write | Support tickets |

---

## Embed Code

```html
<script src="https://widget.rez.money/embed.js"></script>
<script>
  RezWidget.init({ apiKey: 'YOUR_KEY', position: 'bottom-right' });
</script>
```

---

## Status

- [x] Widget foundation
- [x] Socket.IO server
- [x] Message handling
- [x] Session management
- [ ] Typing indicators
- [ ] Rich media support
