# REZ Aggregator Hub

Unified interface for Swiggy, Zomato, and Magicpin restaurant aggregator integration.

## Overview

The REZ Aggregator Hub provides a single API for managing restaurant listings and orders across multiple food delivery aggregators:
- Unified menu management
- Order synchronization
- Inventory updates
- Review aggregation

## Features

- **Multi-Aggregator Support**: Swiggy, Zomato, Magicpin
- **Menu Sync**: Synchronize menus across platforms
- **Order Aggregation**: Unified order management
- **Inventory Management**: Real-time stock updates
- **Review Aggregation**: Collect and display reviews

## Architecture

```
┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│   REZ Hub   │───▶│  Aggregator  │───▶│  Swiggy    │
│             │    │    Hub       │    │            │
│             │    │              │───▶│  Zomato    │
│             │    │              │    │            │
│             │    │              │───▶│  Magicpin  │
└──────────────┘    └───────────────┘    └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install
npm run build
```

### Development

```bash
npm run build:watch
```

### Production

```bash
npm start
```

## API Endpoints

### Menu

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/menu/:restaurantId` | Get aggregated menu |
| POST | `/menu/:restaurantId/sync` | Sync menu to aggregators |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | List orders from all aggregators |
| GET | `/orders/:id` | Get order details |
| POST | `/orders/:id/status` | Update order status |

### Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/inventory/update` | Update inventory across platforms |
| GET | `/inventory/:itemId` | Get item availability |

### Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reviews/:restaurantId` | Get aggregated reviews |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Supported Aggregators

| Aggregator | Status | Features |
|------------|--------|----------|
| Swiggy | Supported | Menu, Orders, Inventory |
| Zomato | Supported | Menu, Orders, Inventory |
| Magicpin | Supported | Menu, Orders, Inventory |

## Usage Examples

### Sync Menu

```bash
curl -X POST http://localhost:4000/menu/rest123/sync \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "item1", "name": "Pizza", "price": 299}
    ],
    "platforms": ["swiggy", "zomato", "magicpin"]
  }'
```

### Update Inventory

```bash
curl -X POST http://localhost:4000/inventory/update \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item1",
    "available": true,
    "quantity": 50
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
