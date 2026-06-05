# REZ Neighborhood Analytics

Hyperlocal intelligence - neighborhood analytics, footfall prediction, and demand forecasting.

## Features

- **Neighborhood Profiling** - Demographics, infrastructure, competition density
- **Footfall Prediction** - AI-powered foot traffic forecasting
- **Demand Signals** - Real-time event, weather, and traffic intelligence
- **Location Insights** - Competitive landscape and market analysis
- **Trend Analysis** - Historical footfall patterns

## Signal Types

- **Event** - Concerts, festivals, sports events
- **Weather** - Rain, heat waves, holidays
- **Traffic** - Metro opening, road construction
- **Seasonal** - Monsoon, summer, festivals
- **Competitor** - New entrants, closures
- **Demographic** - Population shifts, office openings

## API Endpoints

### Get Neighborhood Insights
```bash
GET /api/insights/:neighborhoodId
```

### Generate Footfall Forecast
```bash
POST /api/forecast/footfall
{
  "neighborhoodId": "n_123",
  "merchantId": "m_456",
  "date": "2024-01-20"
}
```

### Create Demand Signal
```bash
POST /api/signals
{
  "neighborhoodId": "n_123",
  "type": "event",
  "name": "Concert at Stadium",
  "impact": {
    "direction": "positive",
    "magnitude": "high",
    "expectedChange": 40
  },
  "timing": {
    "start": "2024-01-25",
    "end": "2024-01-25"
  }
}
```

## Port

Port: **4214**
