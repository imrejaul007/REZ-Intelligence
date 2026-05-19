# @rez/identity-integration

Unified client for all REZ identity services.

## Services Consolidated

| Service | Port | Purpose |
|---------|------|---------|
| REZ-identity-graph | 4050 | Identity resolution |
| REZ-universal-user-graph | 4055 | Cross-platform profiles |
| REZ-consumer-graph | - | Consumer relationships |
| REZ-identity-bridge | 4092 | Identity bridging |

## Usage

```typescript
import { IdentityClient, createIdentityClient } from '@rez/identity-integration';

const identity = new IdentityClient({
  internalToken: process.env.INTERNAL_SERVICE_TOKEN,
});

// Resolve identity from multiple identifiers
const result = await identity.resolve({
  identifiers: {
    phone: '+91-9876543210',
    email: 'user@example.com',
  },
  source: 'checkout',
});

// Get identity graph
const graph = await identity.getIdentityGraph('user_123');

// Get universal profile across platforms
const profile = await identity.getUniversalProfile('user_123');

// Get customer 360 view
const customer360 = await identity.getCustomer360({
  userId: 'user_123',
  includeRelationships: true,
  includeTransactions: true,
});
```

## Architecture

```
┌─────────────────────────────────────────┐
│        @rez/identity-integration           │
├─────────────────────────────────────────┤
│  Unified Client Interface                │
├─────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────────┐  │
│  │  Identity  │ │    Universal    │  │
│  │   Graph    │ │  User Graph     │  │
│  └──────┬──────┘ └────────┬────────┘  │
│         └──────────┬───────┘            │
│                    ▼                    │
│          Consumer Graph                 │
└─────────────────────────────────────────┘
```

## License

Proprietary - RTNM Group
