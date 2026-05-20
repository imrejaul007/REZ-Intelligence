# REZ Merchant Brain - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Merchant Intelligence

---

## Overview

AI-powered merchant intelligence service providing forecasting, optimization, and insights for merchant partners. Combines sales data, market trends, and AI to help merchants grow their business.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Merchant Brain                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Forecasting     → Sales and demand prediction                      │
│  ├── Optimization    → Pricing and inventory suggestions                  │
│  ├── Insights        → AI-powered business recommendations                │
│  └── Performance     → Real-time business metrics                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Intelligence Types

| Type | Description |
|------|-------------|
| Sales Forecast | Predict future sales |
| Demand Forecast | Anticipate inventory needs |
| Pricing | Optimal pricing suggestions |
| Marketing | Campaign recommendations |
| Operations | Efficiency improvements |

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
| REZ-demand-forecast | Read | Demand predictions |
| REZ-predictive-engine | Read | ML models |
| REZ-signal-aggregator | Read | Market signals |

---

## Status

- [x] Service foundation
- [ ] Sales forecasting
- [ ] Demand prediction
- [ ] Pricing optimization
- [ ] Business insights
