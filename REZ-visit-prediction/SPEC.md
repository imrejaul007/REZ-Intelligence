# REZ Visit Prediction - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Predictions

---

## Overview

ML service for predicting user visit patterns and return likelihood. Predicts when users are likely to return to merchants, enabling proactive retention and re-engagement strategies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Visit Prediction                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Prediction Types:                                                         │
│  ├── Return Prediction → When user will return                         │
│  ├── Visit Likelihood → Probability of next visit                       │
│  ├── Churn Risk      → Users likely to churn                          │
│  └── Engagement Score → Overall engagement level                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prediction Models

| Model | Description |
|-------|-------------|
| Return Time | Days until predicted return |
| Return Probability | Likelihood of return (0-1) |
| Churn Score | Risk of not returning |
| Engagement Level | Low/Medium/High |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-predictive-engine | Read | ML models |
| REZ-signal-aggregator | Read | Behavioral signals |

---

## Status

- [x] Service foundation
- [ ] Return prediction
- [ ] Churn scoring
- [ ] Engagement analysis
- [ ] Real-time predictions
