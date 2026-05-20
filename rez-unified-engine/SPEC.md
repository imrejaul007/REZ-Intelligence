# REZ Unified Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Communication

---

## Overview

Unified conversation engine that connects all communication channels (WhatsApp, Voice, Copilot, Web) to REZ Agent OS. Central hub for multi-channel messaging with Socket.IO support.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Unified Conversation Engine                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Channels:                                                                 │
│  ├── WhatsApp Adapter  → WhatsApp Business API integration                  │
│  ├── Voice Adapter     → Voice/SMS channel handling                        │
│  ├── Copilot Adapter   → AI copilot integration                           │
│  └── Web Adapter       → Web chat integration                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Multi-channel routing  → Route messages to correct channel          │
│  ├── Session management     → Maintain conversation context               │
│  ├── Real-time via Socket.IO → Live message delivery                      │
│  └── Webhook integration    → External system callbacks                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/ready` | Readiness probe |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages` | Send message |
| GET | `/api/messages/:id` | Get message |
| GET | `/api/messages/session/:sessionId` | Session messages |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session |
| PATCH | `/api/sessions/:id` | Update session |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/whatsapp` | WhatsApp webhook |
| POST | `/webhooks/voice` | Voice webhook |
| POST | `/webhooks/copilot` | Copilot webhook |
| POST | `/webhooks/web` | Web webhook |

---

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-session` | Client → Server | Join session room |
| `leave-session` | Client → Server | Leave session room |
| `typing` | Client → Server | Typing indicator |
| `web-message` | Client → Server | Send web message |
| `web-message-response` | Server → Client | Message response |
| `agent-response` | Server → Client | Agent reply |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "socket.io": "^4.7.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "crypto-js": "^4.2.0",
  "express-rate-limit": "^7.1.5",
  "axios": "^1.6.2"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Service port |
| MONGODB_URI | MongoDB connection |
| REDIS_URL | Redis connection |
| CORS_ORIGINS | Allowed origins |
| WHATSAPP_TOKEN | WhatsApp API token |
| VOICE_API_KEY | Voice service key |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-autonomous-agents | Write | Agent orchestration |
| REZ-conversation-intelligence | Read | NLP analysis |
| WhatsApp API | Write | WhatsApp delivery |
| Voice providers | Write | SMS/voice delivery |

---

## Status

- [x] Service foundation
- [x] WhatsApp adapter
- [x] Voice adapter
- [x] Copilot adapter
- [x] Web adapter
- [x] Socket.IO real-time
- [x] Session management
- [x] Webhook integration
- [ ] Conversation logging
- [ ] Analytics
