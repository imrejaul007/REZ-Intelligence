# REZ A/B Testing Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Experimentation

---

## Overview

A/B testing and experimentation service for the REZ platform. Manages experiments, variant assignment, and statistical analysis of test results.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ A/B Testing Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Experiment Management → Create and configure experiments              │
│  ├── Variant Assignment → Random or weighted variant allocation            │
│  ├── Statistical Analysis → Significance testing and results               │
│  └── Multi-armed Bandits → Adaptive allocation for optimization           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Experiments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/experiments` | Create experiment |
| GET | `/api/experiments` | List experiments |
| GET | `/api/experiments/:id` | Get experiment |
| PATCH | `/api/experiments/:id` | Update experiment |
| POST | `/api/experiments/:id/start` | Start experiment |
| POST | `/api/experiments/:id/stop` | Stop experiment |

### Assignment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assign` | Get variant assignment |
| POST | `/api/assign/batch` | Batch assignment |

### Results
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/experiments/:id/results` | Get results |
| POST | `/api/experiments/:id/conversions` | Record conversion |

---

## Dependencies

```json
{
  "express": "^4.21.2",
  "mongoose": "^8.17.2",
  "zod": "^3.23.0",
  "winston": "^3.17.0",
  "uuid": "^14.0.0"
}
```

---

## Status

- [x] Service foundation
- [ ] Experiment management
- [ ] Variant assignment
- [ ] Statistical analysis
- [ ] Bandit allocation
