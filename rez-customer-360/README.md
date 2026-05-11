# ReZ Customer 360

Customer 360 view module with unified profiles, interaction history, lifetime value, and preferences.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Event-driven architecture (EventEmitter)

## Overview

Customer 360 provides a unified view of customer data including:
- Unified customer profiles
- Interaction history across all channels
- Lifetime value (LTV) calculations
- Customer preferences management
- Churn risk assessment
- Real-time updates

## Usage

```typescript
import { Customer360, Customer360Config } from 'rez-customer-360';

// Initialize with optional config
const config: Customer360Config = {
  enableRealTimeUpdates: true,
  ltvPredictionModel: 'simple',
  churnRiskThreshold: 0.5,
  maxInteractionsPerPage: 50,
};

const customer360 = new Customer360(config);

// Load customer profile
await customer360.loadProfile({
  id: 'cust_123',
  firstName: 'John',
  lastName: 'Doe',
  contact: {
    email: 'john@example.com',
    phone: '+1234567890',
  },
  demographics: {
    age: 35,
    gender: 'male',
    occupation: 'engineer',
  },
  accountStatus: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: ['vip', 'early-adopter'],
  metadata: {},
});

// Add interaction
await customer360.addInteraction({
  id: 'int_001',
  type: 'purchase',
  channel: 'web',
  timestamp: new Date(),
  duration: 300,
  outcome: 'completed',
  sentiment: 'positive',
  metadata: { orderId: 'ORD-123' },
});

// Add transaction
await customer360.addTransaction({
  id: 'txn_001',
  timestamp: new Date(),
  amount: 150.00,
  currency: 'USD',
  items: [
    { productId: 'prod_1', name: 'Item 1', quantity: 2, unitPrice: 75.00, total: 150.00 }
  ],
  paymentMethod: 'credit_card',
  status: 'completed',
});

// Get calculated lifetime value
const ltv = customer360.calculateLifetimeValue();
console.log(ltv);
// {
//   totalRevenue: 1500,
//   totalOrders: 10,
//   averageOrderValue: 150,
//   predictedLTV: 15000,
//   ltvScore: 'high',
//   churnRisk: 'low'
// }
```

## Interfaces

### UnifiedProfile
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique customer ID |
| firstName | string | First name |
| lastName | string | Last name |
| contact | ContactInfo | Contact details |
| demographics | Demographics | Customer demographics |
| accountStatus | 'active' \| 'inactive' \| 'churned' \| 'prospect' | Account status |
| tags | string[] | Customer tags |
| metadata | Record<string, unknown> | Additional metadata |

### Interaction
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique interaction ID |
| type | InteractionType | Type of interaction |
| channel | Channel | Communication channel |
| timestamp | Date | When it occurred |
| duration | number | Duration in seconds |
| outcome | string | Interaction outcome |
| sentiment | 'positive' \| 'neutral' \| 'negative' | Customer sentiment |
| metadata | Record<string, unknown> | Additional data |

### LifetimeValue
| Field | Type | Description |
|-------|------|-------------|
| totalRevenue | number | Total revenue from customer |
| totalOrders | number | Number of orders |
| averageOrderValue | number | Calculated AOV |
| predictedLTV | number | Predicted lifetime value |
| ltvScore | 'low' \| 'medium' \| 'high' \| 'vip' | LTV classification |
| churnRisk | 'low' \| 'medium' \| 'high' \| 'critical' | Churn risk level |

## Interaction Types
- `purchase`
- `support_ticket`
- `call`
- `email`
- `chat`
- `meeting`
- `survey`
- `refund`
- `upgrade`
- `downgrade`
- `feedback`

## Channels
- `web`
- `mobile`
- `phone`
- `email`
- `chat`
- `in_store`
- `api`

## Events

The Customer360 class emits events for real-time updates:

```typescript
customer360.on('profile:loaded', (profile) => {
  console.log('Profile loaded:', profile.id);
});

customer360.on('interaction:added', (interaction) => {
  console.log('New interaction:', interaction.type);
});

customer360.on('ltv:calculated', (ltv) => {
  console.log('LTV updated:', ltv.totalRevenue);
});
```

## Local Setup

```bash
cd rez-customer-360

npm install

# Build
npm run build

# Run tests
npm test
```

## License

MIT
