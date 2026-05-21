# REZ ML Production - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

Production ML service running real machine learning models for predictions. Handles model training and serving for churn prediction and LTV estimation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ ML Production                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Models:                                                                  │
│  ├── Churn Model    → Customer churn probability                        │
│  └── LTV Model     → Customer lifetime value prediction                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Training:                                                               │
│  └── Periodic retraining via cron jobs                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "python": ">=3.9"
}
```

---

## Status

- [x] Service foundation
- [ ] Churn model
- [ ] LTV model
- [ ] Model training
- [ ] Prediction API
