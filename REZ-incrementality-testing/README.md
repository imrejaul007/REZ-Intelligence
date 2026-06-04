# REZ Incrementality Testing Service

Measure true campaign lift with randomized control experiments.

## Features

- **Holdout Groups** - Randomize customer selection for control/treatment
- **Statistical Significance** - Z-test with confidence intervals
- **Incrementality Measurement** - True lift beyond baseline
- **ROI Validation** - Real return on campaign investment

## How It Works

1. **Create Experiment** - Define hypothesis and test parameters
2. **Split Audience** - Randomly assign customers to test/control
3. **Run Campaign** - Expose only test group
4. **Measure Results** - Compare conversion rates
5. **Get Recommendations** - Data-driven decisions

## API Endpoints

### Create Experiment
```bash
POST /api/experiments
{
  "merchantId": "merchant_123",
  "name": "WhatsApp vs SMS Campaign",
  "type": "channel",
  "hypothesis": "WhatsApp will outperform SMS by 20%",
  "testGroupPercentage": 50,
  "investment": 10000,
  "startDate": "2024-01-01",
  "endDate": "2024-01-14",
  "minDuration": 7
}
```

### Record Results
```bash
POST /api/experiments/:id/results
{
  "testGroup": {
    "size": 5000,
    "converted": 250,
    "revenue": 125000,
    "conversionRate": 5.0,
    "avgOrderValue": 500
  },
  "controlGroup": {
    "size": 5000,
    "converted": 180,
    "revenue": 90000,
    "conversionRate": 3.6,
    "avgOrderValue": 500
  }
}
```

## Response Example

```json
{
  "results": {
    "testGroup": { ... },
    "controlGroup": { ... },
    "lift": {
      "revenue": 38.9,
      "conversionRate": 38.9,
      "aov": 0
    },
    "statistical": {
      "confidence": 99.2,
      "pValue": 0.008,
      "isSignificant": true
    },
    "roi": 250,
    "incrementalRevenue": 35000
  },
  "recommendations": [
    "✅ Strong positive lift of 38.9%. Scale this campaign!",
    "💰 Expected incremental revenue: ₹35000",
    "🎯 Excellent ROI of 250%. Increase budget allocation."
  ]
}
```

## Port

Port: **4292**
