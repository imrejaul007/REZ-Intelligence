# REZ Inventory Alerts Service - SPEC.md

**Version:** 1.0.0
**Port:** 4064
**Company:** REZ-Intelligence
**Category:** Inventory

---

## Overview

Low stock notifications and inventory alerts service. Monitors product stock levels, generates alerts for low/critical/out-of-stock conditions, and integrates with reorder systems.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Inventory Alerts Service                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Alert Types:                                                             │
│  ├── Low Stock      → Below threshold                                     │
│  ├── Critical       → Below critical threshold                            │
│  ├── Out of Stock   → Zero inventory                                      │
│  └── Restock Complete → Inventory replenished                             │
│                                                                             │
│  Alert Status: active → acknowledged → resolved/snoozed                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List monitored products |
| POST | `/api/products` | Add product to monitor |
| GET | `/api/products/:id` | Get product details |
| PATCH | `/api/products/:id` | Update product thresholds |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create alert |
| GET | `/api/alerts/:id` | Get alert details |
| PATCH | `/api/alerts/:id` | Update alert status |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| POST | `/api/alerts/:id/resolve` | Resolve alert |
| POST | `/api/alerts/:id/snooze` | Snooze alert |

### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List alert rules |
| POST | `/api/rules` | Create alert rule |
| PATCH | `/api/rules/:id` | Update rule |
| DELETE | `/api/rules/:id` | Delete rule |

---

## Data Models

### MonitoredProduct
```typescript
{
  productId: string;
  name: string;
  sku: string;
  currentStock: number;
  threshold: number;        // Low stock threshold
  criticalThreshold: number; // Critical stock threshold
  reorderPoint: number;
  reorderQuantity: number;
  status: 'ok' | 'low_stock' | 'critical' | 'out_of_stock' | 'paused';
}
```

### Alert
```typescript
{
  alertId: string;
  productId: string;
  type: 'low_stock' | 'critical' | 'out_of_stock' | 'restock_complete';
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'snoozed';
  channels: string[];
}
```

### AlertRule
```typescript
{
  ruleId: string;
  conditions: {
    productIds?: string[];
    categories?: string[];
    stockLevels?: { below?: number; above?: number };
  };
  actions: {
    notifyChannels?: string[];
    webhooks?: string[];
    autoReorder?: boolean;
  };
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "node-cron": "^3.0.3",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4064 | Service port |
| MONGODB_URI | localhost | MongoDB connection |
| REDIS_URL | localhost | Redis connection |
| CHECK_INTERVAL_MINUTES | 15 | Stock check frequency |
| INTERNAL_SERVICE_TOKEN | - | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-catalog | Read | Product data |
| REZ-notifications | Write | Alert notifications |
| REZ-orders | Write | Auto-reorder |

---

## Status

- [x] Service foundation
- [x] Product monitoring
- [x] Alert generation
- [x] Alert rules engine
- [x] Cron-based checks
- [ ] Multi-channel notifications
- [ ] Auto-reorder integration
