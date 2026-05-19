# REZ Unified Commerce Graph

**Port:** 4170

Single graph combining all commerce data for hyperlocal intelligence.

## What It Unifies

| Layer | Data |
|-------|------|
| **Customer** | Identity, behaviors, predictions, loyalty, lifecycle |
| **Merchant** | Intelligence, offers, competitors, target audience |
| **Transaction** | Visits, purchases, redemptions, attribution |
| **CrossSell** | Category relationships, conversion rates |
| **Location** | Geofencing, proximity, area patterns |

## Features

- **Customer 360**: Complete user profile with predictions
- **Cross-Sell Engine**: AI-powered merchant recommendations
- **Moment Targeting**: Real-time ad triggers based on user state
- **Location Intelligence**: Nearby merchants with relevance scoring
- **Ad Decision Engine**: Auction-based ad selection

## API Endpoints

### Customer APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers/:userId` | Get customer 360 view |
| PATCH | `/api/customers/:userId/predictions` | Update predictions |
| GET | `/api/customers/:userId/cross-sells` | Get cross-sell recommendations |
| GET | `/api/customers/:userId/moments` | Get moment triggers |

### Merchant APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchants/:merchantId` | Get merchant intelligence |

### Transaction APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Record transaction |

### Location APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/nearby` | Get nearby merchants |

### Ad Decision APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ads/decide` | Get ad decisions for user moment |

## Moment Triggers

The graph tracks these moment triggers:

1. **coin_expiry**: User has coins expiring soon
2. **streak_risk**: User's visit streak is at risk
3. **birthday**: User's birthday within 7 days
4. **churn_risk**: User predicted to churn
5. **high_spender**: User is high-value customer

## Quick Start

```bash
cd REZ-unified-commerce-graph
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

```env
PORT=4170
MONGODB_URI=mongodb://localhost:27017/rez-unified-commerce-graph
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│            REZ UNIFIED COMMERCE GRAPH                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │Customer │  │Merchant │  │Location │  │ Campaign │  │
│  │  Node   │  │  Node   │  │  Node   │  │   Node   │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │
│       │             │             │             │       │
│       └─────────────┴──────┬──────┴─────────────┘       │
│                            │                             │
│                    ┌──────▼──────┐                     │
│                    │ Transaction │                     │
│                    │    Edge     │                     │
│                    └──────┬──────┘                     │
│                            │                             │
│                    ┌──────▼──────┐                     │
│                    │  CrossSell │                     │
│                    │  Edge      │                     │
│                    └────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Integration

### With REZ-decision-service
```typescript
// Get ad decisions
const { decisions } = await fetch('http://localhost:4170/api/ads/decide', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user_123',
    location: { lat: 12.97, lng: 77.59 },
    moment: 'nearby'
  })
});
```

### With REZ-commerce-agents
```typescript
// Get cross-sell recommendations
const { recommendations } = await fetch('http://localhost:4170/api/customers/user_123/cross-sells?limit=5');
```

## License

Proprietary - RTNM Group
