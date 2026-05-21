# REZ Aggregator Hub - SPEC.md

**Version:** 1.0.0
**Type:** SDK/Library
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Unified interface for restaurant aggregator integration (Swiggy, Zomato, Magicpin). Enables menu sync, order management, and analytics across multiple food delivery platforms from a single API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Aggregator Hub                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Supported Aggregators:                                                   │
│  ├── Swiggy      → India's largest food delivery                          │
│  ├── Zomato      → Food delivery & dining out                           │
│  └── Magicpin    → Hyperlocal discovery                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Menu Sync       → Bidirectional menu updates                        │
│  ├── Order Pull      → Centralized order retrieval                       │
│  ├── Status Push     → Real-time status updates                         │
│  └── Analytics       → Cross-platform performance                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Aggregator Adapters

| Aggregator | Status Endpoint | Menu Endpoint | Order Endpoint |
|------------|-----------------|----------------|----------------|
| Swiggy | ✅ | ✅ | ✅ |
| Zomato | ✅ | ✅ | ✅ |
| Magicpin | ✅ | ✅ | ✅ |

---

## Key Features

| Feature | Description |
|---------|-------------|
| Menu Synchronization | Sync inventory across platforms |
| Order Aggregation | Pull orders from all platforms |
| Status Updates | Push order status in real-time |
| Price Mapping | Unified pricing strategy |
| Availability Toggle | Turn items on/off |

---

## Dependencies

```json
{
  "@types/jest": "^29.5.12",
  "@types/node": "^20.11.0",
  "typescript": "^5.3.3"
}
```

---

## Usage

```typescript
import { AggregatorHub, SwiggyAdapter, ZomatoAdapter } from 'rez-aggregator-hub';

const hub = new AggregatorHub();
hub.register(new SwiggyAdapter(config));
hub.register(new ZomatoAdapter(config));

// Sync menu
await hub.syncMenu(restaurantId, menu);

// Pull orders
const orders = await hub.pullOrders(restaurantId);

// Update status
await hub.updateStatus(orderId, 'confirmed');
```

---

## Status

- [x] Aggregator hub foundation
- [x] Swiggy adapter
- [x] Zomato adapter
- [x] Magicpin adapter
- [x] Menu sync
- [x] Order pull
- [x] Status push
