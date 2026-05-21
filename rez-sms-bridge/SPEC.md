# REZ SMS Bridge - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

SMS gateway bridge that connects SMS messaging to the REZ Orchestrator. Handles incoming SMS via Twilio, processes messages, and routes them to appropriate agents for response.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ SMS Bridge                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flow:                                                                    │
│  SMS → Twilio Webhook → Parse → Route to Agent → Generate Response → Send │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| Twilio Integration | Receive and send SMS |
| Message Parsing | Extract intent from SMS |
| Agent Routing | Route to appropriate agent |
| Response Generation | Generate SMS responses |
| Session Management | Multi-message conversations |

---

## API Endpoints

### SMS
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/twilio` | Twilio incoming SMS webhook |
| POST | `/api/sms/send` | Send SMS |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/:phone` | Get SMS session |
| DELETE | `/api/sessions/:phone` | End session |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.0",
  "twilio": "^4.19.0",
  "axios": "^1.6.0",
  "zod": "^3.22.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Twilio | Webhook | Incoming/outgoing SMS |
| REZ Orchestrator | Invoke | Agent routing |
| REZ Intent Graph | Read | Message parsing |

---

## Status

- [x] SMS foundation
- [x] Twilio webhook
- [x] Agent routing
- [x] Response generation
- [ ] Session management
