# REZ Multi-Location Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce

---

## Overview

Franchise and multi-store management service. Enables merchants to manage multiple locations with unified inventory, orders, and analytics.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Multi-Location Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Location Management → Add and manage locations                        │
│  ├── Inventory Sync   → Unified inventory across locations              │
│  ├── Order Routing    → Route orders to appropriate locations           │
│  ├── Analytics        → Consolidated multi-location analytics             │
│  └── Franchise Support → Franchise-specific configurations               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/locations` | Add location |
| GET | `/api/locations` | List locations |
| GET | `/api/locations/:id` | Get location |
| PATCH | `/api/locations/:id` | Update location |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations/:id/inventory` | Location inventory |
| POST | `/api/sync/inventory` | Sync inventory |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/compare` | Compare locations |
| GET | `/api/analytics/consolidated` | Consolidated view |

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
- [ ] Location management
- [ ] Inventory sync
- [ ] Order routing
- [ ] Analytics
- [ ] Franchise support
