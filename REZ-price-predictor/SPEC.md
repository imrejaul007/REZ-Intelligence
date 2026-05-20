# REZ Price Predictor - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Pricing Intelligence

---

## Overview

Dynamic pricing intelligence service for restaurants. Predicts optimal prices based on demand, competition, time of day, and other factors to maximize revenue.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Price Predictor                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pricing Factors:                                                         │
│  ├── Demand        → Current order volume                                │
│  ├── Competition   → Nearby restaurant prices                            │
│  ├── Time        → Peak/off-peak hours                                  │
│  ├── Weather     → Weather-based demand shifts                         │
│  └── Inventory   → Ingredient availability                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/pricing/*                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Strategies

| Strategy | Description |
|----------|-------------|
| Surge Pricing | Peak demand markup |
| Competitive | Match nearby prices |
| Value | Lower than competition |
| Premium | Higher for quality |
| Dynamic | Real-time optimization |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-signal-aggregator | Read | Demand signals |
| REZ-demand-forecast | Read | Demand predictions |

---

## Status

- [x] Service foundation
- [ ] Demand forecasting
- [ ] Competition analysis
- [ ] Price optimization
- [ ] Real-time pricing
