# REZ Budget Optimizer

AI-powered campaign budget allocation and optimization across channels.

## Features

- **Automatic Budget Allocation** - AI calculates optimal budget distribution based on historical performance
- **Multiple Strategies** - ROAS-based, conversion-based, revenue-based, or balanced
- **Channel Optimization** - Performance-based allocation across Instagram, Facebook, WhatsApp, SMS, Email, Push, Google, DOOH
- **A/B Testing** - Test different allocation strategies with control groups
- **Real-time Optimization** - Continuously optimize based on actual performance

## API Endpoints

### Optimize Budget
```bash
POST /api/optimize
{
  "merchantId": "merchant_123",
  "totalBudget": 100000,
  "strategy": "roas_based",
  "minChannelBudget": 5000
}
```

### Get Channel Performance
```bash
GET /api/channels/performance
```

### Create Campaign
```bash
POST /api/campaigns
{
  "merchantId": "merchant_123",
  "name": "Summer Sale",
  "channel": "instagram",
  "currentBudget": 25000
}
```

### Update Campaign Spend
```bash
PATCH /api/campaigns/:id/spend
{
  "spent": 5000,
  "revenue": 15000,
  "conversions": 50
}
```

## Strategies

1. **ROAS Based** - Allocate more budget to channels with highest Return on Ad Spend
2. **Conversion Based** - Focus on cost per acquisition efficiency
3. **Revenue Based** - Prioritize channels driving most revenue
4. **Balanced** - Mix of all factors

## Response Example

```json
{
  "allocations": [
    {
      "channel": "instagram",
      "amount": 35000,
      "percentage": 35,
      "expectedRoas": 3.5,
      "reason": "High allocation due to strong ROAS performance. Expected ROAS: 3.50x"
    },
    {
      "channel": "whatsapp",
      "amount": 25000,
      "percentage": 25,
      "expectedRoas": 4.2,
      "reason": "Moderate allocation with expected ROAS of 4.20x"
    }
  ],
  "totalBudget": 100000,
  "expectedTotalRoas": 3.2,
  "confidence": 0.85
}
```

## Port

Port: **4290**
