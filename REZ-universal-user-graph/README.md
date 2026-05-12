# REZ Universal User Graph

A unified identity and user data service that combines user information from all REZ platform apps and services into a single, authoritative user graph.

## Overview

The Universal User Graph serves as the central identity resolution layer for the REZ Agent OS, combining data from:

- **Intent Graph** (Port 4050) - User intent and search behavior
- **Consumer Graph** (Port 4051) - Consumer app user data
- **CDP** (Port 3005) - Customer Data Platform profiles
- **Wallet Service** (Port 4002) - Financial and wallet identities
- **Support Service** (Port 4003) - Support history and profiles
- **All App Identities** - Consumer, Merchant, Hotel, Do-App, AdBazaar, Rendez

## Features

- **Identity Resolution** - Resolve users across multiple identifiers (phone, email, device ID)
- **User Linking** - Link app-specific user IDs to universal user profiles
- **Data Enrichment** - Fetch and merge data from external sources
- **Behavioral Analysis** - Track engagement patterns and scores
- **LTV Calculation** - Lifetime value metrics and churn risk
- **Graph Queries** - Find user connections and relationships
- **User Merging** - Merge duplicate user profiles

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Set up MongoDB and Redis connections

# Start the service
npm start
```

## API Endpoints

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId` | Get user by ID |
| GET | `/api/v1/users/lookup/:type/:value` | Lookup by phone/email |
| POST | `/api/v1/users/search` | Search users with filters |
| POST | `/api/v1/users` | Create/update user |
| PATCH | `/api/v1/users/:userId/profile` | Update user profile |

### Identity Linking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users/:userId/links` | Link app identity |
| DELETE | `/api/v1/users/:userId/links/:appId/:appUserId` | Unlink identity |
| GET | `/api/v1/users/:userId/links` | Get all linked identities |

### Identity Resolution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/identity/resolve` | Resolve identity with confidence |
| POST | `/api/v1/identity/merge` | Merge two users |

### Behavioral & Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/v1/users/:userId/behavioral` | Update behavioral data |
| GET | `/api/v1/users/:userId/segments` | Get user segments |

### LTV & Lifetime

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId/ltv` | Get LTV metrics |
| PATCH | `/api/v1/users/:userId/ltv` | Update LTV metrics |

### Graph Queries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId/connections` | Get user connections |
| GET | `/api/v1/graph/stats` | Get graph statistics |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/:source` | Sync data from external source |

## User Schema

```javascript
{
  id: "u_123",                    // Universal user ID
  phone: "+1234567890",            // Primary phone
  email: "user@example.com",       // Primary email
  apps: [                          // Linked app identities
    { appId: "consumer", userId: "c_123", linkedAt: "..." },
    { appId: "merchant", userId: "m_456", linkedAt: "..." }
  ],
  profile: {
    name: { first: "John", last: "Doe", display: "John D." },
    avatar: "https://...",
    segments: ["premium", "active"],
    tags: ["vip", "beta-tester"],
    preferences: { notifications: true }
  },
  behavioral: {
    frequency: { daily: 5, weekly: 25, monthly: 100 },
    preferences: { category: "electronics" },
    patterns: {
      peakHours: [10, 11, 14, 15],
      preferredCategories: ["electronics", "fashion"],
      avgSessionDuration: 300,
      deviceTypes: ["mobile", "tablet"]
    },
    engagementScore: 85
  },
  financial: {
    walletBalance: 1500.00,
    creditScore: 750,
    riskTier: "low",
    totalSpent: 5000,
    totalOrders: 25
  },
  lifetime: {
    LTV: 5000,
    churnRisk: "low",
    engagementScore: 90,
    firstSeen: "2024-01-01T00:00:00Z",
    lastSeen: "2024-06-15T12:30:00Z",
    daysActive: 180
  },
  connections: [
    { targetUserId: "u_789", type: "family", strength: 0.9 }
  ],
  metadata: {
    createdVia: "signup",
    lastSyncFrom: { "intent-graph": "2024-06-15T12:00:00Z" }
  }
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4055 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-universal-user-graph | MongoDB connection |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `INTENT_GRAPH_URL` | http://localhost:4050 | Intent Graph service |
| `CONSUMER_GRAPH_URL` | http://localhost:4051 | Consumer Graph service |
| `CDP_URL` | http://localhost:3005 | CDP service |
| `WALLET_SERVICE_URL` | http://localhost:4002 | Wallet service |
| `SUPPORT_SERVICE_URL` | http://localhost:4003 | Support service |
| `GRAPH_MERGE_STRATEGY` | weighted | Merge strategy (weighted/latest/authoritative) |
| `IDENTITY_CONFIDENCE_THRESHOLD` | 0.85 | Minimum confidence for identity resolution |
| `CACHE_TTL_SECONDS` | 300 | Redis cache TTL |
| `INTERNAL_SERVICE_TOKENS_JSON` | {} | Service authentication tokens |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Universal User Graph (4055)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │  User Graph     │  │  Identity       │  │  API Routes     │   │
│  │  - CRUD         │  │  Resolver       │  │  - REST API     │   │
│  │  - Search       │  │  - Phone        │  │  - Auth         │   │
│  │  - Stats        │  │  - Email        │  │  - Validation   │   │
│  │  - Merge        │  │  - Device       │  │                 │   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │
│           │                      │                      │           │
│  ┌────────▼──────────────────────▼──────────────────────▼────────┐│
│  │                     Data Layer                                 ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            ││
│  │  │  MongoDB    │  │   Redis     │  │  External   │            ││
│  │  │  - Users    │  │  - Cache    │  │  Services   │            ││
│  │  │  - Index    │  │  - Rate     │  │  - CDP      │            ││
│  │  │  - Audit    │  │  - Locks    │  │  - Intent   │            ││
│  │  └─────────────┘  └─────────────┘  │  - Wallet   │            ││
│  │                                    │  - Support   │            ││
│  │                                    └─────────────┘            ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
node --test --experimental-test-coverage src/**/*.test.js
```

## Service-to-Service Communication

All internal endpoints require the `X-Internal-Token` header with a valid service token:

```bash
curl -X POST http://localhost:4055/api/v1/users \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{"phone": "+1234567890", "profile": {...}}'
```

## License

Internal use only - REZ Platform
