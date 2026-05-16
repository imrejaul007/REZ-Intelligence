# REZ Inventory Intelligence

**Port:** 4141
**Purpose:** Real-time inventory insights - stock monitoring, velocity analysis, and demand forecasting

---

## Overview

The Inventory Intelligence Service provides comprehensive stock monitoring, sales velocity analysis, and demand forecasting capabilities. It helps merchants optimize their inventory levels, reduce stockouts, and improve fulfillment efficiency.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Inventory Intelligence                          │
├─────────────────────────────────────────────────────────────────┤
│  Inventory Insight  │  Velocity Analysis  │  Demand Forecast   │
│       Service       │       Service       │       Service       │
└────────┬────────────┴──────────┬──────────┴───────────┬─────────┘
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Source Services                               │
├─────────────────┬─────────────────┬───────────────────────────────┤
│ Inventory       │ Order Service   │ Analytics Service             │
│ Service (4010)  │ (4003)          │ (4006)                        │
└─────────────────┴─────────────────┴───────────────────────────────┘
```

## Key Features

- **Real-time Stock Monitoring**: Track stock levels, status, and changes
- **Velocity Analysis**: Understand sales patterns and trends
- **Demand Forecasting**: Predict future demand with confidence intervals
- **Low Stock Alerts**: Proactive notifications for inventory needs
- **Reorder Recommendations**: Data-driven reorder suggestions

## API Endpoints

### Inventory Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/:productId` | Get stock insight for a product |
| GET | `/api/inventory/:productId/forecast` | Get demand forecast |
| GET | `/api/inventory/:productId/velocity` | Get velocity analysis |
| GET | `/api/inventory/:productId/movements` | Get stock movements |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/alerts` | Get all low stock alerts |
| POST | `/api/inventory/bulk/insights` | Get bulk inventory insights |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/` | Service info |

## Data Models

### InventoryInsight

```typescript
interface InventoryInsight {
  productId: string;
  productName?: string;
  sku?: string;
  stockLevel: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
  velocity: number;           // Units sold per day
  velocityTrend?: 'INCREASING' | 'STABLE' | 'DECREASING';
  reorderPoint: number;
  reorderQuantity?: number;
  daysUntilStockout?: number;
  demandForecast?: {
    daily: number;
    weekly: number;
    monthly: number;
    confidence: number;
  };
  supplierLeadTime?: number;
  supplier?: string;
  lastRestocked?: string;
  lastUpdated: string;
}
```

### LowStockAlert

```typescript
interface LowStockAlert {
  productId: string;
  productName: string;
  sku?: string;
  currentStock: number;
  reorderPoint: number;
  shortage: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  daysUntilStockout: number;
  suggestedAction: string;
  supplier?: string;
  supplierLeadTime?: number;
  createdAt: string;
}
```

### DemandForecast

```typescript
interface DemandForecast {
  productId: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  forecasts: {
    date: string;
    predicted: number;
    lower: number;
    upper: number;
    confidence: number;
  }[];
  totalPredicted: number;
  averageVelocity: number;
  seasonality?: {
    detected: boolean;
    pattern?: string;
    strength?: number;
  };
  factors?: {
    factor: string;
    impact: number;
    description?: string;
  }[];
  generatedAt: string;
}
```

## Stock Status Types

| Status | Description | Threshold |
|--------|-------------|-----------|
| `IN_STOCK` | Normal stock level | Above reorder point + buffer |
| `LOW_STOCK` | Below optimal level | Below reorder point |
| `CRITICAL` | Near stockout | Below critical threshold |
| `OUT_OF_STOCK` | No inventory | Zero units |
| `OVERSTOCKED` | Excess inventory | Above 5x reorder point |

## Usage Examples

### Get Inventory Insight

```bash
curl http://localhost:4141/api/inventory/prod_123
```

Response:
```json
{
  "success": true,
  "data": {
    "productId": "prod_123",
    "productName": "Premium Wireless Headphones",
    "sku": "WH-PRO-001",
    "stockLevel": 45,
    "stockStatus": "IN_STOCK",
    "velocity": 5.2,
    "velocityTrend": "INCREASING",
    "reorderPoint": 50,
    "daysUntilStockout": 8.7,
    "demandForecast": {
      "daily": 5.5,
      "weekly": 38.5,
      "monthly": 165,
      "confidence": 0.85
    },
    "supplierLeadTime": 7,
    "supplier": "TechSupply Co.",
    "lastUpdated": "2026-05-16T10:30:00Z"
  }
}
```

### Get Low Stock Alerts

```bash
curl "http://localhost:4141/api/inventory/alerts?urgency=HIGH&limit=20"
```

Response:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "productId": "prod_456",
        "productName": "Bluetooth Speaker",
        "currentStock": 3,
        "reorderPoint": 20,
        "urgency": "CRITICAL",
        "daysUntilStockout": 1,
        "suggestedAction": "Immediate restock required"
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Get Demand Forecast

```bash
curl "http://localhost:4141/api/inventory/prod_123/forecast?period=WEEKLY"
```

## Environment Variables

```bash
# Service
PORT=4141
MONGODB_URI=mongodb://localhost:27017/rez_inventory_intelligence
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Service URLs
INVENTORY_SERVICE_URL=http://localhost:4010
ORDER_SERVICE_URL=http://localhost:4003
ANALYTICS_SERVICE_URL=http://localhost:4006

# Inventory Settings
LOW_STOCK_THRESHOLD=10
CRITICAL_STOCK_THRESHOLD=5
FORECAST_DAYS=30
VELOCITY_WINDOW_DAYS=7
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-inventory-intelligence
npm install
cp .env.example .env
npm run dev
```

## Integration Points

| Service | Integration | Description |
|---------|-------------|-------------|
| `rez-inventory-service` | HTTP | Stock data |
| `rez-order-service` | HTTP | Sales velocity |
| `rez-analytics-service` | HTTP | Forecasting |
| `REZ-pricing-engine` | HTTP | Dynamic pricing |
| `REZ-engagement-platform` | HTTP | Out of stock alerts |
| `REZ-marketing-service` | HTTP | Demand generation |

## File Structure

```
REZ-inventory-intelligence/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── routes/
│   │   └── index.ts          # API routes
│   ├── services/
│   │   └── inventoryService.ts # Inventory operations
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── utils/
│       └── logger.ts         # Winston logger
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Related Services

- [REZ-customer-intelligence-hub](./REZ-customer-intelligence-hub/) - Customer data hub
- [REZ-rfm-service](./REZ-rfm-service/) - Customer segmentation
- [REZ-pricing-engine](../REZ-Media/REZ-pricing-engine/) - Dynamic pricing
- [REZ-engagement-platform](../REZ-Media/REZ-engagement-platform/) - Customer engagement
