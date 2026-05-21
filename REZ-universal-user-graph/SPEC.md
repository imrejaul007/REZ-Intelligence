# REZ Universal User Graph - SPEC.md

**Version:** 1.0.0
**Port:** 4055
**Company:** REZ-Intelligence
**Category:** Identity

---

## Overview

Combines identity and behavioral data across all REZ apps into a unified user graph. Provides cross-platform identity resolution, user linking, and lifetime value tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Universal User Graph                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── User Graph        → MongoDB document store with graph queries        │
│  ├── Identity Resolver → Deterministic + probabilistic resolution          │
│  ├── Career Graph      → Professional/career data extension               │
│  └── LTV Tracker       → Lifetime value calculations                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId` | Get universal user |
| POST | `/api/v1/users` | Create/update user |
| PATCH | `/api/v1/users/:userId/profile` | Update profile |
| POST | `/api/v1/users/search` | Search users |

### Identity Resolution
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/lookup/:type/:value` | Lookup by phone/email |
| POST | `/api/v1/identity/resolve` | Resolve with confidence |
| POST | `/api/v1/identity/merge` | Merge two users |

### Identity Linking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users/:userId/links` | Link app identity |
| DELETE | `/api/v1/users/:userId/links/:appId/:appUserId` | Unlink identity |
| GET | `/api/v1/users/:userId/links` | Get linked identities |

### Behavioral & Segments
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/v1/users/:userId/behavioral` | Update behavioral data |
| GET | `/api/v1/users/:userId/segments` | Get user segments |
| GET | `/api/v1/users/:userId/ltv` | Get LTV metrics |
| PATCH | `/api/v1/users/:userId/ltv` | Update LTV metrics |

### Graph Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId/connections` | Get user connections |
| GET | `/api/v1/graph/stats` | Graph statistics |
| POST | `/api/v1/sync/:source` | Sync from external source |

---

## Data Models

### UniversalUser
```
{
  userId: string (unique)
  primaryIdentifier: { type: 'phone' | 'email', value: string }
  profile: { name, avatar, demographics, preferences }
  appLinks: [{ appId, appUserId, linkedAt }]
  behavioral: { engagementScore, lastActive, segments }
  lifetime: { totalValue, orderCount, avgOrderValue }
  createdAt: Date
  updatedAt: Date
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "ioredis": "^5.3.2",
  "mongodb": "^6.3.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Intent Graph | Read | Intent signals |
| REZ Consumer Graph | Read | Neo4j relationships |
| REZ CDP | Read/Write | Profile data |
| RABTUL Wallet | Read | Transaction data |
| REZ Care Service | Read | Support history |

---

## Sync Sources

Valid sources for `/api/v1/sync/:source`:
- `intent-graph` - Intent predictions
- `consumer-graph` - Neo4j relationships
- `cdp` - Customer data platform
- `wallet` - Wallet transactions
- `support` - Support tickets

---

## Status

- [x] Service foundation
- [x] User graph storage
- [x] Identity resolution
- [x] App identity linking
- [x] Career graph extension
- [x] LTV tracking
