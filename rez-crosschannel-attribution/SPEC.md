# REZ Cross-Channel Attribution - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Attribution

---

## Overview

Cross-channel attribution tracking and analytics service. Tracks user journeys across multiple touchpoints and channels to attribute conversions accurately.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Cross-Channel Attribution                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Attribution Models:                                                       │
│  ├── First Touch     → All credit to first interaction                    │
│  ├── Last Touch     → All credit to last interaction                     │
│  ├── Linear         → Equal credit across touchpoints                    │
│  ├── Time Decay     → More weight to recent interactions                 │
│  ├── Position Based → Weighted first/last with middle                    │
│  └── Data Driven    → ML-based credit distribution                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "winston": "^3.11.0",
  "zod": "^3.22.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-signal-aggregator | Read | Channel data |
| REZ-analytics | Write | Attribution reports |
| REZ-marketing | Read | Campaign data |

---

## Status

- [x] Service foundation
- [ ] Touchpoint tracking
- [ ] Attribution models
- [ ] Report generation
- [ ] Channel analysis
