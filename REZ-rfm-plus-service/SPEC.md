# REZ RFM Plus Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Customer Analytics

---

## Overview

RFM++ advanced customer segmentation service. Extends standard RFM (Recency, Frequency, Monetary) analysis with additional behavioral dimensions for more nuanced customer understanding.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ RFM Plus Service                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  RFM+ Dimensions:                                                         │
│  ├── Recency       → Days since last purchase                           │
│  ├── Frequency     → Number of purchases in period                      │
│  ├── Monetary      → Total spend value                                  │
│  ├── Engagement    → Non-purchase interactions                          │
│  ├── Diversity     → Category/sku breadth                               │
│  └── Trend         → Purchase velocity changes                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-orders | Read | Purchase data |
| REZ-customer-intelligence | Write | Customer segments |

---

## Status

- [x] Service foundation
- [ ] RFM+ segmentation
- [ ] Advanced dimensions
- [ ] Segment analytics
- [ ] Trend detection
