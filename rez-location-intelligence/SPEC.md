# REZ Location Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Location Analytics

---

## Overview

Location intelligence service for user behavior analysis. Tracks visits, patterns, segments, and provides footfall analytics for the REZ ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Location Intelligence                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                           │
│  ├── Visit Tracking    → Track user location visits                      │
│  ├── Pattern Analysis  → Analyze movement patterns                        │
│  ├── Geofencing      → Zone-based tracking                             │
│  ├── Footfall Analytics → Physical traffic metrics                       │
│  └── Location Segments → Location-based user segments                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Visits
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/visits` | Record a visit |
| GET | `/api/visits/user/:userId` | User visit history |
| GET | `/api/visits/location/:locationId` | Location visits |

### Patterns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patterns/user/:userId` | User movement patterns |
| GET | `/api/patterns/location/:locationId` | Location patterns |

### Footfall
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/footfall/:locationId` | Footfall metrics |
| GET | `/api/footfall/compare` | Compare locations |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "winston": "^3.11.0",
  "zod": "^3.22.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-identity-graph | Read | User data |
| REZ-merchant-intelligence | Write | Location analytics |
| REZ-signal-aggregator | Write | Location signals |

---

## Status

- [x] Service foundation
- [ ] Visit tracking
- [ ] Pattern analysis
- [ ] Geofencing
- [ ] Footfall analytics
- [ ] Location segmentation
