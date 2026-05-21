# REZ ML Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

Machine learning inference engine for the REZ platform. Provides low-latency ML predictions for recommendations, rankings, and classifications. Integrates with model registry and feature store.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ ML Engine                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Model Loader     → Load models from registry                        │
│  ├── Feature Fetcher  → Retrieve features from store                     │
│  ├── Inference Engine → Execute predictions                              │
│  └── Result Cache     → Redis caching for predictions                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Inference
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict/:modelName` | Run prediction |
| POST | `/api/predict/batch` | Batch predictions |
| GET | `/api/models` | List available models |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.10",
  "cors": "^2.8.5"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ ML Model Registry | Read | Model artifacts |
| REZ ML Feature Store | Read | Feature data |
| REZ Intent Graph | Read | Intent predictions |

---

## Status

- [x] Service foundation
- [x] Model loading
- [x] Feature fetching
- [x] Inference engine
- [ ] Batch predictions
