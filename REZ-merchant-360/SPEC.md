# REZ Merchant 360 - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Merchant Intelligence

---

## Overview

Unified merchant identity service for REZ Commerce OS. Provides a single view of each merchant across all platforms with GraphQL API for complex queries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Merchant 360                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Merchant Identity    → Unified merchant profiles                       │
│  ├── GraphQL API        → Complex relationship queries                    │
│  ├── Multi-Platform View → Cross-channel merchant data                  │
│  └── Business Intelligence → Performance analytics                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## GraphQL Schema

```graphql
type Merchant {
  id: ID!
  name: String!
  verticals: [Vertical!]!
  locations: [Location!]!
  metrics: MerchantMetrics!
  relationships: [MerchantRelationship!]!
}
```

---

## Dependencies

```json
{
  "@apollo/server": "^4.10.0",
  "graphql": "^16.8.1",
  "axios": "^1.6.7",
  "uuid": "^9.0.1",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-merchant-intelligence | Read | Merchant data |
| RABTUL-catalog-service | Read | Product data |

---

## Status

- [x] Service foundation
- [x] GraphQL API
- [ ] Merchant profiles
- [ ] Relationship mapping
- [ ] Business analytics
