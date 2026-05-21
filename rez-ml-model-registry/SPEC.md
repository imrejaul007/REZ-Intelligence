# REZ ML Model Registry - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

ML Model Registry Service for the REZ platform. Manages model lifecycle including registration, versioning, deployment, and monitoring. Enables A/B testing and gradual rollouts for ML models.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ ML Model Registry                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Model Lifecycle:                                                         │
│  ├── Register     → Upload model artifacts                                │
│  ├── Version      → Semantic versioning                                   │
│  ├── Stage        → Development → Staging → Production                    │
│  ├── Deploy       → Promote to serving                                    │
│  └── Monitor      → Track performance                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Serving Strategies:                                                      │
│  ├── Shadow Mode  → Test alongside production                             │
│  ├── Canary       → Gradual traffic shift                                │
│  └── Blue/Green   → Instant switch                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Model Stages

| Stage | Description | Traffic % |
|-------|-------------|-----------|
| `development` | Experimental models | 0% |
| `staging` | Validation testing | 0% |
| `production` | Live serving | 100% |
| `archived` | Deprecated | 0% |

---

## API Endpoints

### Models
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/models` | Register new model |
| GET | `/models` | List models |
| GET | `/models/:name` | Get model details |
| PUT | `/models/:name` | Update model metadata |
| DELETE | `/models/:name` | Archive model |

### Versions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models/:name/versions` | List versions |
| GET | `/models/:name/versions/:version` | Get version details |
| POST | `/models/:name/stage` | Update model stage |

### Deployment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/models/:name/deploy` | Deploy to serving |
| GET | `/models/:name/status` | Deployment status |
| POST | `/models/:name/rollback` | Rollback deployment |

---

## Data Models

### Model
```typescript
{
  name: string
  type: 'classification' | 'regression' | 'ranking' | 'nlp'
  framework: 'xgboost' | 'tensorflow' | 'pytorch'
  description: string
  metrics: Record<string, number>
  createdAt: Date
  updatedAt: Date
}
```

### ModelVersion
```typescript
{
  modelName: string
  version: string (semver)
  artifactUrl: string
  stage: 'development' | 'staging' | 'production' | 'archived'
  metrics: Record<string, number>
  createdAt: Date
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "compression": "^1.7.4",
  "morgan": "^1.10.0",
  "joi": "^17.11.0",
  "uuid": "^9.0.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ ML Feature Store | Read | Model features |
| REZ Predictive Engine | Read | Model artifacts |
| REZ Analytics | Write | Monitoring metrics |

---

## Status

- [x] Model registration
- [x] Version management
- [x] Stage transitions
- [x] Deployment endpoints
- [ ] A/B testing
- [ ] Performance monitoring
