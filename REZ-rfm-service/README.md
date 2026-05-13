# RFM Segmentation Service

**Port:** 4055
**Purpose:** Customer segmentation based on Recency, Frequency, and Monetary value

---

## Overview

The RFM Segmentation Service calculates customer value scores and segments customers for targeted marketing campaigns. It provides actionable segments for loyalty programs, retention campaigns, and personalized marketing.

## RFM Scoring

### Recency (R) - Days Since Last Purchase

| Score | Days Since Purchase | Meaning |
|-------|---------------------|---------|
| 5 | 0-30 days | Very recent customer |
| 4 | 31-60 days | Recent customer |
| 3 | 61-90 days | Moderate recency |
| 2 | 91-180 days | Lapsed customer |
| 1 | 180+ days | At-risk/churned |

### Frequency (F) - Purchase Count (6 months)

| Score | Orders | Meaning |
|-------|--------|---------|
| 5 | 10+ orders | Frequent buyer |
| 4 | 7-9 orders | Regular buyer |
| 3 | 4-6 orders | Occasional buyer |
| 2 | 2-3 orders | Infrequent buyer |
| 1 | 1 order | One-time buyer |

### Monetary (M) - Total Spend (6 months)

| Score | Total Spend | Meaning |
|-------|------------|---------|
| 5 | ₹10,000+ | High-value customer |
| 4 | ₹5,000-9,999 | Upper-mid customer |
| 3 | ₹2,000-4,999 | Mid-value customer |
| 2 | ₹500-1,999 | Lower-mid customer |
| 1 | ₹0-499 | Low-value customer |

## Customer Segments

| Segment | RFM Code | Count | Strategy |
|---------|----------|-------|----------|
| **Champions** | 555, 554, 544 | Best customers | VIP treatment, early access, exclusive offers |
| **Loyal** | 545, 454, 445 | Frequent buyers | Loyalty programs, upsell, cross-sell |
| **Potential Loyalist** | 435, 345, 325 | Recent, moderate freq | Referral programs, loyalty onboarding |
| **Recent** | 415, 314 | New customers | Onboarding, education, welcome series |
| **Promising** | 414, 212 | Recent, low freq | Nurture campaigns, engagement |
| **Needs Attention** | 433, 343 | Average recency/freq | Reactivation, special offers |
| **At Risk** | 441, 332, 231 | Declining | Win-back campaigns, discounts |
| **Can't Lose Them** | 451, 352 | High value, inactive | Aggressive win-back, personal outreach |
| **Lost** | 111, 112 | Churned | Last resort offers, surveys |
| **Lost Cheap** | 121, 122 | Low value, inactive | Minimal investment, reactivation only |

## API Endpoints

### Scoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rfm/calculate` | Calculate all customer scores |
| POST | `/api/rfm/calculate/:customerId` | Calculate single customer |
| GET | `/api/rfm/scores/:customerId` | Get customer RFM score |

### Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfm/segments` | List all segments with counts |
| GET | `/api/rfm/segments/:segment` | Get segment details |
| GET | `/api/rfm/segments/:segment/customers` | List customers in segment |
| POST | `/api/rfm/segments/:segment/offers` | Create segment offer |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfm/analytics` | Segment analytics |
| GET | `/api/rfm/trends` | RFM trends over time |

## Data Models

### RFMScore

```typescript
interface RFMScore {
  customerId: string;
  recency: {
    score: number;        // 1-5
    daysSincePurchase: number;
    lastPurchaseDate: Date;
  };
  frequency: {
    score: number;        // 1-5
    orderCount: number;
    periodDays: number;
  };
  monetary: {
    score: number;        // 1-5
    totalSpend: number;
    averageOrderValue: number;
  };
  rfmScore: string;       // e.g., "555"
  segment: string;        // e.g., "Champions"
  calculatedAt: Date;
}
```

### Segment

```typescript
interface Segment {
  name: string;
  rfmCodes: string[];      // e.g., ["555", "554", "544"]
  customerCount: number;
  avgOrderValue: number;
  avgRecency: number;
  avgFrequency: number;
  characteristics: string[];
  recommendedStrategy: string;
}
```

## Event Listeners

The service listens to these events for real-time score updates:

```typescript
// Recalculate on new order
'order.completed' → Update customer RFM score

// Adjust for refunds
'order.refunded' → Recalculate (subtract value)

// New customer
'customer.created' → Initial score (R=5, F=1, M=0)
```

## Usage Examples

### Get Customer Score

```bash
curl http://localhost:4055/api/rfm/scores/cust_123
```

Response:
```json
{
  "customerId": "cust_123",
  "recency": {
    "score": 4,
    "daysSincePurchase": 45,
    "lastPurchaseDate": "2026-04-28"
  },
  "frequency": {
    "score": 5,
    "orderCount": 12,
    "periodDays": 180
  },
  "monetary": {
    "score": 5,
    "totalSpend": 15500,
    "averageOrderValue": 1291
  },
  "rfmScore": "455",
  "segment": "Champions"
}
```

### Get Segment Customers

```bash
curl http://localhost:4055/api/rfm/segments/Champions/customers?limit=10
```

Response:
```json
{
  "segment": "Champions",
  "customerCount": 245,
  "customers": [
    { "customerId": "cust_123", "rfmScore": "555", "totalSpend": 25000 },
    { "customerId": "cust_456", "rfmScore": "554", "totalSpend": 18000 }
  ]
}
```

### Calculate All Scores

```bash
curl -X POST http://localhost:4055/api/rfm/calculate
```

## Environment Variables

```bash
# Service
PORT=4055
MONGODB_URI=mongodb://localhost:27017/rez-rfm-service
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# RFM Configuration
RECENCY_PERIOD_DAYS=180      # Period for frequency/monetary
RECENCY_THRESHOLDS=30,60,90,180
FREQUENCY_THRESHOLDS=2,4,7,10
MONETARY_THRESHOLDS=500,2000,5000,10000
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-rfm-service
npm install
cp .env.example .env
npm run dev
```

## Integration Points

| Service | Integration |
|---------|-------------|
| `rez-order-service` | Get order history |
| `REZ-engagement-platform` | Trigger loyalty offers |
| `REZ-journey-service` | Segment-based journeys |
| `REZ-lead-intelligence` | Enhanced lead scoring |

## Marketing Use Cases

### Champions
- VIP early access to sales
- Exclusive product launches
- Personal thank-you messages
- Free shipping on all orders

### At Risk
- Win-back email sequence
- Special "We miss you" discounts
- Reactivation surveys
- Personal outreach calls

### Recent/New Customers
- Welcome email series
- Onboarding education
- First purchase incentives
- Referral program invites

### Lost Customers
- "Is it something we did?" surveys
- Heavy discounts
- "Last chance" offers
- Remove from email list option

## File Structure

```
REZ-rfm-service/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── index.ts
│   ├── services/
│   │   ├── scoringService.ts     # RFM calculation
│   │   ├── segmentService.ts     # Segment assignment
│   │   ├── analyticsService.ts   # Trend analysis
│   │   └── offerService.ts       # Segment offers
│   ├── routes/
│   │   └── index.ts
│   ├── models/
│   │   ├── RFMScore.ts
│   │   └── Segment.ts
│   ├── workers/
│   │   └── batchWorker.ts        # Batch recalculation
│   ├── types/
│   │   └── index.ts
│   └── constants/
│       └── thresholds.ts          # RFM thresholds
├── .env.example
├── package.json
└── README.md
```

## Related Services

- [REZ-engagement-platform](../REZ-Media/REZ-engagement-platform/) - Loyalty programs
- [REZ-journey-service](../REZ-Media/REZ-journey-service/) - Campaign automation
- [REZ-lead-intelligence](../REZ-Media/REZ-lead-intelligence/) - Lead scoring
