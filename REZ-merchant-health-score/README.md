# REZ Merchant Health Score Service

Composite merchant health score based on revenue, churn, engagement, and growth.

## Features

- **Multi-dimensional Scoring** - Revenue, Customer, Engagement, Growth, Operational
- **Risk Detection** - Automatic alerts for churn, decline, low engagement
- **Industry Benchmarking** - Compare against industry peers
- **Tier Classification** - Platinum, Gold, Silver, Bronze, At-Risk
- **Historical Tracking** - Track score changes over time

## Scoring Components

| Component | Weight | Metrics |
|-----------|--------|---------|
| Revenue | 30% | Target achievement, trend |
| Customer | 25% | Churn, retention, acquisition |
| Engagement | 20% | Loyalty, referrals, reviews |
| Growth | 15% | MRR growth, customer growth |
| Operational | 10% | Fulfillment, delivery time |

## API Endpoints

### Calculate Health Score
```bash
POST /api/score
{
  "merchantId": "merchant_123",
  "industry": "restaurant",
  "revenue": { "current": 500000, "previous": 450000, "target": 600000 },
  "customers": { "total": 1000, "new": 100, "active": 700, "churned": 50, "returning": 600 },
  "engagement": { "loyaltyMembers": 300, "referrals": 50, "reviews": 200, "avgRating": 4.5, "positiveReviews": 180 },
  "operational": { "avgOrderValue": 500, "ordersPerDay": 100, "fulfillmentRate": 95, "avgDeliveryTime": 35, "complaints": 3 }
}
```

## Response Example

```json
{
  "merchantId": "merchant_123",
  "score": 78,
  "tier": "gold",
  "components": {
    "revenue": { "score": 82, "trend": 11.1, "benchmark": 70 },
    "customer": { "score": 75, "newCustomers": 100, "returningCustomers": 600, "churnRate": 5 },
    "engagement": { "score": 80, "loyaltyMembers": 300, "referralRate": 5, "reviewScore": 4.5 },
    "growth": { "score": 85, "mrrGrowth": 11.1, "customerGrowth": 11.1, "aovGrowth": 0 },
    "operational": { "score": 88, "avgOrderTime": 35, "fulfillmentRate": 95, "complaintRate": 3 }
  },
  "risks": [],
  "industry": "restaurant",
  "industryRank": 15,
  "industryPercentile": 85
}
```

## Tiers

| Tier | Score Range | Description |
|------|-------------|-------------|
| Platinum | 90-100 | Top performers |
| Gold | 75-89 | Strong performers |
| Silver | 60-74 | Average performers |
| Bronze | 40-59 | Needs improvement |
| At-Risk | 0-39 | Critical attention needed |

## Risk Detection

The service automatically detects:
- High churn (>20%)
- Revenue decline (>20%)
- Low engagement (<40)
- Quality issues (>5% complaints)
- Low loyalty participation (<10%)

## Port

Port: **4293**
