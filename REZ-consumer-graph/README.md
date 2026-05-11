# REZ Consumer Graph

**Unified Consumer Identity for REZ Commerce OS**

The Consumer Graph service creates a single, unified view of each consumer across all REZ platforms, apps, and touchpoints. It aggregates identity, transactions, browsing behavior, loyalty status, and AI memory to enable personalized experiences.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ConsumerGraph                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    IdentityResolver                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  │  Device     │  │  CrossPlat  │  │  IdentityCluster  │  │ │
│  │  │  Resolver   │  │  Linker     │  │  Manager         │  │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      GraphEngine                              │ │
│  │              (Neo4j Integration)                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Modules                                   │ │
│  │  ┌──────┐ ┌──────────┐ ┌───────┐ ┌───────┐ ┌────┐ ┌─────┐ │ │
│  │  │Wallet│ │ Browsing │ │Loyalty│ │Payment│ │DOOH│ │Hotel│ │ │
│  │  └──────┘ └──────────┘ └───────┘ └───────┘ └────┘ └─────┘ │ │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────┐          │ │
│  │  │ Referral   │ │   Intent     │ │   Payment   │          │ │
│  │  └────────────┘ └──────────────┘ └──────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Identity Management
- **Cross-device identity resolution**: Link the same consumer across iOS, Android, web, and kiosk devices
- **Cross-platform linking**: Connect consumer accounts across Consumer App, DO, Karma, Merchant, and Hotel apps
- **Deterministic matching**: Email and phone-based identity resolution with high confidence
- **Probabilistic matching**: Device graph and behavioral similarity for inference-based matching

### Consumer Profile (Consumer360)
- Unified profile aggregating all consumer data
- Real-time sync across all modules
- GDPR-compliant data management
- AI memory for personalized experiences

### Modules

| Module | Description |
|--------|-------------|
| **Wallet** | Unified points, cash, and crypto wallet management |
| **Browsing** | Session tracking, search history, product views |
| **Loyalty** | Points earning, tier management, benefits tracking |
| **Payment** | Payment methods, transaction history, fraud detection |
| **DOOH** | QR scans, campaign engagement, location tracking |
| **Referral** | Referral codes, tracking, and reward distribution |
| **Hotel** | Bookings, preferences, and stay history |
| **Intent** | Affinities, predictions, and purchase intent signals |

### Graph Relationships
- Device ownership (USES_DEVICE)
- Platform linking (LINKS_TO)
- Household connections (IN_HOUSEHOLD_WITH)
- Referral network (REFERRED)
- Purchase history (PURCHASED)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Usage

### Initialize Consumer Graph

```typescript
import { ConsumerGraph } from '@rez-intelligence/consumer-graph';
import { ConsumerGraphConfig } from '@rez-intelligence/consumer-graph/types';

const config: ConsumerGraphConfig = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  services: {
    wallet_service_url: process.env.WALLET_SERVICE_URL || '',
    browsing_service_url: process.env.BROWSING_SERVICE_URL || '',
    loyalty_service_url: process.env.LOYALTY_SERVICE_URL || '',
    intent_service_url: process.env.INTENT_SERVICE_URL || '',
  },
  identity: {
    match_threshold: 0.75,
    merge_window_hours: 24,
    device_graph_enabled: true,
  },
};

const consumerGraph = new ConsumerGraph(config);
```

### Create Consumer

```typescript
const profile = await consumerGraph.createConsumer({
  email: 'customer@example.com',
  phone: '+1234567890',
  device_id: 'device-uuid',
  source: 'consumer_app',
});
```

### Get Aggregated Profile

```typescript
const response = await consumerGraph.getAggregatedProfile(userId);
console.log(response.consumer);
// Full Consumer360 profile with all aggregated data
```

### Link Device

```typescript
await consumerGraph.linkDevice(
  userId,
  'device-uuid',
  'ios',
  { platform: 'iOS 17', app_version: '1.2.0' }
);
```

### Link Platform

```typescript
await consumerGraph.linkPlatform(
  userId,
  'consumer',
  'do',
  'do-user-id'
);
```

### Cross-Platform Query

```typescript
// Get all linked apps for a consumer
const profile = await consumerGraph.getConsumer(userId);
const linkedApps = profile.toJSON().apps;

// Get relationship graph
const graph = await consumerGraph.getRelationshipGraph(userId);
```

## API Endpoints

### Consumer Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/consumers` | Create new consumer |
| GET | `/api/consumers/:id` | Get consumer by ID |
| GET | `/api/consumers/:id/profile` | Get aggregated profile |
| DELETE | `/api/consumers/:id` | Delete consumer (GDPR) |

### Identity

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identity/link` | Link account |
| POST | `/api/identity/resolve` | Resolve device to consumer |
| GET | `/api/identity/clusters` | Get identity clusters |

### Modules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallets/:userId/summary` | Get wallet summary |
| GET | `/api/browsing/:userId/history` | Get browsing history |
| GET | `/api/loyalty/:userId/summary` | Get loyalty summary |
| POST | `/api/referrals/:userId/generate` | Generate referral code |
| GET | `/api/intent/:userId/predictions` | Get purchase predictions |

## Development

```bash
# Build
npm run build

# Run in development
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Graph Schema

### Nodes

```
(:Consumer {
  user_id: string,
  email: string,
  phone: string,
  loyalty_tier: string,
  total_spent: number,
  total_orders: number,
  points_balance: number
})

(:Device {
  device_id: string,
  type: string,
  first_seen: datetime,
  last_seen: datetime
})

(:PlatformAccount {
  user_id: string,
  app: string
})
```

### Relationships

```
(:Consumer)-[:USES_DEVICE]->(:Device)
(:Consumer)-[:LINKS_TO]->(:PlatformAccount)
(:Consumer)-[:IN_HOUSEHOLD_WITH]->(:Consumer)
(:Consumer)-[:REFERRED]->(:Consumer)
(:Consumer)-[:PURCHASED]->(:Product)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
