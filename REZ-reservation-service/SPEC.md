# REZ Reservation Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce

---

## Overview

Table reservation service for restaurants. Manages table bookings, availability calendars, and reservation workflows for restaurant merchants.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ Reservation Service                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                           │
│  ├── Table Management → Define tables and capacity                      │
│  ├── Booking System  → Handle reservation requests                       │
│  ├── Availability   → Real-time table availability                     │
│  └── Notifications  → Booking confirmations and reminders              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "uuid": "^9.0.1",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| RABTUL-notifications | Write | Booking reminders |
| REZ-merchant-service | Read | Restaurant data |

---

## Status

- [x] Service foundation
- [ ] Table management
- [ ] Booking system
- [ ] Availability calendar
- [ ] Notifications
