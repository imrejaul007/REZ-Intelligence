# REZ Identity Bridge - SPEC.md

**Version:** 1.0.0
**Port:** 4092
**Company:** REZ-Intelligence
**Category:** Identity & Profile

---

## Overview

Links users across all REZ apps via unified identity resolution. Resolves user identity across multiple apps using phone, email, and device IDs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Identity Bridge (4092)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Identity Resolution:                                                       │
│  ├── Phone-based resolution                                               │
│  ├── Email-based resolution                                               │
│  ├── Device ID tracking                                                   │
│  └── Cross-app account linking                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Connected Services:                                                       │
│  ├── Identity Graph (:4050)                                               │
│  ├── Consumer Graph                                                       │
│  └── CDP                                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Identity Resolution

Resolve user identity from multiple identifiers.

**Supported Identifiers:**
- Phone number (5-15 digits)
- Email address
- Device ID

### Cross-App Linking

Link accounts across different apps under unified identity.

**Supported Apps:**
- REZ App
- Merchant App
- Driver App
- Admin Dashboard

---

## API Endpoints

### POST /resolve

Resolve identity from identifiers.

**Request:**
```json
{
  "phone": "919876543210",
  "email": "user@example.com",
  "deviceId": "device_abc123",
  "appId": "rez-consumer",
  "sourceUserId": "user_123"
}
```

**Response (new identity):**
```json
{
  "unifiedId": "uid_abc123def456",
  "confidence": 1,
  "source": "new",
  "linkedAccounts": [
    {
      "appId": "rez-consumer",
      "userId": "user_123",
      "linkedAt": "2026-05-20T10:30:00Z"
    }
  ],
  "profile": {
    "phone": "919876543210",
    "email": "user@example.com"
  }
}
```

**Response (resolved):**
```json
{
  "unifiedId": "uid_existing123",
  "confidence": 0.95,
  "source": "resolved",
  "linkedAccounts": [...],
  "profile": {...}
}
```

### GET /:unifiedId

Get unified identity details.

**Response:**
```json
{
  "unifiedId": "uid_abc123",
  "profile": {
    "phone": "919876543210",
    "email": "user@example.com",
    "name": "John D."
  },
  "linkedAccounts": [
    { "appId": "rez-consumer", "userId": "user_123" },
    { "appId": "merchant-app", "userId": "merchant_456" }
  ],
  "stats": {
    "totalApps": 2,
    "totalOrders": 45,
    "totalSpend": 12500
  },
  "status": "active"
}
```

### POST /:unifiedId/link

Link additional account.

**Request:**
```json
{
  "appId": "driver-app",
  "userId": "driver_789",
  "identifiers": {
    "deviceId": "driver_device_xyz"
  }
}
```

### GET /

List identities (admin).

**Query:** `?limit=100`

---

## Data Models

### UnifiedIdentity

```typescript
interface UnifiedIdentity {
  unifiedId: string;              // Primary key: uid_xxx
  primaryIdentifier: 'phone' | 'email';
  primaryValue?: string;
  linkedAccounts: LinkedAccount[];
  profile: {
    phone?: string;
    email?: string;
    name?: string;
    devices: string[];
    preferences?: Record<string, any>;
  };
  stats: {
    totalApps: number;
    totalOrders: number;
    totalSpend: number;
    firstSeen?: Date;
    lastSeen?: Date;
  };
  status: 'active' | 'merged' | 'flagged';
  createdAt: Date;
  updatedAt?: Date;
}

interface LinkedAccount {
  appId: string;
  userId: string;
  identifiers: Record<string, any>;
  linkedAt: Date;
  confidence: number;
}
```

---

## Dependencies

```json
{
  "express": "^4.21.0",
  "mongoose": "^8.5.0",
  "axios": "^1.7.0",
  "zod": "^3.23.8",
  "helmet": "^7.1.0",
  "uuid": "^10.0.0"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default: 4092) |
| `MONGODB_URI` | MongoDB connection |
| `INTERNAL_SERVICE_TOKEN` | Service authentication |
| `IDENTITY_GRAPH_URL` | Identity Graph service URL |
| `CONSUMER_GRAPH_URL` | Consumer Graph URL |
| `CDP_URL` | CDP service URL |
| `ALLOWED_ORIGINS` | CORS origins |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Identity Graph | Query | Identity resolution |
| Consumer Graph | Query | Consumer identity |
| CDP | Query | Profile data |

---

## Status

- [x] Identity resolution
- [x] Cross-app linking
- [x] Profile aggregation
- [x] Stats tracking
- [ ] Real-time sync
- [ ] Identity merge
