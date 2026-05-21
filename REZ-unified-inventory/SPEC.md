# REZ Unified Inventory - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Inventory

---

## Overview

Cross-platform inventory management service. Provides unified inventory view across all REZ platforms with real-time updates and stock optimization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Unified Inventory                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Unified View     → Single source of truth for inventory             │
│  ├── Real-time Updates → Live stock changes across platforms             │
│  ├── Stock Allocation → Reserve inventory for orders                     │
│  └── Multi-location  → Location-based inventory management               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/:sku` | Get inventory |
| POST | `/api/inventory/:sku/allocate` | Allocate stock |
| POST | `/api/inventory/:sku/release` | Release allocation |

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations/:locationId/inventory` | Location inventory |
| POST | `/api/transfer` | Transfer between locations |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.10"
}
```

---

## Status

- [x] Service foundation
- [ ] Unified inventory view
- [ ] Real-time updates
- [ ] Stock allocation
- [ ] Multi-location support
