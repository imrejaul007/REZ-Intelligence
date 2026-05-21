# REZ Cohort Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Analytics

---

## Overview

User cohort analysis service that segments users based on shared characteristics and behaviors. Enables cohort-based retention analysis, behavioral clustering, and targeted campaign targeting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Cohort Service                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Analysis Types:                                                           │
│  ├── Retention Cohorts  → Users grouped by acquisition date                │
│  ├── Behavioral Cohorts → Users grouped by behavior patterns                │
│  ├── Value Cohorts      → Users grouped by LTV/risk                        │
│  └── Custom Cohorts     → User-defined segmentations                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cohort Types

| Type | Definition | Use Case |
|------|------------|----------|
| `retention` | Signup date | Retention curves |
| `behavioral` | Action patterns | Targeted campaigns |
| `value` | LTV/RFM scores | VIP identification |
| `engagement` | Activity level | Re-engagement |

---

## API Endpoints

### Cohorts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cohorts` | List all cohorts |
| POST | `/api/cohorts` | Create cohort |
| GET | `/api/cohorts/:id` | Get cohort details |
| PUT | `/api/cohorts/:id` | Update cohort |
| DELETE | `/api/cohorts/:id` | Delete cohort |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cohorts/:id/retention` | Retention analysis |
| GET | `/api/cohorts/:id/users` | List cohort users |
| POST | `/api/cohorts/:id/export` | Export cohort data |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5"
}
```

---

## Data Models

### Cohort
```
{
  cohortId: string
  name: string
  type: 'retention' | 'behavioral' | 'value' | 'engagement' | 'custom'
  definition: {
    criteria: object
    timeRange?: { start: Date, end: Date }
  }
  size: number
  createdAt: Date
  updatedAt: Date
}
```

### CohortUser
```
{
  userId: string
  cohortId: string
  joinedAt: Date
  metadata: object
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Unified Profile | Read | User data |
| REZ Signal Aggregator | Read | Behavioral signals |
| REZ Predictive Engine | Read | Value scores |
| REZ Care Service | Write | Segment-based outreach |

---

## Status

- [x] Service foundation
- [ ] Cohort CRUD
- [ ] Retention analysis
- [ ] Behavioral clustering
- [ ] Export functionality
