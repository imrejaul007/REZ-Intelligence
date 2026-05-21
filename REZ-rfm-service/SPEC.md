# REZ RFM Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Customer Analytics

---

## Overview

RFM (Recency, Frequency, Monetary) Customer Segmentation Service. Segments customers based on purchase behavior to enable targeted marketing and personalized campaigns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ RFM Service                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  RFM Scoring:                                                             │
│  ├── Recency Score   → R (1-5) - Days since last purchase              │
│  ├── Frequency Score → F (1-5) - Purchase count in period              │
│  └── Monetary Score  → M (1-5) - Total spend value                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Segment Types:                                                           │
│  ├── Champions      → High all 3 scores                                │
│  ├── Loyal         → High F, good M                                   │
│  ├── Potential     → Low R, high F                                    │
│  ├── At Risk       → Low R, high F, declining M                       │
│  └── Lost          → Low all 3 scores                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfm/health` | Health check |
| GET | `/api/rfm/` | Service info |

### Customer Segments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfm/customer/:userId` | Get customer RFM scores |
| POST | `/api/rfm/customer/batch` | Batch segment lookup |

### Segment Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfm/segments` | List all segments |
| GET | `/api/rfm/segments/:id/customers` | Customers in segment |
| GET | `/api/rfm/segments/:id/analytics` | Segment analytics |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rfm/campaigns` | Create segment campaign |
| GET | `/api/rfm/campaigns/:id` | Get campaign status |

---

## RFM Scoring Matrix

| Score | Recency (days) | Frequency (orders) | Monetary (₹) |
|-------|---------------|-------------------|--------------|
| 5 | 0-30 | 10+ | 10000+ |
| 4 | 31-60 | 7-9 | 5000-9999 |
| 3 | 61-90 | 4-6 | 2000-4999 |
| 2 | 91-120 | 2-3 | 500-1999 |
| 1 | 120+ | 1 | <500 |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "winston": "^3.11.0",
  "zod": "^3.22.4",
  "express-rate-limit": "^8.5.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-orders | Read | Purchase history |
| REZ-payments | Read | Transaction data |
| REZ-campaigns | Write | Campaign triggers |

---

## Status

- [x] Service foundation
- [x] RFM scoring engine
- [x] Segment calculation
- [ ] Segment analytics
- [ ] Campaign integration
- [ ] Real-time updates
