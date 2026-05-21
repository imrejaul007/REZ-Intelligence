# REZ Support Agent - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for customer support. Handles ticket management, refund processing, and general customer assistance with intelligent routing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Support Agent                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Ticket Management    → Create, update, resolve tickets               │
│  ├── Refund Handling      → Process refund requests                       │
│  ├── Customer Assistance → General support queries                        │
│  └── Smart Routing       → Route to appropriate handler                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Support
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/support/ticket` | Create support ticket |
| GET | `/api/support/ticket/:id` | Get ticket |
| POST | `/api/support/refund` | Process refund |
| POST | `/api/support/chat` | Chat with support |

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
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Care Service | Read/Write | Ticket management |
| RABTUL Payment | Write | Refund processing |
| REZ Care Command Center | Write | Agent dashboard |

---

## Status

- [x] Service foundation
- [x] Ticket management
- [x] Refund handling
- [x] Customer assistance
- [ ] Smart routing
