# REZ Unified Commerce Graph - SPEC.md

**Version:** 1.0.0
**Port:** 4170
**Company:** REZ-Intelligence
**Category:** Graph Intelligence

---

## Overview

Single unified graph combining Customer, Merchant, Location, Transaction, Loyalty, and Campaign data. The brain of the hyperlocal commerce network enabling moment-based targeting and cross-sell recommendations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Unified Commerce Graph                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Graph Nodes:                                                              │
│  ├── Customer  → Identity, behavior, preferences, loyalty, predictions      │
│  ├── Merchant  → Intelligence, offers, performance, competitors           │
│  ├── Transaction → Purchases, visits, spend, attribution                  │
│  └── CrossSell → Category relationships, conversion rates                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Key Features:                                                             │
│  ├── Customer 360  → Complete customer profile                            │
│  ├── Merchant Intelligence → Performance analytics                        │
│  ├── Cross-sell Recommendations → Category affinity                      │
│  ├── Moment-based Targeting → Real-time ad decisions                     │
│  └── Nearby Merchants → Location-based discovery                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Customer APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers/:userId` | Get customer 360 view |
| PATCH | `/api/customers/:userId/predictions` | Update predictions |
| GET | `/api/customers/:userId/cross-sells` | Cross-sell recommendations |
| GET | `/api/customers/:userId/moments` | Moment triggers for user |

### Merchant APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchants/:merchantId` | Get merchant intelligence |
| GET | `/api/merchants/:merchantId/analytics` | Merchant analytics |

### Transaction APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Record transaction |
| GET | `/api/transactions` | Query transactions |

### Location APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/nearby` | Get nearby merchants |

### Ad Decision APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ads/decide` | Get ad decisions for user moment |

---

## Data Models

### Customer Node
```typescript
{
  userId: string;
  phone, email: string;
  segments: string[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue: number;
  behaviors: {
    visitFrequency: number;
    preferredTime: string;
    categoryAffinity: Record<string, number>;
  };
  predictions: {
    churnRisk: number;
    ltvScore: number;
    revisitProbability: number;
  };
  loyalty: {
    coins: number;
    expiringCoins: number;
    streak: number;
    badges: string[];
  };
  location: { lat: number; lng: number };
}
```

### Merchant Node
```typescript
{
  merchantId: string;
  name, category: string;
  tier: 'basic' | 'standard' | 'premium' | 'elite';
  location: { lat: number; lng: number; address: string };
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    repeatCustomerRate: number;
  };
  offers: { active: number; avgCashback: number };
  competitors: string[];
}
```

---

## Moment Types

| Moment | Trigger | Action |
|--------|---------|--------|
| coin_expiry | Expiring coins detected | Show nearby coin-earning offers |
| streak_risk | Streak about to break | Send reminder notification |
| birthday | Within 7 days of birthday | Show birthday rewards |
| churn_risk | High churn probability | Offer retention incentives |
| high_spender | High spend probability | Show premium offers |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-identity-graph | Read | Customer identity |
| REZ-predictive-engine | Read | Churn/LTV predictions |
| REZ-loyalty | Read/Write | Loyalty data |
| REZ-location-intelligence | Read | Location data |
| REZ-dooh-service | Write | Ad targeting |

---

## Status

- [x] Service foundation
- [x] Customer graph
- [x] Merchant graph
- [x] Transaction edges
- [x] Cross-sell relationships
- [x] Moment-based targeting
- [x] Nearby merchants
- [x] Ad decision engine
