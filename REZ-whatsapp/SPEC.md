# REZ WhatsApp Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Communication

---

## Overview

Unified WhatsApp layer service that consolidates all WhatsApp functionality for the REZ ecosystem. Handles business messaging, template management, and webhook processing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ WhatsApp Service                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Twilio Integration  → WhatsApp Business API                        │
│  ├── Template Manager    → Message templates                             │
│  ├── Webhook Processor  → Inbound message handling                      │
│  └── Session Manager    → Conversation state                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/send` | Send WhatsApp message |
| POST | `/api/messages/template` | Send template message |
| GET | `/api/messages/:id` | Message status |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List approved templates |
| POST | `/api/templates` | Request new template |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/whatsapp` | WhatsApp webhook |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/:userId` | Get conversation |
| POST | `/api/sessions/:userId/end` | End session |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "twilio": "^4.19.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "express-rate-limit": "^7.1.5",
  "jsonwebtoken": "^9.0.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-unified-engine | Read | Message routing |
| REZ-conversation-intelligence | Write | Analytics |

---

## Status

- [x] Service foundation
- [x] Twilio integration
- [ ] Template management
- [ ] Webhook processing
- [ ] Session management
