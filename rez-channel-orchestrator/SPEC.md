# REZ Channel Orchestrator - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Communication

---

## Overview

Unified entry point for all communication channels. Orchestrates routing between WhatsApp, Voice, SMS, Push notifications, and other channels with unified message handling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Channel Orchestrator                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Channels:                                                                 │
│  ├── WhatsApp  → Meta WhatsApp Business API                             │
│  ├── Voice     → IVR, voice calls                                        │
│  ├── SMS       → Text messaging                                         │
│  ├── Push      → Mobile push notifications                               │
│  └── Email     → Email campaigns                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Unified routing    → Route to appropriate channel                   │
│  ├── Message normalization → Standardize message format                 │
│  └── Delivery tracking → Track message delivery                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/send` | Send message via any channel |
| GET | `/api/messages/:id` | Get message status |

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/channels` | List available channels |
| GET | `/api/channels/:id/status` | Channel status |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/inbound` | Receive inbound messages |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "axios": "^1.6.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-unified-engine | Write | Message delivery |
| REZ-notifications | Write | Push notifications |
| WhatsApp API | Write | WhatsApp messages |
| SMS providers | Write | SMS delivery |

---

## Status

- [x] Service foundation
- [ ] Channel orchestration
- [ ] Message routing
- [ ] Webhook handling
- [ ] Delivery tracking
