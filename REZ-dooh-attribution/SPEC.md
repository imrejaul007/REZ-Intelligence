# REZ DOOH Attribution - SPEC.md

**Version:** 1.0.0
**Port:** 4081
**Company:** REZ-Intelligence
**Category:** Attribution

---

## Overview

DOOH (Digital Out of Home) attribution tracking service. Tracks DOOH impressions through to conversions using multiple attribution models and calculates screen-level metrics.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ DOOH Attribution                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Attribution Models:                                                       │
│  ├── First Touch    → All credit to first touchpoint                       │
│  ├── Last Touch    → All credit to last touchpoint                       │
│  ├── Linear        → Equal credit across touchpoints                      │
│  ├── Time Decay    → More credit to recent touches                       │
│  ├── Position Based → 40% first, 40% last, 20% middle                    │
│  └── Data Driven   → ML-based engagement attribution                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Touchpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/touchpoints` | Record DOOH touchpoint |
| GET | `/api/touchpoints/:id` | Get touchpoint |
| GET | `/api/touchpoints/user/:userId` | User touchpoints |
| GET | `/api/touchpoints/screen/:screenId` | Screen touchpoints |

### Conversions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/conversions` | Record conversion |
| GET | `/api/conversions/:id` | Get conversion attribution |

### Attribution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attribute` | Attribute with models |
| GET | `/api/attribution/models` | List attribution models |
| GET | `/api/attribution/windows` | Attribution windows |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/screen/:screenId` | Screen metrics |
| POST | `/api/metrics/aggregate` | Aggregated metrics |

### Footfall
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/footfall/attribute` | Attribute footfall |

---

## Attribution Windows

| Window | Duration | Use Case |
|--------|----------|----------|
| View-through | 1-7 days | After DOOH exposure |
| Click-through | 24 hours | Immediate actions |
| Footfall | 30-60 min | Physical visits |

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
| REZ-dooh-service | Read | Screen data |
| REZ-attribution | Write | Attribution data |
| REZ-analytics | Write | Metrics |

---

## Status

- [x] Service foundation
- [x] Touchpoint tracking
- [x] Conversion recording
- [x] Attribution models
- [ ] DOOH-specific metrics
- [ ] Footfall attribution
- [ ] Data-driven model
