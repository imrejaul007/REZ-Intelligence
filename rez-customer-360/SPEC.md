# REZ Customer 360 - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Customer Intelligence

---

## Overview

Customer 360 view module providing unified profiles, interaction history, lifetime value, and preferences. Creates a comprehensive view of each customer across all touchpoints.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Customer 360                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Profile Components:                                                       │
│  ├── Demographics    → Age, gender, location                             │
│  ├── Transactions   → Purchase history, value                            │
│  ├── Engagement    → App usage, interactions                           │
│  ├── Preferences   → Product/service preferences                        │
│  └── Predictions  → LTV, churn risk, propensity                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Profile Data

| Component | Data Points |
|-----------|------------|
| Demographics | Age, gender, location, device |
| Transactions | Orders, value, frequency |
| Engagement | Sessions, features used |
| Preferences | Categories, brands, price |
| Predictions | LTV, churn, conversion |

---

## Dependencies

```json
{
  "typescript": "^5.3.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-unified-profile | Read | Base profile |
| REZ-predictive-engine | Read | Predictions |
| REZ-signal-aggregator | Read | Interactions |

---

## Status

- [x] Service foundation
- [ ] Unified profiles
- [ ] Interaction history
- [ ] Lifetime value
- [ ] Preferences
- [ ] Predictions
