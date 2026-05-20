# REZ Hyperlocal Targeting - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Location Intelligence

---

## Overview

Geofence-based ad targeting service for mall visitors, office commuters, college students, airport travelers, and high footfall zones. Enables precise location-based advertising and promotions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               REZ Hyperlocal Targeting                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Geofence Types:                                                         │
│  ├── Mall       → Shopping center targeting                             │
│  ├── Office    → Business district zones                               │
│  ├── Campus   → College/university areas                               │
│  ├── Airport  → Travel hubs                                           │
│  └── Zones   → Custom polygon geofences                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/targeting/*                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Geofence Categories

| Category | Description |
|----------|-------------|
| Mall | Shopping centers, retail stores |
| Office | Business parks, corporate zones |
| Campus | Universities, colleges |
| Airport | Airports, train stations |
| Custom | User-defined polygons |

---

## Targeting Features

| Feature | Description |
|---------|-------------|
| Dwell Time | Target users who stay in zone |
| Visit Frequency | Target repeat visitors |
| Time of Day | Morning/evening commuters |
| Cross-Zone | Users visiting multiple zones |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "zod": "^3.22.4",
  "uuid": "^9.0.1"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-targeting-engine | Write | Ad targeting |
| REZ-dooh-intelligence | Read | DOOH locations |

---

## Status

- [x] Service foundation
- [ ] Geofence management
- [ ] Zone targeting
- [ ] Dwell time tracking
- [ ] Cross-zone attribution
- [ ] Privacy compliance
