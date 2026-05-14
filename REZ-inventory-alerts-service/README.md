# Inventory Alerts Service

**Port:** 4064
**Purpose:** Low stock notifications and inventory alerts

---

## Overview

The Inventory Alerts Service monitors stock levels and generates alerts when inventory falls below thresholds.

## Features

- Real-time stock monitoring
- Configurable thresholds
- Alert rules and conditions
- Multiple notification channels
- Alert acknowledgment and resolution
- Scheduled inventory checks

## API Endpoints

### Alert Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/alerts` | Create alert |
| GET | `/api/alerts` | List alerts |
| GET | `/api/alerts/:alertId` | Get alert |
| PATCH | `/api/alerts/:alertId/acknowledge` | Acknowledge |
| PATCH | `/api/alerts/:alertId/resolve` | Resolve |
| PATCH | `/api/alerts/:alertId/snooze` | Snooze |
| GET | `/api/alerts/stats/summary` | Summary |
| GET | `/api/alerts/rules` | List rules |
| POST | `/api/alerts/rules` | Create rule |

### Product Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/products` | Add product |
| GET | `/api/products` | List products |
| GET | `/api/products/:productId` | Get product |
| PATCH | `/api/products/:productId` | Update |
| PATCH | `/api/products/:productId/stock` | Update stock |
| PATCH | `/api/products/:productId/pause` | Pause |
| DELETE | `/api/products/:productId` | Remove |

## Quick Start

```bash
cd REZ-Intelligence/REZ-inventory-alerts-service
npm install
cp .env.example .env
npm run dev
```

## Related Services

- [Multi-location Service](./REZ-multi-location-service/) - Multi-store management
- [Supplier Marketplace](./REZ-supplier-marketplace/) - Supplier directory
