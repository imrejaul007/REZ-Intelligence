# REZ Merchant 360 - Unified Merchant Identity

A unified merchant identity service for REZ Commerce OS that consolidates merchant data from multiple platform services into a single, authoritative profile.

## Overview

Merchant 360 provides a canonical view of every merchant across all REZ platform verticals (restaurant, hotel, salon, fitness, retail, grocery, pharmacy). It aggregates data from:

- **Finance Module** - Wallet balance, payouts, revenue, credit score
- **Catalog Module** - Products, categories, inventory levels
- **Inventory Module** - Stock management, suppliers, warehouses
- **CRM Module** - Customers, reviews, feedback
- **Loyalty Module** - Points, members, tiers, redemptions
- **Staff Module** - Team members, roles, schedules
- **Compliance Module** - KYC, licenses, risk scores
- **Analytics Module** - Metrics, trends, insights
- **AI Memory Module** - Preferences, automation rules, conversations

## Features

- **Unified Identity**: Single merchant profile aggregating all module data
- **Identity Resolution**: Automatic detection and merging of duplicate merchants
- **Cross-Platform Sync**: Real-time synchronization across all platform services
- **Canonical Data Model**: Zod-validated merchant profiles with type safety
- **Event-Driven Architecture**: Subscribe to merchant lifecycle events
- **Health Monitoring**: Built-in health checks for all integrated services

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4000 |
| `NODE_ENV` | Environment | development |
| `LOG_LEVEL` | Logging level | info |
| `MATCH_THRESHOLD` | Identity match threshold | 0.85 |
| `SYNC_INTERVAL_MS` | Sync interval | 60000 |
| `FINANCE_SERVICE_URL` | Finance service URL | http://localhost:4001 |
| `CATALOG_SERVICE_URL` | Catalog service URL | http://localhost:4002 |
| `CATALOG_SERVICE_URL` | Catalog service URL | http://localhost:4002 |
| `INVENTORY_SERVICE_URL` | Inventory service URL | http://localhost:4003 |
| `CRM_SERVICE_URL` | CRM service URL | http://localhost:4004 |
| `LOYALTY_SERVICE_URL` | Loyalty service URL | http://localhost:4005 |
| `STAFF_SERVICE_URL` | Staff service URL | http://localhost:4006 |
| `COMPLIANCE_SERVICE_URL` | Compliance service URL | http://localhost:4007 |
| `ANALYTICS_SERVICE_URL` | Analytics service URL | http://localhost:4008 |
| `MEMORY_SERVICE_URL` | Memory service URL | http://localhost:4009 |
| `AGENTDB_HOST` | AgentDB host | localhost |
| `AGENTDB_PORT` | AgentDB port | 8080 |

## Usage

### Initialize the Service

```typescript
import { createService } from './src';

const service = createService({
  matchThreshold: 0.85,
});

await service.initialize();
```

### Create a Merchant

```typescript
const merchant = await service.createMerchant({
  business_name: 'Acme Coffee Shop',
  email: 'contact@acmecoffee.com',
  phone: '+1-555-123-4567',
  addresses: [{
    type: 'business',
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country: 'US',
    is_primary: true,
  }],
  verticals: ['restaurant', 'coffee_shop'],
  brand_names: ['Acme Coffee'],
});

console.log('Created merchant:', merchant.merchant_id);
```

### Get Merchant with All Module Data

```typescript
const merchant = await service.getMerchant('merchant-id', {
  includeAll: true,
});

console.log('Balance:', merchant.finances.wallet_balance);
console.log('Products:', merchant.catalog.total_products);
console.log('Customers:', merchant.crm.total_customers);
```

### Identity Resolution

```typescript
// Find or create merchant based on identity matching
const { merchant, resolved, isNew } = await service.resolveIdentity({
  business_name: 'Acme Coffee Shop',
  email: 'contact@acmecoffee.com',
});
```

### Merge Duplicate Merchants

```typescript
const { has_duplicates, duplicates } = await service.findDuplicates('merchant-id');

if (has_duplicates) {
  const merged = await service.mergeMerchants(
    duplicates[0].merchant_id, // source
    'merchant-id' // target
  );
}
```

### Cross-Platform Sync

```typescript
// Sync all modules
await service.syncMerchant('merchant-id');

// Sync specific service
await service.syncService('merchant-id', 'crm');

// Check sync status
const status = service.getSyncStatus('merchant-id');
console.log('Last sync:', status.last_sync_at);
```

### Event Handlers

```typescript
service.setEventHandlers({
  onMerchantCreated: (merchant) => {
    console.log('New merchant:', merchant.business_name);
  },
  onMerchantUpdated: (merchant) => {
    console.log('Updated:', merchant.merchant_id);
  },
  onSyncCompleted: ({ merchantId, success }) => {
    console.log(`Sync ${success ? 'succeeded' : 'failed'} for ${merchantId}`);
  },
});
```

## Data Model

### Merchant Profile

```typescript
interface Merchant360 {
  merchant_id: string;
  business_name: string;
  brand_names: string[];
  verticals: string[];

  email: string;
  phone: string;
  addresses: Address[];

  finances: Finances;
  catalog: Catalog;
  inventory: Inventory;
  crm: CRM;
  loyalty: Loyalty;
  staff: Staff;
  compliance: Compliance;
  analytics: Analytics;
  ai_memory: AIMemory;

  status: 'active' | 'suspended' | 'pending_verification' | 'closed';
  updated_at: string;
}
```

## API Endpoints (when integrated with HTTP server)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/merchants/:id` | Get merchant by ID |
| `GET` | `/merchants/:id?include=finances,catalog` | Get merchant with specific modules |
| `POST` | `/merchants` | Create merchant |
| `PATCH` | `/merchants/:id` | Update merchant |
| `DELETE` | `/merchants/:id` | Delete merchant |
| `POST` | `/merchants/resolve` | Resolve identity |
| `POST` | `/merchants/:id/sync` | Sync merchant data |
| `GET` | `/merchants/:id/sync/status` | Get sync status |
| `GET` | `/health` | Health check |

## Development

```bash
# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Merchant 360 Service                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Merchant   │  │  Identity   │  │   Cross-Platform Sync   │  │
│  │  Resolver   │  │  Resolver   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        Module Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Finance  │ │ Catalog  │ │Inventory │ │   CRM    │   ...     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                     External Services                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Finance Svc  │ │ Catalog Svc   │ │ Inventory Svc│   ...     │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## License

Proprietary - REZ Commerce OS
