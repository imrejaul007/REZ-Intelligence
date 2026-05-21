# REZ RCS Bridge - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Rich Communication Services (RCS) bridge for India (Jio/Airtel). Enables rich messaging features including images, carousels, and interactive buttons via RCS protocol.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ RCS Bridge                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  RCS Features:                                                           │
│  ├── Rich Cards     → Image + text cards                                │
│  ├── Carousels     → Swipeable content                                  │
│  ├── Quick Replies  → Button responses                                   │
│  └── Chatbot        → Automated conversations                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### RCS
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send` | Send RCS message |
| POST | `/webhook/rcs` | Incoming message webhook |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.10",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "jsonwebtoken": "^9.0.2"
}
```

---

## Supported Operators

| Operator | Status |
|----------|--------|
| Jio | ✅ |
| Airtel | ✅ |

---

## Status

- [x] RCS foundation
- [x] Rich card support
- [x] Carousel support
- [x] Quick replies
- [ ] Chatbot integration
