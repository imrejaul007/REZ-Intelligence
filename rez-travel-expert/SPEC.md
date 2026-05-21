# REZ Travel Expert - SPEC.md

**Version:** 1.0.0
**Port:** 3003
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for travel domain. Handles destinations, itineraries, bookings, and transportation. Provides personalized travel recommendations and booking assistance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Travel Expert                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Destination Search    → Places, attractions                         │
│  ├── Itinerary Builder     → Day-by-day planning                         │
│  ├── Booking Assistant      → Flights, hotels, activities                 │
│  └── Transportation        → Routes, schedules, pricing                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Travel
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/travel/search` | Search destinations |
| POST | `/api/travel/itinerary` | Build itinerary |
| POST | `/api/travel/book` | Book travel |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |
| GET | `/health/detailed` | Detailed health check |

---

## Dependencies

```json
{
  "express": "^4.18.2",
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
| REZ Intent Graph | Read | Travel intent signals |
| RABTUL Booking | Write | Reservation booking |
| REZ Search Service | Read | Destination search |

---

## Status

- [x] Service foundation
- [x] Destination search
- [x] Itinerary building
- [x] Booking assistance
- [ ] Transportation integration
