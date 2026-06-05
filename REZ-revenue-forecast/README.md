# REZ Revenue Forecast

AI-powered revenue prediction engine for merchants.

## Features

- **Daily Predictions** - Predict today's revenue with confidence intervals
- **Weekly Forecast** - Week-at-a-glance revenue planning
- **Monthly Projections** - Monthly revenue forecasting
- **Campaign Impact** - Predict campaign ROI before launch
- **Trend Alerts** - Get notified of declining trends
- **Seasonal Forecasting** - Account for seasonality and holidays

## Prediction Models

- Ensemble ML (historical + trends + seasonality)
- Day-of-week patterns
- Campaign impact modeling
- Weather correlation

## API Endpoints

### Get Today's Prediction
```bash
GET /api/forecast/:merchantId/today
```

### Get Weekly Forecast
```bash
GET /api/forecast/:merchantId/week
```

### Get Monthly Forecast
```bash
GET /api/forecast/:merchantId/month
```

### Predict Campaign Impact
```bash
POST /api/forecast/campaign-impact
{
  "merchantId": "m_123",
  "campaignType": "cashback",
  "budget": 10000,
  "duration": 7
}
```

### Record Revenue
```bash
POST /api/revenue
{
  "merchantId": "m_123",
  "date": "2024-01-15",
  "revenue": 45000,
  "orders": 120
}
```

## Port

Port: **4213**
