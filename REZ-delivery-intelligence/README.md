# REZ Delivery Intelligence

**Port:** 4142
**Purpose:** Delivery Optimization Intelligence - ETA prediction, route optimization, and delivery insights

---

## Overview

The Delivery Intelligence Service provides comprehensive delivery tracking, route optimization, and predictive analytics for commerce operations. It helps merchants improve delivery efficiency, reduce delays, and enhance customer satisfaction.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Delivery Intelligence                               │
├─────────────────────────────────────────────────────────────────┤
│  Delivery Insight  │  Route Optimizer  │  Analytics Engine       │
│       Service      │       Service     │       Service          │
└────────┬───────────┴──────────┬─────────┴───────────┬────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Source Services                               │
├─────────────────┬─────────────────┬───────────────────────────────┤
│ Order Service   │ Shipping        │ Location Service             │
│ (4003)          │ Service (4011)  │ (4006)                       │
└─────────────────┴─────────────────┴───────────────────────────────┘
```

## Key Features

- **Real-time Tracking**: Live delivery status and location updates
- **ETA Prediction**: Accurate estimated delivery times with confidence scores
- **Route Optimization**: Intelligent route planning to minimize distance and time
- **Delay Risk Assessment**: Proactive identification of potential delays
- **Delivery Analytics**: Comprehensive metrics and trends

## API Endpoints

### Delivery Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery/:orderId` | Get delivery insight for an order |
| GET | `/api/delivery/:orderId/prediction` | Get delivery prediction with risk factors |
| GET | `/api/delivery/merchant/:merchantId/active` | Get active deliveries for a merchant |

### Route Optimization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery/optimize/:merchantId` | Get optimized delivery routes |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery/analytics/:merchantId` | Get delivery analytics |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/` | Service info |

## Data Models

### DeliveryInsight

```typescript
interface DeliveryInsight {
  orderId: string;
  trackingNumber?: string;
  status: 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  eta: number;              // Hours remaining
  etaDate: string;          // ISO datetime
  deliveryScore: number;     // 0-100
  delayRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  optimalRoute?: string[];   // Ordered list of waypoints
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    updatedAt: string;
  };
  delayFactors?: {
    factor: string;
    impact: number;          // 0-1
    description: string;
  }[];
  milestones?: {
    status: DeliveryStatus;
    location?: string;
    timestamp: string;
    notes?: string;
  }[];
  recipient?: {
    name: string;
    phone?: string;
    address: string;
  };
  carrier?: {
    name: string;
    trackingUrl?: string;
  };
  lastUpdated: string;
}
```

### RouteOptimization

```typescript
interface RouteOptimization {
  merchantId: string;
  date: string;
  totalOrders: number;
  optimizedRoute: {
    sequence: number;
    orderId: string;
    customerAddress: string;
    estimatedArrival: string;
    estimatedDeliveryTime: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status: string;
  }[];
  totalDistance: number;      // km
  estimatedDuration: number;  // minutes
  estimatedFuelCost?: number;
  savings?: {
    distanceSaved: number;
    timeSaved: number;
    percentageImprovement: number;
  };
  warnings?: {
    orderId?: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
  }[];
  generatedAt: string;
}
```

### DeliveryPrediction

```typescript
interface DeliveryPrediction {
  orderId: string;
  predictedEta: string;
  confidence: number;        // 0-1
  riskFactors: {
    factor: string;
    probability: number;      // 0-1
    impact: string;
    mitigation?: string;
  }[];
  alternativeRoutes?: {
    route: string[];
    estimatedTime: number;
    riskLevel: DelayRisk;
  }[];
  recommendedActions: string[];
  generatedAt: string;
}
```

### Delay Risk Levels

| Level | Description | Trigger |
|-------|-------------|---------|
| `LOW` | No significant risk | Risk score < 30 |
| `MEDIUM` | Minor concerns | Risk score 30-50 |
| `HIGH` | Potential delays | Risk score 50-70 |
| `CRITICAL` | Likely delays | Risk score >= 70 |

## Usage Examples

### Get Delivery Insight

```bash
curl http://localhost:4142/api/delivery/ord_12345
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": "ord_12345",
    "trackingNumber": "TRK-987654",
    "status": "IN_TRANSIT",
    "eta": 3.5,
    "etaDate": "2026-05-16T14:30:00Z",
    "deliveryScore": 87,
    "delayRisk": "LOW",
    "optimalRoute": ["Warehouse A", "District 5", "Customer Address"],
    "currentLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "Near Central Park, NYC",
      "updatedAt": "2026-05-16T10:55:00Z"
    },
    "delayFactors": [],
    "milestones": [
      {
        "status": "PENDING",
        "timestamp": "2026-05-14T09:00:00Z"
      },
      {
        "status": "PICKED_UP",
        "location": "Warehouse A",
        "timestamp": "2026-05-14T11:30:00Z"
      },
      {
        "status": "IN_TRANSIT",
        "location": "District 5",
        "timestamp": "2026-05-16T10:30:00Z"
      }
    ],
    "recipient": {
      "name": "John Doe",
      "phone": "+1234567890",
      "address": "123 Main St, New York, NY 10001"
    },
    "carrier": {
      "name": "FastShip",
      "trackingUrl": "https://fastship.com/track/TRK-987654"
    },
    "lastUpdated": "2026-05-16T10:55:00Z"
  }
}
```

### Get Route Optimization

```bash
curl "http://localhost:4142/api/delivery/optimize/merchant_abc?date=2026-05-16"
```

### Get Delivery Analytics

```bash
curl "http://localhost:4142/api/delivery/analytics/merchant_abc?startDate=2026-04-01&endDate=2026-04-30"
```

## Environment Variables

```bash
# Service
PORT=4142
MONGODB_URI=mongodb://localhost:27017/rez_delivery_intelligence
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Service URLs
ORDER_SERVICE_URL=http://localhost:4003
SHIPPING_SERVICE_URL=http://localhost:4011
LOCATION_SERVICE_URL=http://localhost:4006
ANALYTICS_SERVICE_URL=http://localhost:4006

# Delivery Settings
DEFAULT_ETA_HOURS=48
TRAFFIC_MULTIPLIER=1.2
WEATHER_MULTIPLIER=1.3
PEAK_HOURS_START=8
PEAK_HOURS_END=20
BASE_DELIVERY_SCORE=85
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-delivery-intelligence
npm install
cp .env.example .env
npm run dev
```

## Integration Points

| Service | Integration | Description |
|---------|-------------|-------------|
| `rez-order-service` | HTTP | Order data and status |
| `rez-shipping-service` | HTTP | Shipping and tracking |
| `REZ-location-service` | HTTP | Real-time location |
| `REZ-analytics-service` | HTTP | Analytics and trends |
| `REZ-customer-intelligence-hub` | HTTP | Customer notifications |
| `REZ-notifications-service` | HTTP | Delivery alerts |

## File Structure

```
REZ-delivery-intelligence/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── routes/
│   │   └── index.ts          # API routes
│   ├── services/
│   │   └── deliveryService.ts # Delivery operations
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
- [REZ-inventory-intelligence](./REZ-inventory-intelligence/) - Inventory insights
- [REZ-rfm-service](./REZ-rfm-service/) - Customer segmentation
- [REZ-engagement-platform](../REZ-Media/REZ-engagement-platform/) - Customer engagement
- [REZ-notifications-service](../RABTUL-Technologies/REZ-notifications-service/) - Notifications
