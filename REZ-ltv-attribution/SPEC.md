# REZ LTV Attribution - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Attribution

---

## Overview

LTV (Lifetime Value) Attribution service. Tracks and attributes customer lifetime value across acquisition channels and touchpoints.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ LTV Attribution                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── LTV Calculation   → Calculate customer lifetime value               │
│  ├── Channel Attribution → Attribute LTV to channels                     │
│  ├── Cohort Analysis  → LTV by acquisition cohort                         │
│  └── Trend Analysis  → LTV trends over time                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### LTV
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ltv/:userId` | Get customer LTV |
| GET | `/api/ltv/cohorts` | Get cohort LTV |

### Attribution
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attribution/:channel` | Channel LTV attribution |

---

## Dependencies

```json
{
  "express": "^4.18.2"
}
```

---

## Status

- [x] Service foundation
- [ ] LTV calculation
- [ ] Channel attribution
- [ ] Cohort analysis
- [ ] Trend tracking
