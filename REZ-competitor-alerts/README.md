# REZ Competitor Alerts Service

Real-time competitor monitoring - pricing, campaigns, and market intelligence.

## Features

- **Price Monitoring** - Track competitor pricing changes
- **Campaign Tracking** - Detect competitor promotions and offers
- **Review Monitoring** - Track ratings and sentiment
- **Smart Alerts** - Automatic alerts with severity levels
- **Counter-Strategies** - AI-powered recommendations

## Alert Types

| Type | Description | Severity |
|------|-------------|----------|
| price_drop | Significant price reduction | Medium-High |
| new_offer | New promotional offer | Medium |
| campaign | Marketing campaign detected | Medium-High |
| review_drop | Customer reviews declining | High |
| rating_change | Overall rating change | Medium |
| new_location | Competitor expanded | Critical |

## API Endpoints

### Add Competitor
```bash
POST /api/competitors
{
  "merchantId": "merchant_123",
  "name": "Competitor Restaurant",
  "type": "direct",
  "sources": [
    { "type": "google", "url": "https://maps.google.com/..." },
    { "type": "zomato", "url": "https://zomato.com/..." }
  ]
}
```

### Record Prices
```bash
POST /api/prices
{
  "competitorId": "comp_123",
  "merchantId": "merchant_123",
  "items": [
    { "name": "Burger", "price": 199, "originalPrice": 249, "discount": 20 }
  ]
}
```

### Record Campaign
```bash
POST /api/campaigns
{
  "competitorId": "comp_123",
  "merchantId": "merchant_123",
  "platform": "instagram",
  "type": "discount",
  "title": "Summer Sale",
  "discount": 25
}
```

### Get Alerts
```bash
GET /api/alerts/:merchantId?status=new&severity=high
```

## Alert Response Example

```json
{
  "type": "price_drop",
  "severity": "high",
  "title": "Price Drop: Burger",
  "message": "Competitor Restaurant dropped Burger price by 30%",
  "recommendation": "Aggressive price drop detected. Consider: 1) Matching with loyalty bonus, 2) Emphasizing quality and service, 3) Running targeted win-back campaigns."
}
```

## Port

Port: **4295**
