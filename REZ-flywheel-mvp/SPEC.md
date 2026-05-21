# REZ Flywheel MVP - SPEC.md

**Version:** 1.0.0
**Port:** 4101
**Company:** REZ-Intelligence
**Category:** Growth

---

## Overview

QR scan to reorder conversion tracking service. Implements a customer flywheel: Discovery (QR scan) → Conversion (Order) → Retention (Reorder Nudge) → Expansion (More orders).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Flywheel MVP                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Stages:                                                                   │
│  1. QR Scan → Discovery & awareness                                        │
│  2. Order → First purchase conversion                                      │
│  3. Reorder Nudge → Timed push notifications                              │
│  4. Reorder Click → Engagement                                             │
│  5. Reorder Convert → Loyalty loop closed                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Scoring:                                                                  │
│  Recency (40pts) + Frequency (30pts) + Value (30pts) = Reorder Score      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qr-scan` | Record QR scan event |
| POST | `/api/order` | Record order event |

### Nudges
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/nudge/trigger` | Trigger reorder nudges |
| POST | `/api/nudge/click` | Record nudge click |
| POST | `/api/nudge/convert` | Record nudge conversion |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Flywheel health & KPIs |

---

## Data Models

### User
```
{
  userId: string (unique)
  phone?: string
  name?: string
  createdAt: Date
  lastActive: Date
}
```

### Merchant
```
{
  merchantId: string (unique)
  name?: string
  category?: string
  location?: string
  createdAt: Date
}
```

### Event
```
{
  type: 'qr_scan' | 'browse' | 'search' | 'order' | 'reorder_nudge' | 'reorder_click' | 'reorder_convert'
  userId?: string
  merchantId?: string
  metadata?: Record<string, any>
  timestamp: Date
}
```

### Order
```
{
  orderId: string (unique)
  userId?: string
  merchantId?: string
  items: [{ name, price, quantity }]
  total: number
  status: 'pending' | 'completed' | 'cancelled'
  source: 'direct' | 'reorder_nudge'
  createdAt: Date
}
```

### ReorderProfile
```
{
  userId: string
  merchantId: string
  lastOrderDate?: Date
  orderCount: number
  avgOrderValue?: number
  reorderScore: number (0-100)
  shouldNudge: boolean
  nudged: boolean
  nudgedAt?: Date
  clicked: boolean
  converted: boolean
  updatedAt: Date
}
```

---

## Dependencies

```json
{
  "express": "^4.21.0",
  "mongoose": "^8.5.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "zod": "^3.23.8",
  "winston": "^3.14.0",
  "uuid": "^10.0.0"
}
```

---

## Reorder Score Algorithm

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| Recency | 40 | 1 day=40, 3 days=35, 7 days=25, 14 days=15 |
| Frequency | 30 | 5+ orders=30, 3+=20, 2+=10 |
| Value | 30 | ₹500+=30, ₹300+=20, ₹150+=10 |

**Nudge Triggered:** Score ≥ 60

---

## KPIs

| Metric | Formula | Target |
|--------|---------|--------|
| Nudge Click Rate | Clicks / Nudges Sent | ≥ 8% |
| Nudge Conversion Rate | Conversions / Clicks | ≥ 10% |
| Reorder Attribution | Reorder Orders / Total Orders | Growing |

---

## Status

- [x] QR scan tracking
- [x] Order recording
- [x] Reorder profile scoring
- [x] Nudge triggering
- [x] Click/convert tracking
- [x] Flywheel KPIs
