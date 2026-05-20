# REZ QR Campaigns - SPEC.md

**Version:** 1.0.0
**Port:** 4130
**Company:** REZ-Intelligence
**Category:** Marketing Campaigns

---

## Overview

QR-triggered campaign management service for creating, managing, and tracking QR code-based marketing campaigns. Enables merchants to create offers, track scans, and measure conversion.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ QR Campaigns (4130)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Campaign Types:                                                           │
│  ├── Discount    → Percentage/fixed discounts                             │
│  ├── Loyalty     → Points/membership rewards                              │
│  ├── Discovery   → New product/service exposure                           │
│  └── Feedback    → Customer reviews/surveys                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /campaigns/*, /scan, /redeem                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Campaign Types

| Type | Description |
|------|-------------|
| `discount` | Offer percentage or fixed discounts |
| `loyalty` | Points or membership rewards |
| `discovery` | Introduce new products/services |
| `feedback` | Collect reviews or surveys |

---

## Offer Types

| Type | Description |
|------|-------------|
| `percentage` | X% off (e.g., 20% off) |
| `fixed` | Fixed amount off (e.g., ₹100 off) |
| `free_item` | Free item with purchase |

---

## API Endpoints

### Campaign Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/campaigns` | POST | Create campaign |
| `/campaigns/:id` | GET | Get campaign |
| `/campaigns/:id` | PUT | Update campaign |
| `/campaigns/:id` | DELETE | Delete campaign |
| `/campaigns/:id/activate` | POST | Activate campaign |
| `/campaigns/:id/stats` | GET | Get campaign stats |
| `/campaigns/:id/attribution` | GET | Get attribution report |
| `/merchant/:merchantId/campaigns` | GET | List merchant campaigns |

### Event Tracking

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scan` | POST | Track QR scan |
| `/redeem` | POST | Track redemption |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |

---

## Data Models

### QRCampaign

```typescript
interface QRCampaign {
  campaignId: string;
  name: string;
  merchantId: string;
  type: 'discount' | 'loyalty' | 'discovery' | 'feedback';
  status: 'draft' | 'active' | 'paused' | 'completed';
  qrCode: string;  // Base64 QR image
  offer: {
    type: 'percentage' | 'fixed' | 'free_item';
    value: number;
    minOrder?: number;
    expiresAt?: Date;
  };
  targeting: {
    locations?: string[];
    segments?: string[];
    newUsersOnly?: boolean;
  };
  stats: {
    scans: number;
    redemptions: number;
    conversionRate: number;
    revenue: number;
    repeatRate: number;
  };
}
```

### ScanEvent

```typescript
interface ScanEvent {
  scanId: string;
  campaignId: string;
  userId?: string;
  deviceId?: string;
  location?: string;
  timestamp: Date;
}
```

### RedemptionEvent

```typescript
interface RedemptionEvent {
  redemptionId: string;
  campaignId: string;
  userId: string;
  orderId?: string;
  discount: number;
  timestamp: Date;
}
```

---

## API Examples

### Create Campaign

**Request:**
```json
{
  "name": "Summer Sale",
  "merchantId": "merchant_123",
  "type": "discount",
  "offer": {
    "type": "percentage",
    "value": 20,
    "minOrder": 500
  },
  "targeting": {
    "locations": ["Mumbai", "Delhi"],
    "newUsersOnly": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "campaignId": "qrc_abc123",
    "name": "Summer Sale",
    "qrCode": "data:image/png;base64,...",
    "status": "draft"
  }
}
```

### Track Scan

**Request:**
```json
{
  "campaignId": "qrc_abc123",
  "userId": "user_456",
  "location": "Mumbai"
}
```

**Response:**
```json
{
  "success": true,
  "scanId": "scan_xyz789"
}
```

### Track Redemption

**Request:**
```json
{
  "campaignId": "qrc_abc123",
  "userId": "user_456",
  "orderId": "order_789",
  "discount": 100
}
```

---

## Attribution Metrics

| Metric | Description |
|--------|-------------|
| `totalScans` | Total QR scans |
| `totalRedemptions` | Total coupon redemptions |
| `scanToRedeemRate` | Scans → Redemptions conversion |
| `attributedRevenue` | Revenue from campaign |
| `avgOrderValue` | Average order value |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "qrcode": "^1.5.3",
  "uuid": "^9.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default: 4130) |
| `MONGODB_URI` | MongoDB connection |
| `BASE_URL` | Base URL for QR links |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-creative-engine | Read | Generate offer content |
| REZ-analytics | Write | Track campaign metrics |
| RABTUL-wallet-service | Write | Apply discounts |

---

## Status

- [x] Campaign CRUD
- [x] QR code generation
- [x] Campaign activation
- [x] Scan tracking
- [x] Redemption tracking
- [x] Attribution reporting
- [x] Targeting rules
- [ ] Campaign scheduling
- [ ] A/B testing
- [ ] Personalization
