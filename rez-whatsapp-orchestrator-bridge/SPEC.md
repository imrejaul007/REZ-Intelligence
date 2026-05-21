# REZ WhatsApp Orchestrator Bridge - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Bridges WhatsApp messages to the REZ Orchestrator. Receives incoming WhatsApp messages via webhook, processes them through the agent orchestrator, and sends responses back.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│          REZ WhatsApp Orchestrator Bridge                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flow:                                                                    │
│  WhatsApp → Webhook → Parse → Orchestrator → Agent → Response → WhatsApp │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### WhatsApp
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/whatsapp` | Incoming message webhook |
| POST | `/api/send` | Send outgoing message |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "ioredis": "^5.3.2",
  "axios": "^1.6.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "helmet": "^7.1.0",
  "compression": "^1.7.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| WhatsApp Business API | Webhook | Incoming/outgoing |
| REZ Orchestrator | Invoke | Agent routing |
| REZ Intent Graph | Read | Message parsing |

---

## Status

- [x] Webhook handling
- [x] Message routing
- [x] Response generation
- [x] Session management
