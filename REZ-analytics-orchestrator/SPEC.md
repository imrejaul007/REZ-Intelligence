# REZ Analytics Orchestrator - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Analytics

---

## Overview

Coordinates analytics services across the REZ platform. Provides unified access to analytics endpoints, aggregates data from multiple sources, and orchestrates complex analytics workflows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               REZ Analytics Orchestrator                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Service Coordination  → Coordinate analytics services                │
│  ├── Query Routing        → Route to appropriate service                 │
│  ├── Data Aggregation     → Combine results from multiple sources         │
│  └── Caching              → Cache frequent queries                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

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

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Analytics | Read/Write | Analytics data |
| REZ Insights | Read | Insight data |
| All Company Services | Read | Cross-company analytics |

---

## Status

- [x] Service foundation
- [ ] Query routing
- [ ] Data aggregation
- [ ] Result caching
- [ ] Workflow orchestration
