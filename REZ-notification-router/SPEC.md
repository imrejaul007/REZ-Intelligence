# REZ Notification Router - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Communication

---

## Overview

Notification routing service that routes messages via push, SMS, and email channels. Intelligent routing based on user preferences and message urgency.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Notification Router                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Channels:                                                                 │
│  ├── Push Notifications → Mobile app notifications                          │
│  ├── SMS              → Text messages                                      │
│  └── Email           → Email delivery                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routing Logic:                                                            │
│  ├── User Preferences → Channel preference per user                        │
│  ├── Message Priority → High priority = multi-channel                       │
│  └── Delivery Status  → Track and retry failed deliveries                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications` | Send notification |
| POST | `/api/notifications/batch` | Batch send |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |

### Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/:id/status` | Delivery status |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Service foundation
- [ ] Push routing
- [ ] SMS routing
- [ ] Email routing
- [ ] Template management
- [ ] Delivery tracking
