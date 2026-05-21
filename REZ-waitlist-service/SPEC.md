# REZ Waitlist Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce

---

## Overview

Queue management and waitlist service. Manages customer queues, appointment scheduling, and waitlist positions across the REZ ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Waitlist Service                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Queue Management   → Virtual queue positions                         │
│  ├── Waitlist         → Product/service waitlists                       │
│  ├── Position Tracking → Real-time position updates                      │
│  └── Notifications     → Queue advancement alerts                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Queues
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/queues` | Create queue |
| GET | `/api/queues/:id` | Get queue status |
| POST | `/api/queues/:id/join` | Join queue |

### Waitlists
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/waitlist` | Add to waitlist |
| GET | `/api/waitlist/:id` | Get position |
| DELETE | `/api/waitlist/:id` | Remove from waitlist |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Service foundation
- [ ] Queue management
- [ ] Position tracking
- [ ] Waitlist handling
- [ ] Notifications
