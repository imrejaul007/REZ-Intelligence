# REZ ETA Prediction - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Predictions

---

## Overview

ETA prediction service with ML model, traffic integration, and accuracy tracking. Predicts delivery times, wait times, and arrival estimates using machine learning and real-time data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ ETA Prediction                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Prediction Types:                                                         │
│  ├── Delivery ETA    → Food/delivery arrival time                       │
│  ├── Wait Time     → Queue/call wait estimates                         │
│  ├── Arrival Time  → Pickup/collection time                           │
│  └── Accuracy Tracking → Model performance monitoring                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ETA Factors

| Factor | Description |
|--------|-------------|
| Distance | Route distance |
| Traffic | Real-time traffic data |
| Time of Day | Rush hour, off-peak |
| Weather | Weather impact |
| Historical | Past delivery times |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^5.3.0",
  "ml-matrix": "^6.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-delivery-intelligence | Read | Delivery context |
| REZ-signal-aggregator | Write | ETA signals |

---

## Status

- [x] Service foundation
- [ ] ML model training
- [ ] Traffic integration
- [ ] ETA prediction
- [ ] Accuracy tracking
