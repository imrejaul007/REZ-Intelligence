# REZ Customer Intelligence Hub - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Customer Intelligence

---

## Overview

Unified customer intelligence hub that aggregates all customer data for commerce insights. Combines behavioral, transactional, and engagement data into comprehensive customer profiles.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            REZ Customer Intelligence Hub                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Sources:                                                            │
│  ├── Behavioral     → Page views, clicks, searches                      │
│  ├── Transactional  → Orders, payments, refunds                        │
│  ├── Engagement    → Push opens, email clicks, reviews                 │
│  └── Third-Party   → Demographics, preferences                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/customer/*                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Customer Insights

| Insight | Description |
|---------|-------------|
| Lifetime Value | Total revenue from customer |
| Propensity Scores | Likelihood to convert/churn |
| Segment Membership | Active segment classifications |
| Engagement Score | Overall engagement level |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "axios": "^1.6.2",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-unified-profile | Read | Base profile |
| REZ-signal-aggregator | Read | Behavioral signals |
| REZ-predictive-engine | Read | Propensity scores |

---

## Status

- [x] Service foundation
- [ ] Data aggregation
- [ ] Customer scoring
- [ ] Segment enrichment
- [ ] Real-time updates
