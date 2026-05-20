# REZ ML Studio - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** ML Development

---

## Overview

Machine learning model development environment for the REZ platform. Provides tools for model training, evaluation, versioning, and deployment of ML models across the ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZ ML Studio                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Model Development   → Train and evaluate ML models                   │
│  ├── Model Versioning    → Track model iterations                         │
│  ├── Feature Engineering → Create and manage features                     │
│  ├── Experiment Tracking → Log training experiments                      │
│  └── Model Registry      → Centralized model storage                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: TBD                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Model Lifecycle

```
Draft → Training → Evaluation → Validation → Deployment → Monitoring → Archived
```

### Model Types

| Type | Use Case |
|------|----------|
| Prediction | Churn, LTV, conversion |
| Recommendation | Products, content |
| Classification | Intent, sentiment |
| Regression | ETA, pricing |
| Ranking | Search, recommendations |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "python-shell": "^5.0.0",
  "cors": "^2.8.5"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-feature-store | Read/Write | Feature access |
| REZ-predictive-engine | Deploy to | Model serving |
| REZ-intent-predictor | Deploy to | Model serving |

---

## Status

- [x] Service foundation
- [ ] Model training pipeline
- [ ] Experiment tracking
- [ ] Model versioning
- [ ] Feature engineering
- [ ] Model registry
- [ ] A/B testing integration
- [ ] AutoML support
