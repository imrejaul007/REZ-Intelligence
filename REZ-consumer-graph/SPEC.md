# REZ Consumer Graph - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Identity

---

## Overview

Unified consumer identity service using Neo4j graph database. Links consumer data across all REZ platforms including wallet, loyalty, payments, DOOH, referrals, and hotels into a comprehensive 360-degree consumer profile.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Consumer Graph                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Components:                                                          │
│  ├── Consumer Graph    → Neo4j graph storage                               │
│  ├── Identity Resolver → Deterministic + probabilistic matching             │
│  ├── Graph Engine     → Graph traversal & queries                          │
│  ├── Relationship Mapper → Maps cross-platform relationships              │
│  ├── Device Resolver  → Device fingerprint linking                         │
│  └── Cross-Platform Linker → Multi-app identity linking                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Modules:                                                                  │
│  ├── Wallet      │ Payment    │ Loyalty      │ Browsing                    │
│  ├── DOOH        │ Referral   │ Hotel        │ Intent                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Consumer Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/consumers` | Create consumer |
| GET | `/api/consumers/:id` | Get consumer profile |
| PUT | `/api/consumers/:id` | Update consumer |
| DELETE | `/api/consumers/:id` | Delete consumer |

### Identity
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identity/resolve` | Resolve identity |
| POST | `/api/identity/link` | Link accounts |
| POST | `/api/identity/merge` | Merge identities |

### Graph Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph/:consumerId/relationships` | Get relationships |
| GET | `/api/graph/:consumerId/connections` | Get connections |
| POST | `/api/graph/query` | Custom graph query |

---

## Data Models

### Consumer360
```
{
  consumerId: string
  identifiers: {
    email?: string
    phone?: string
    deviceId?: string
  }
  linkedAccounts: [{
    platform: 'wallet' | 'loyalty' | 'dooh' | 'referral' | 'hotel'
    accountId: string
  }]
  relationships: [{
    type: string
    targetId: string
    strength: number
  }]
  profile: {
    demographics: object
    preferences: object
    engagement: object
  }
  createdAt: Date
  updatedAt: Date
}
```

---

## Dependencies

```json
{
  "neo4j-driver": "^5.15.0",
  "ioredis": "^5.3.2",
  "uuid": "^9.0.1",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "axios": "^1.6.5"
}
```

---

## Modules

| Module | Purpose |
|--------|---------|
| WalletModule | Wallet balance, transactions |
| BrowsingModule | Browsing history, preferences |
| LoyaltyModule | Loyalty points, tier status |
| PaymentModule | Payment methods, history |
| DOOHModule | DOOH interactions |
| ReferralModule | Referral tracking |
| HotelModule | Hotel bookings |
| IntentModule | Intent signals |

---

## Identity Resolution

**Deterministic (Weight: 1.0)**
- Email exact match
- Phone exact match
- Account ID match

**Probabilistic (Weight: 0.7)**
- Device graph (Weight: 0.5)
- Behavioral similarity (Weight: 0.3)
- Match threshold: 0.75

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| RABTUL Wallet | Read | Transaction data |
| RABTUL Loyalty | Read | Loyalty data |
| REZ DOOH | Read | Ad interactions |
| REZ Intent | Read | Intent signals |
| REZ Unified Profile | Write | Profile enrichment |

---

## Status

- [x] Consumer graph storage
- [x] Identity resolution
- [x] Cross-platform linking
- [x] Module integrations
- [x] Graph queries
