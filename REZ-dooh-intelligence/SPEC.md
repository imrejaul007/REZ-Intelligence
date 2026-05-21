# REZ DOOH Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** 4080
**Company:** REZ-Intelligence
**Category:** DOOH

---

## Overview

DOOH Screen Intelligence service that connects DOOH inventory to user intelligence for targeted advertising. Provides dynamic pricing, audience targeting, and campaign optimization based on screen captivity levels.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ DOOH Intelligence                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Screen Types by Captivity:                                               │
│  ├── Personal (2.0x)     → Hotel TV, Flight Seat                        │
│  ├── Captive Private (1.5x) → Cab Screen, Gym Screen                     │
│  ├── Semi-Captive (1.2x) → Mall Kiosk, Office Lobby                     │
│  └── Public (1.0x)        → Billboard, Bus Shelter                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pricing Factors:                                                         │
│  ├── Time        → Peak hours 2x, business hours 1.5x                    │
│  ├── City Tier   → Metro 2.5x, Tier1 2x, Tier2 1.3x                    │
│  ├── Seasonal    → Festival 2.5x, Holiday 1.8x                          │
│  └── Captivity   → Screen attention level                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Screen Types

| Type | Base CPM | Captivity | Best For |
|------|---------|-----------|----------|
| Hotel TV | ₹50 | Personal | Restaurant, Travel |
| Flight Seat | ₹45 | Personal | Duty-free, Insurance |
| Cab Screen | ₹35 | Captive Private | Food delivery, Entertainment |
| Mall Kiosk | ₹30 | Semi-Captive | Fashion, Dining |
| Office Lobby | ₹25 | Semi-Captive | Food, Wellness |
| Gym Screen | ₹30 | Captive Private | Supplements, Fitness |
| Billboard LED | ₹80 | Public | Brand awareness |
| Bus Shelter | ₹15 | Public | Local services |

---

## API Endpoints

### Screen Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/screens/types` | List all screen types with pricing |

### Pricing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pricing/calculate` | Calculate dynamic CPM |
| POST | `/api/pricing/duration` | Calculate duration pricing |
| GET | `/api/pricing/multipliers` | Current multiplier values |
| GET | `/api/demo/pricing` | Sample pricing demo |

### Targeting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/targeting/users` | Find targeted users for screen |
| GET | `/api/targeting/screen-profile/:type` | Audience profile by screen type |

---

## Pricing Multipliers

| Category | Multiplier | Examples |
|----------|-----------|----------|
| Peak Morning | 2.0x | 7-9am |
| Peak Evening | 2.0x | 6-9pm |
| Metro City | 2.5x | Mumbai, Delhi |
| Tier 1 | 2.0x | Major cities |
| Festival | 2.5x | Diwali, Christmas |
| Holiday | 1.8x | Vacations |

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
| REZ-user-profile | Read | User demographics |
| REZ-dooh-service | Write | Campaign management |
| REZ-attribution | Read/Write | Attribution data |

---

## Status

- [x] Service foundation
- [x] Screen type catalog
- [x] Dynamic pricing engine
- [x] Multiplier system
- [x] Audience targeting
- [ ] Screen profile analytics
- [ ] Campaign optimization
