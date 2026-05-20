# REZ Knowledge Graph - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Knowledge Management

---

## Overview

Semantic knowledge graph connecting merchants, products, users, and locations. Provides intelligent relationship discovery, entity resolution, and knowledge-based recommendations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Knowledge Graph                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Entity Types:                                                             │
│  ├── Merchants      → Restaurant, retail, services                      │
│  ├── Products       → Items, deals, bundles                             │
│  ├── Users          → Customers, preferences                             │
│  └── Locations      → Areas, landmarks, zones                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/graph/*, /api/entity/*                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Graph Features

| Feature | Description |
|---------|-------------|
| Entity Linking | Connect related entities |
| Path Discovery | Find relationships between entities |
| Similarity Search | Find similar merchants/products |
| Recommendation | Knowledge-based suggestions |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-recommendation-engine | Read | Graph-based recs |
| REZ-signal-aggregator | Write | Entity signals |
| REZ-intent-predictor | Read | Intent context |

---

## Status

- [x] Service foundation
- [ ] Entity schema
- [ ] Relationship types
- [ ] Path algorithms
- [ ] Similarity scoring
