# REZ Inventory Intelligence Service

**Port:** 4035
**Purpose:** Inventory Intelligence with Demand Forecasting, Stock Optimization, and Reorder Management

---

## Overview

The Inventory Intelligence Service provides comprehensive inventory management capabilities including demand forecasting, reorder optimization, stock level optimization, and ABC analysis. It helps merchants optimize their inventory levels, reduce stockouts, minimize holding costs, and improve overall supply chain efficiency.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Inventory Intelligence Service                  │
├─────────────────────────────────────────────────────────────────┤
│  Demand Forecasting  │  Reorder Optimizer  │  Stock Optimizer  │
│       Service        │       Service       │       Service      │
├─────────────────────────────────────────────────────────────────┤
│                      MongoDB Database                            │
│  (ProductMaster, DemandData, OrderData, SupplierLeadTime, etc.) │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Demand Forecasting
- **Multiple Methods**: Simple Moving Average, Weighted Moving Average, Exponential Smoothing, Linear Regression, Seasonal Decomposition
- **Confidence Intervals**: Calculate prediction bounds based on demand variability
- **Seasonality Detection**: Automatically detect weekly/monthly seasonal patterns
- **Model Comparison**: Compare methods and select the best performer
- **Ensemble Forecasting**: Combine multiple methods for improved accuracy

### 2. Reorder Optimization
- **Safety Stock Calculation**: Calculate optimal safety stock using statistical methods
- **Reorder Point Calculation**: Determine when to place orders based on lead time
- **Optimal Order Quantity**: EOQ with adjustments for demand uncertainty
- **Urgency Classification**: Critical, High, Medium, Low priority levels
- **Supplier Lead Time Analysis**: Track and analyze supplier performance

### 3. Stock Optimization
- **Target Turn Rate Optimization**: Balance inventory investment vs. availability
- **ABC Analysis**: Classify SKUs by value contribution (A/B/C)
- **Inventory Turn Analysis**: Calculate turn rates and days on hand
- **Health Scoring**: Score inventory health from 0-100
- **Recommendations Engine**: Actionable suggestions for stock improvements

### 4. Analytics
- **Velocity Analysis**: Track sales velocity and trends
- **Seasonal Pattern Detection**: Identify recurring demand patterns
- **Supplier Performance Tracking**: Monitor lead time reliability

## API Endpoints

### Forecasting

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/forecast/:sku` | Get demand forecast for a SKU |
| GET | `/api/v1/forecast/:sku/compare` | Compare multiple forecasting methods |
| GET | `/api/v1/forecast/:sku/ensemble` | Get ensemble forecast |

### Reorder Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reorder/:sku` | Get reorder suggestions for a SKU |
| GET | `/api/v1/reorder/:sku/safety-stock` | Calculate safety stock |
| GET | `/api/v1/reorder/:sku/reorder-point` | Calculate reorder point |
| GET | `/api/v1/reorder/alerts` | Get all reorder alerts |

### Stock Optimization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/optimize/:sku` | Get stock optimization recommendations |
| GET | `/api/v1/optimize/:sku/turn` | Get inventory turn analysis |
| GET | `/api/v1/abc-analysis` | Perform ABC classification analysis |
| GET | `/api/v1/optimize/underperforming` | Get underperforming SKUs |

### Supplier Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/supplier/:supplierId/lead-times` | Get supplier lead times |
| GET | `/api/v1/supplier/:supplierId/analysis` | Analyze supplier performance |

### Data Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/orders` | Sync order data for demand analysis |
| GET | `/api/v1/demand/:sku` | Get historical demand data |
| GET | `/api/v1/products` | List products with filtering |
| POST | `/api/v1/products` | Create a new product |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/` | Service info |

## Data Models

### ForecastResult

```typescript
interface ForecastResult {
  sku: string;
  method: ForecastMethod;
  predictions: Array<{
    date: Date;
    predictedQuantity: number;
    lowerBound: number;
    upperBound: number;
    confidenceLevel: number;
  }>;
  modelMetrics: {
    mae: number;      // Mean Absolute Error
    mape: number;     // Mean Absolute Percentage Error
    rmse: number;     // Root Mean Square Error
    rSquared: number; // Coefficient of Determination
    bias: number;     // Forecast Bias
    theilU: number;   // Theil's U statistic
  };
  seasonality?: SeasonalDecomposition;
  generatedAt: Date;
}
```

### ReorderSuggestion

```typescript
interface ReorderSuggestion {
  sku: string;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  daysUntilStockout: number;
  suggestedOrderDate: Date;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  supplierId?: string;
  estimatedCost: number;
}
```

### StockOptimization

```typescript
interface StockOptimization {
  sku: string;
  currentStock: number;
  optimizedStock: number;
  targetStock: number;
  minStock: number;
  maxStock: number;
  economicOrderQuantity: number;
  currentTurnsPerYear: number;
  targetTurnsPerYear: number;
  holdingCostPerUnit: number;
  orderCostPerOrder: number;
  recommendations: string[];
}
```

### ABCAnalysisResult

```typescript
interface ABCAnalysisResult {
  classifications: ABCClassificationItem[];
  summary: {
    totalSkus: number;
    totalValue: number;
    classACount: number;
    classACoverage: number;
    classBCount: number;
    classBCoverage: number;
    classCCount: number;
    classCCoverage: number;
  };
  fastMovers: ABCClassificationItem[];
  slowMovers: ABCClassificationItem[];
  generatedAt: Date;
}
```

## Usage Examples

### Get Demand Forecast

```bash
curl -X GET http://localhost:4035/api/v1/forecast/SKU-001 \
  -H "X-Internal-Token: your-token" \
  -G \
  --data-urlencode "horizon=30" \
  --data-urlencode "method=exponential_smoothing" \
  --data-urlencode "confidenceLevel=0.95"
```

Response:
```json
{
  "success": true,
  "data": {
    "sku": "SKU-001",
    "method": "exponential_smoothing",
    "predictions": [
      {
        "date": "2026-05-17T00:00:00.000Z",
        "predictedQuantity": 45.5,
        "lowerBound": 38.2,
        "upperBound": 52.8,
        "confidenceLevel": 0.95
      }
    ],
    "modelMetrics": {
      "mae": 3.2,
      "mape": 8.5,
      "rmse": 4.1,
      "rSquared": 0.89,
      "bias": 0.5,
      "theilU": 0.45
    },
    "generatedAt": "2026-05-16T10:30:00.000Z"
  }
}
```

### Get Reorder Suggestion

```bash
curl -X GET http://localhost:4035/api/v1/reorder/SKU-001 \
  -H "X-Internal-Token: your-token"
```

Response:
```json
{
  "success": true,
  "data": {
    "sku": "SKU-001",
    "currentStock": 25,
    "reorderPoint": 50,
    "reorderQuantity": 100,
    "safetyStock": 30,
    "daysUntilStockout": 5,
    "suggestedOrderDate": "2026-05-17T00:00:00.000Z",
    "urgency": "high",
    "confidence": 0.85,
    "supplierId": "SUP-001",
    "estimatedCost": 5000.00
  }
}
```

### Get Stock Optimization

```bash
curl -X GET "http://localhost:4035/api/v1/optimize/SKU-001?targetTurnsPerYear=12&holdingCostPercent=25" \
  -H "X-Internal-Token: your-token"
```

Response:
```json
{
  "success": true,
  "data": {
    "sku": "SKU-001",
    "currentStock": 150,
    "optimizedStock": 100,
    "targetStock": 100,
    "minStock": 45,
    "maxStock": 150,
    "economicOrderQuantity": 89,
    "currentTurnsPerYear": 6.5,
    "targetTurnsPerYear": 12,
    "holdingCostPerUnit": 2.50,
    "orderCostPerOrder": 50,
    "recommendations": [
      "Stock level is above optimal. Consider promotional campaigns to reduce inventory."
    ]
  }
}
```

### Perform ABC Analysis

```bash
curl -X GET "http://localhost:4035/api/v1/abc-analysis?limit=100" \
  -H "X-Internal-Token: your-token"
```

Response:
```json
{
  "success": true,
  "data": {
    "classifications": [
      {
        "sku": "SKU-001",
        "category": "Electronics",
        "annualDemand": 5000,
        "unitCost": 50.00,
        "annualValue": 250000.00,
        "classification": "A",
        "velocity": "fast",
        "suggestedReorderFrequency": "weekly",
        "turnRate": 15.2
      }
    ],
    "summary": {
      "totalSkus": 100,
      "totalValue": 500000.00,
      "classACount": 20,
      "classACoverage": 80.0,
      "classAValue": 400000.00,
      "classBCount": 30,
      "classBCoverage": 30.0,
      "classBValue": 75000.00,
      "classCCount": 50,
      "classCCoverage": 50.0,
      "classCValue": 25000.00
    },
    "fastMovers": [...],
    "slowMovers": [...],
    "generatedAt": "2026-05-16T10:30:00.000Z"
  }
}
```

### Sync Order Data

```bash
curl -X POST http://localhost:4035/api/v1/sync/orders \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "syncType": "incremental",
    "orders": [
      {
        "orderId": "ORD-001",
        "sku": "SKU-001",
        "quantity": 2,
        "orderDate": "2026-05-15T14:30:00Z",
        "customerId": "CUST-001",
        "channel": "online"
      }
    ]
  }'
```

## Forecasting Methods

| Method | Best For | Description |
|--------|----------|-------------|
| `simple_moving_average` | Stable demand | Basic averaging over recent periods |
| `weighted_moving_average` | Trend awareness | More recent periods weighted higher |
| `exponential_smoothing` | General purpose | Double exponential (Holt's) for trends |
| `linear_regression` | Strong trends | Linear trend projection |
| `seasonal_decomposition` | Seasonal products | Detects and projects seasonal patterns |

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=4035
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/rez_inventory_intelligence
REDIS_URL=redis://localhost:6379

# Internal Service Token
INTERNAL_SERVICE_TOKEN=your-secure-token-here

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# External Service URLs
ORDER_SERVICE_URL=http://localhost:4003
AUTH_SERVICE_URL=http://localhost:3000

# Forecasting Configuration
FORECAST_HISTORY_DAYS=90
FORECAST_SEASONALITY_WEEKS=12
FORECAST_CONFIDENCE_LEVEL=0.95

# Optimization Configuration
SAFETY_STOCK_SERVICE_LEVEL=0.95
REORDER_POINT_SERVICE_LEVEL=0.90
DEFAULT_TARGET_TURNS=12
DEFAULT_HOLDING_COST_PERCENT=25
DEFAULT_ORDER_COST=50
```

## Quick Start

```bash
# Install dependencies
cd REZ-Intelligence/REZ-inventory-intelligence
npm install

# Copy environment file
cp .env.example .env

# Start in development mode
npm run dev

# Or build and run in production
npm run build
npm start
```

## File Structure

```
REZ-inventory-intelligence/
├── src/
│   ├── index.ts                      # Main entry point
│   ├── config/
│   │   └── index.ts                  # Configuration management
│   ├── routes/
│   │   ├── index.ts                  # Route aggregator
│   │   └── inventory.routes.ts       # Inventory API routes
│   ├── services/
│   │   ├── demandForecasting.ts      # Forecasting service
│   │   ├── reorderOptimizer.ts       # Reorder optimization
│   │   └── stockOptimizer.ts         # Stock optimization
│   ├── models/
│   │   └── schemas.ts                # Mongoose schemas
│   ├── types/
│   │   └── inventory.types.ts        # TypeScript types
│   ├── middleware/
│   │   ├── auth.middleware.ts        # Authentication
│   │   └── error.middleware.ts       # Error handling
│   └── utils/
│       ├── logger.ts                 # Winston logger
│       └── math.ts                   # Statistical functions
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Integration Points

| Service | Port | Integration |
|---------|------|-------------|
| `rez-order-service` | 4003 | Order data for demand forecasting |
| `rez-inventory-service` | 4010 | Stock levels and product info |
| `rez-auth-service` | 3000 | Authentication |
| `rez-analytics-service` | 4006 | Analytics data |

## Monitoring

### Health Check

```bash
curl http://localhost:4035/api/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "rez-inventory-intelligence",
    "version": "1.0.0",
    "timestamp": "2026-05-16T10:30:00.000Z"
  }
}
```

## Related Services

- [REZ-intent-graph](../REZ-intent-graph/) - Intent tracking and ML scoring
- [REZ-rfm-service](../REZ-rfm-service/) - Customer segmentation
- [REZ-pricing-engine](../../REZ-Media/REZ-pricing-engine/) - Dynamic pricing
- [REZ-engagement-platform](../../REZ-Media/REZ-engagement-platform/) - Customer engagement

## License

MIT
