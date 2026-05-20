# REZ Identity Graph - SPEC.md

**Version:** 1.0.0
**Port:** 4050
**Company:** REZ-Intelligence
**Category:** Identity & Profile

---

## Overview

Unified user identity management across all REZ apps. Links user identities from different sources (phone, email, device ID) into a single unified profile with behavior fingerprinting and cross-device resolution.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Identity Graph (4050)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Identity Resolution:                                                       │
│  ├── Phone-based resolution                                               │
│  ├── Email-based resolution                                               │
│  ├── Device ID tracking                                                   │
│  ├── Cross-device linking                                                 │
│  └── Behavior fingerprinting                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data: Identity records, linked accounts, behavior fingerprint             │
│  Models: Identity                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Supported Sources

| Source | Description |
|--------|-------------|
| `rez-app` | Main consumer app |
| `merchant-app` | Merchant app |
| `driver-app` | Driver app |
| `admin-dashboard` | Admin portal |
| `web-app` | Web applications |

---

## Identity Types

| Type | Description | Verified |
|------|-------------|----------|
| `phone` | Phone number | Yes |
| `email` | Email address | Yes |
| `device_id` | Device identifier | No |
| `wallet_id` | Wallet address | No |
| `user_id` | Platform user ID | No |

---

## API Endpoints

### POST /api/identity/resolve

Resolve identity from identifier.

**Request:**
```json
{
  "source": "rez-app",
  "type": "phone",
  "value": "919876543210",
  "profile": {
    "name": "John D."
  },
  "confidence": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "unifiedId": "uid_abc123def456",
  "isNew": false,
  "linkedTo": null
}
```

### GET /api/identity/:unifiedId

Get unified identity details.

**Response:**
```json
{
  "success": true,
  "identity": {
    "unifiedId": "uid_abc123def456",
    "identities": [
      {
        "source": "rez-app",
        "type": "phone",
        "value": "91****3210",
        "verified": true,
        "lastSeen": "2026-05-20T10:30:00Z"
      }
    ],
    "profile": {
      "name": "John D.",
      "phone": "91****3210",
      "kycStatus": "verified",
      "riskLevel": "low"
    },
    "stats": {
      "totalSources": 3,
      "totalTransactions": 45,
      "totalSpend": 12500,
      "avgOrderValue": 278
    }
  }
}
```

### GET /api/identity/find/:type/:value

Find identity by type and value.

**Endpoint:** `GET /api/identity/find/phone/919876543210`

**Response:**
```json
{
  "success": true,
  "unifiedId": "uid_abc123def456",
  "source": "rez-app"
}
```

### POST /api/identity/:unifiedId/link

Link new identity to existing unified ID.

**Request:**
```json
{
  "source": "merchant-app",
  "type": "device_id",
  "value": "device_xyz789",
  "confidence": 0.8
}
```

### POST /api/identity/:targetId/merge

Merge two identities.

**Request:**
```json
{
  "sourceId": "uid_source123"
}
```

### PATCH /api/identity/:unifiedId/profile

Update profile.

**Request:**
```json
{
  "name": "John Updated",
  "kycStatus": "verified",
  "riskLevel": "low"
}
```

### GET /api/identity/:unifiedId/graph

Get identity graph (linked identities).

**Response:**
```json
{
  "success": true,
  "graph": {
    "unifiedId": "uid_abc123",
    "totalLinked": 2,
    "linkedToMe": 1,
    "nodes": [
      { "unifiedId": "uid_abc123", "type": "self", "identities": 3 },
      { "unifiedId": "uid_xyz789", "type": "linked_to", "confidence": 0.9 }
    ]
  }
}
```

### GET /api/identity/stats

Get identity statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalIdentities": 50000,
    "avgSourcesPerIdentity": 1.5,
    "totalLinked": 2500,
    "kycVerified": 15000
  },
  "bySource": [
    { "_id": "rez-app", "count": 45000 },
    { "_id": "merchant-app", "count": 5000 }
  ]
}
```

---

## Data Models

### Identity

```typescript
interface Identity {
  unifiedId: string;                    // Primary key: uid_xxx
  identities: IdentityRecord[];
  linkedTo: LinkedIdentity[];
  profile: {
    primarySource?: string;
    name?: string;
    phone?: string;
    email?: string;
    avatar?: string;
    kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
    riskLevel: 'low' | 'medium' | 'high';
  };
  behaviorFingerprint: {
    ipPatterns: string[];
    userAgents: string[];
    typicalHours: number[];
    avgSessionDuration?: number;
    preferredLocations?: { lat: number; lng: number; weight: number }[];
  };
  stats: {
    totalSources: number;
    firstActivity?: Date;
    lastActivity?: Date;
    totalTransactions: number;
    totalSpend: number;
    avgOrderValue: number;
  };
  flags: {
    isTestUser: boolean;
    isBot: boolean;
    isFamilyAccount: boolean;
    mergedInto?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface IdentityRecord {
  source: AppSource;
  type: IdentityType;
  value: string;
  confidence: number;
  verified: boolean;
  linkedAt: Date;
  lastSeen: Date;
}

interface LinkedIdentity {
  unifiedId: string;
  confidence: number;
  reason?: string;
  linkedAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "helmet": "^7.1.0"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default: 4050) |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis cache |
| `INTERNAL_SERVICE_TOKEN` | Service authentication |
| `ALLOWED_ORIGINS` | CORS origins |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| RABTUL Auth | Read | User verification |
| Signal Aggregator | Write | User activity signals |
| Commerce Graph | Write | Identity graph sync |

---

## Security Features

- Timing-safe token comparison
- CORS restrictions
- Rate limiting
- Request ID tracking
- Structured logging

---

## Status

- [x] Identity resolution
- [x] Cross-device linking
- [x] Profile management
- [x] Identity merging
- [x] Graph traversal
- [x] Statistics
- [x] Behavior fingerprinting
- [ ] Probable match heuristics
- [ ] Device fingerprint clustering
