# REZ Reorder Engine - SPEC.md

**Version:** 1.0.0
**Port:** 4156
**Company:** REZ-Intelligence
**Category:** Commerce Automation

---

## Overview

Predictive reorder service that analyzes user purchase patterns and triggers timely nudge notifications to drive repeat purchases. Supports multiple commerce categories including restaurants, hotels, retail, and services.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Reorder Engine (4156)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Profile Tracking    → User-merchant purchase history                 │
│  ├── Reorder Prediction → ML-based reorder timing                       │
│  ├── Nudge Generation   → Personalized reminder messages                │
│  └── Analytics          → Conversion tracking                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/reorder/*                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Commerce Categories

| Category | Description |
|----------|-------------|
| `restaurant` | Food delivery and dine-in |
| `hotel` | Hotel bookings |
| `retail` | Product purchases |
| `booking` | Appointments and reservations |
| `services` | Service appointments |
| `fintech` | Financial subscriptions |

---

## Reorder Score Calculation

The reorder score combines multiple signals:

| Component | Weight | Description |
|-----------|--------|-------------|
| Timing Score | 35% | Days until predicted reorder |
| Frequency Score | 25% | Historical order frequency |
| Recency Score | 25% | Days since last order |
| Conversion Score | 15% | Nudge click/conversion history |

---

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

### Profile Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reorder/profile` | POST | Create/update reorder profile |

### Recommendations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reorder/user/:userId` | GET | Get reorder recommendations |
| `/api/reorder/homepage/:userId` | GET | Get homepage recommendations |

### Nudge Tracking

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reorder/nudge/:nudgeId/click` | POST | Track nudge click |
| `/api/reorder/nudge/:nudgeId/convert` | POST | Track conversion |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reorder/analytics` | GET | Get reorder analytics |

---

## Data Models

### ReorderProfile

```typescript
interface ReorderProfile {
  userId: string;
  merchantId: string;
  category: CommerceCategory;
  lastOrderId: string;
  lastOrderDate: Date;
  orderFrequencyDays: number;
  predictedReorderDate: Date;
  reorderScore: number;  // 0-1
  urgency: 'high' | 'medium' | 'low';
  nudgeSent: boolean;
  orderSummary: {
    items: OrderItem[];
    totalValue: number;
    currency: string;
  };
  metrics: {
    totalOrders: number;
    avgOrderValue: number;
    avgQuantity: number;
    favoriteItemId: string;
    favoriteItemName: string;
  };
}
```

### NudgeQueue

```typescript
interface NudgeQueue {
  userId: string;
  merchantId: string;
  nudgeType: NudgeType;
  scheduledFor: Date;
  content: {
    title: string;
    body: string;
    actionText: string;
  };
  channels: NudgeChannel[];
  status: 'pending' | 'sent' | 'clicked' | 'converted' | 'failed';
}
```

### OrderItem

```typescript
interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
}
```

---

## API Examples

### Create Profile

**Request:**
```json
{
  "userId": "user_123",
  "merchantId": "merchant_456",
  "category": "restaurant",
  "orderId": "order_789",
  "items": [
    { "name": "Biryani", "quantity": 2, "price": 299 },
    { "name": "Coke", "quantity": 2, "price": 60 }
  ],
  "orderValue": 718
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "userId": "user_123",
    "merchantId": "merchant_456",
    "reorderScore": 0.72,
    "urgency": "medium",
    "predictedReorderDate": "2026-05-27T10:30:00Z",
    "orderFrequencyDays": 7
  }
}
```

### Get Homepage Recommendations

**Response:**
```json
{
  "success": true,
  "userId": "user_123",
  "personalized": [
    {
      "type": "reorder",
      "category": "restaurant",
      "merchantId": "merchant_456",
      "title": "Order again?",
      "subtitle": "Biryani",
      "score": 0.72,
      "urgency": "medium"
    }
  ],
  "imminent": [
    {
      "type": "imminent_reorder",
      "category": "restaurant",
      "merchantId": "merchant_789",
      "title": "Reorder soon!",
      "subtitle": "Due today",
      "score": 0.85,
      "urgency": "high"
    }
  ]
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Service port (default: 4156) |
| `MONGODB_URI` | Yes | MongoDB connection |
| `REDIS_URL` | Yes | Redis connection |
| `INTERNAL_SERVICE_TOKEN` | Yes | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-order-service | Read | Order data |
| RABTUL Notifications | Write | Send nudges |
| REZ-predictive-engine | Read | ML predictions |
| REZ-signal-aggregator | Write | Track signals |

---

## Nudge Types

| Type | Trigger | Description |
|------|---------|-------------|
| `reorder_reminder` | Predicted reorder date | Timely reminder |
| `abandoned_cart` | Cart not converted | Cart recovery |
| `back_in_stock` | Item availability | Stock notification |
| `price_drop` | Price reduction | Deal alert |

---

## Status

- [x] Profile tracking
- [x] Reorder prediction
- [x] Urgency determination
- [x] Nudge queue processing
- [x] Click tracking
- [x] Conversion tracking
- [x] Analytics
- [ ] ML model integration
- [ ] A/B testing for nudges
- [ ] Multi-channel nudges
