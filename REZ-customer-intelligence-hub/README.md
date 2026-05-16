# REZ Customer Intelligence Hub

**Port:** 4140
**Purpose:** Aggregate all customer data for commerce - unify profiles, orders, payments, reviews, segments, and recommendations

---

## Overview

The Customer Intelligence Hub is a unified service that aggregates customer data from multiple sources including orders, payments, reviews, segments, and recommendations. It provides a single source of truth for customer data across the entire commerce platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Customer Intelligence Hub                     │
├─────────────────────────────────────────────────────────────────┤
│  Profile    │  Orders    │  Payments  │  Reviews  │  Segments   │
│  Service    │  Service   │  Service  │  Service  │  Service    │
└────────┬────┴─────┬─────┴─────┬──────┴────┬─────┴──────┬───────┘
         │          │           │           │            │
         ▼          ▼           ▼           ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Source Services                               │
├─────────────────┬─────────────────┬───────────────────────────────┤
│ Order Service   │ Payment Service │ Review Service                │
│ (4003)          │ (4001)          │ (4006)                        │
├─────────────────┼─────────────────┼───────────────────────────────┤
│ Segments Service│ RFM Service     │ Recommendation Service        │
│ (4015)          │ (4055)          │ (4017)                        │
└─────────────────┴─────────────────┴───────────────────────────────┘
```

## Data Sources

| Service | Purpose | Integration |
|---------|---------|-------------|
| `rez-order-service` | Order history and summaries | HTTP API |
| `rez-payment-service` | Payment history and summaries | HTTP API |
| `rez-review-service` | Customer reviews and ratings | HTTP API |
| `REZ-realtime-segments` | Customer segments | HTTP API |
| `REZ-rfm-service` | RFM segmentation | HTTP API |
| `REZ-engagement-platform` | Recommendations | HTTP API |

## API Endpoints

### Customer Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customer/:userId` | Full customer overview |
| GET | `/api/customer/:userId/profile` | Unified profile |
| GET | `/api/customer/:userId/orders` | Order history |
| GET | `/api/customer/:userId/recommendations` | Personal recommendations |
| GET | `/api/customer/:userId/segments` | Customer segments |
| GET | `/api/customer/:userId/predictions` | ML predictions |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/` | Service info |

## Data Models

### CustomerOverview

```typescript
interface CustomerOverview {
  userId: string;
  profile: UnifiedProfile;
  orders: OrderSummary;
  payments: PaymentSummary;
  reviews: ReviewSummary;
  segments: string[];
  predictions: PredictionSummary;
  recommendations: Recommendation[];
  fetchedAt: string;
}
```

### UnifiedProfile

```typescript
interface UnifiedProfile {
  userId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  addresses?: Address[];
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

### OrderSummary

```typescript
interface OrderSummary {
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
  recentOrders?: {
    orderId: string;
    status: OrderStatus;
    total: number;
    itemCount: number;
    createdAt: string;
  }[];
}
```

### PredictionSummary

```typescript
interface PredictionSummary {
  churnRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  churnProbability?: number;
  lifetimeValue?: {
    predicted: number;
    actual: number;
    confidence: number;
  };
  nextPurchaseLikelihood?: number;
  nextPurchaseEta?: string;
  engagementScore?: number;
}
```

### Recommendation

```typescript
interface Recommendation {
  productId: string;
  productName: string;
  score: number;
  reason: string;
  category?: string;
  imageUrl?: string;
  originalPrice?: number;
  currentPrice?: number;
  discount?: number;
  inStock?: boolean;
}
```

## Usage Examples

### Get Customer Overview

```bash
curl http://localhost:4140/api/customer/cust_123
```

Response:
```json
{
  "success": true,
  "data": {
    "userId": "cust_123",
    "profile": {
      "userId": "cust_123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe"
    },
    "orders": {
      "totalOrders": 15,
      "totalSpend": 24500,
      "averageOrderValue": 1633
    },
    "payments": {
      "totalPayments": 15,
      "totalAmount": 24500,
      "successfulPayments": 14,
      "failedPayments": 1
    },
    "reviews": {
      "totalReviews": 8,
      "averageRating": 4.5
    },
    "segments": ["Champions", "Loyal"],
    "predictions": {
      "churnRisk": "LOW",
      "churnProbability": 0.05,
      "engagementScore": 85
    },
    "recommendations": [
      {
        "productId": "prod_456",
        "productName": "Premium Headphones",
        "score": 0.95,
        "reason": "Based on purchase history"
      }
    ],
    "fetchedAt": "2026-05-16T10:30:00Z"
  }
}
```

### Get Recommendations

```bash
curl http://localhost:4140/api/customer/cust_123/recommendations?limit=5
```

### Get Order History

```bash
curl http://localhost:4140/api/customer/cust_123/orders?limit=10&offset=0
```

## Environment Variables

```bash
# Service
PORT=4140
MONGODB_URI=mongodb://localhost:27017/rez_customer_intelligence_hub
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Service URLs
ORDER_SERVICE_URL=http://localhost:4003
PAYMENT_SERVICE_URL=http://localhost:4001
REVIEW_SERVICE_URL=http://localhost:4006
SEGMENTS_SERVICE_URL=http://localhost:4015
RFM_SERVICE_URL=http://localhost:4055
RECOMMENDATION_SERVICE_URL=http://localhost:4017
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-customer-intelligence-hub
npm install
cp .env.example .env
npm run dev
```

## Integration Points

| Service | Integration | Description |
|---------|-------------|-------------|
| `rez-order-service` | HTTP | Fetch order summaries |
| `rez-payment-service` | HTTP | Fetch payment history |
| `rez-review-service` | HTTP | Fetch reviews |
| `REZ-rfm-service` | HTTP | Get RFM segments |
| `REZ-engagement-platform` | HTTP | Get recommendations |
| `REZ-journey-service` | HTTP | Trigger personalized journeys |
| `REZ-marketing-service` | HTTP | Campaign targeting |

## File Structure

```
REZ-customer-intelligence-hub/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── routes/
│   │   └── index.ts          # API routes
│   ├── services/
│   │   └── customerService.ts # Customer data aggregation
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

- [REZ-rfm-service](./REZ-rfm-service/) - RFM Segmentation
- [REZ-engagement-platform](../REZ-Media/REZ-engagement-platform/) - Loyalty & Recommendations
- [REZ-journey-service](../REZ-Media/REZ-journey-service/) - Customer journeys
- [REZ-lead-intelligence](./REZ-lead-intelligence/) - Lead scoring
