# REZ DOOH Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Advertising Intelligence

---

## Overview

DOOH (Digital Out of Home) Screen Intelligence service that connects DOOH inventory to user intelligence for targeted advertising. Enables location-based targeting, audience measurement, and campaign optimization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ DOOH Intelligence                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Screen Inventory   → Manage DOOH screen network                    │
│  ├── Audience Targeting → Connect to user segments                       │
│  ├── Campaign Optimization → AI-powered campaign tuning                   │
│  └── Performance Tracking → Real-time ad metrics                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/dooh/*                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Screen Types

| Type | Description |
|------|-------------|
| `cab_tablet` | Taxi/Travel screen |
| `retail_kiosk` | Retail store display |
| `elevator_screen` | Building elevator |
| `billboard_led` | LED billboards |
| `restaurant_order` | Restaurant menu board |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-targeting-engine | Read | Audience segments |
| REZ-creative-engine | Read | Ad creatives |
| REZ-dooh-service | Read/Write | Screen management |
| REZ-signal-aggregator | Write | Engagement signals |

---

## Status

- [x] Service foundation
- [ ] Screen inventory management
- [ ] Audience targeting
- [ ] Campaign optimization
- [ ] Performance tracking
- [ ] CPM optimization
