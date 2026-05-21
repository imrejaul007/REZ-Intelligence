# REZ Merchant Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Merchant Analytics

---

## Overview

Merchant-facing dashboard with customer segments, predictions, recommendations, and performance metrics. Provides merchants with actionable insights about their customers and business performance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Merchant Intelligence                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Dashboard Features:                                                      │
│  ├── Customer Segments  → Segment-based views                           │
│  ├── Predictions      → Churn, LTV, revisit scores                   │
│  ├── Recommendations  → AI-powered suggestions                         │
│  └── Performance Metrics → KPIs, trends, comparisons                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers |
| GET | `/api/customers/:id` | Customer details |
| GET | `/api/customers/:id/segments` | Customer segments |

### Predictions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/predictions/churn/:merchantId` | Churn predictions |
| GET | `/api/predictions/ltv/:merchantId` | LTV predictions |

### Recommendations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations/:merchantId` | AI recommendations |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/:merchantId` | Performance metrics |
| GET | `/api/metrics/:merchantId/trends` | Trend data |

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
| REZ-predictive-engine | Read | ML predictions |
| REZ-identity-graph | Read | Customer data |
| REZ-recommendations | Read | AI suggestions |

---

## Status

- [x] Service foundation
- [ ] Customer dashboard
- [ ] Prediction display
- [ ] Recommendation engine
- [ ] Metrics visualization
