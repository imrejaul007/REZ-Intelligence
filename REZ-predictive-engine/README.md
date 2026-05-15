# REZ Predictive Engine Service

AI-powered prediction service for customer analytics including churn probability, lifetime value (LTV), next order prediction, and conversion likelihood.

## Features

- **Churn Prediction**: Identify customers at risk of churning with retention recommendations
- **Lifetime Value (LTV)**: Predict customer value over 30, 90, and 365 days
- **Revisit Prediction**: Forecast when customers are likely to return
- **Conversion Prediction**: Predict likelihood of converting to paying customers
- **Batch Processing**: Process multiple predictions at once
- **At-Risk Segments**: Identify and retrieve at-risk customer segments

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis (optional, for caching)

### Installation

```bash
cd REZ-predictive-engine
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Individual Predictions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict/:userId/churn` | GET | Churn prediction for a user |
| `/predict/:userId/ltv` | GET | LTV prediction for a user |
| `/predict/:userId/revisit` | GET | Revisit prediction for a user |
| `/predict/:userId/conversion` | GET | Conversion prediction for a user |
| `/predict/:userId/all` | GET | All predictions for a user |

### Batch & Segments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict/batch` | POST | Batch predictions for multiple users |
| `/predict/segments/at-risk` | GET | Get at-risk users list |
| `/predict/segments/high-value` | GET | Get high-value customers |
| `/predict/segments/churned` | GET | Get churned customers |

### Health & Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/health/ready` | GET | Readiness check |
| `/health/live` | GET | Liveness check |

## Response Examples

### Churn Prediction Response

```json
{
  "userId": "user123",
  "type": "churn",
  "score": 72,
  "probability": 0.72,
  "confidence": 0.85,
  "result": {
    "risk": "HIGH",
    "daysUntilChurn": 14,
    "topFactors": [
      "No order in 28 days",
      "Declining order frequency",
      "Low average order value"
    ],
    "retentionOffers": [
      "20% off next order",
      "Free delivery on next purchase",
      "Loyalty points bonus"
    ]
  },
  "recommendation": "Immediate retention campaign recommended",
  "timestamp": "2026-05-16T10:30:00Z"
}
```

### LTV Prediction Response

```json
{
  "userId": "user123",
  "type": "ltv",
  "score": 85,
  "probability": 0.85,
  "confidence": 0.78,
  "result": {
    "predictedLTV30": 2500,
    "predictedLTV90": 7200,
    "predictedLTV365": 28000,
    "tier": "GOLD",
    "confidence": 0.78
  },
  "recommendation": "Priority customer - ensure excellent service",
  "timestamp": "2026-05-16T10:30:00Z"
}
```

## Request Bodies

### Batch Prediction Request

```json
{
  "userIds": ["user1", "user2", "user3"],
  "types": ["churn", "ltv", "revisit"]
}
```

## Authentication

All API requests require the `X-Internal-Token` header:

```bash
curl -X GET http://localhost:4059/predict/user123/churn \
  -H "X-Internal-Token: your-token-here"
```

## Prediction Algorithms

### Churn Scoring (RFM-based)

The churn prediction uses an RFM (Recency, Frequency, Monetary) model:

- **Recency**: Days since last order (higher = more likely to churn)
- **Frequency**: Total order count (lower = more likely to churn)
- **Monetary**: Average order value (lower = more likely to churn)

Risk levels:
- CRITICAL: Score > 70
- HIGH: Score > 50
- MEDIUM: Score > 30
- LOW: Score <= 30

### LTV Calculation

```
LTV = Average Order Value × Orders per Month × Retention Rate × Time Period
```

Customer tiers:
- PLATINUM: LTV > 50000/year
- GOLD: LTV > 20000/year
- SILVER: LTV > 5000/year
- BRONZE: LTV <= 5000/year

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (Port 4059)               │
├─────────────────────────────────────────────────────────────┤
│  Routes: /predict/*, /health/*                             │
│  Middleware: Auth, Rate Limit, Error Handler, Logging      │
├─────────────────────────────────────────────────────────────┤
│                    Prediction Engine                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Churn   │ │   LTV    │ │ Revisit  │ │Conversion│       │
│  │ Predictor│ │ Predictor│ │ Predictor│ │ Predictor│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ User Profile     │  │ Prediction Cache │                │
│  │ Model            │  │ (Redis/DB)       │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4059 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez-predictive-engine |
| `INTERNAL_SERVICE_TOKEN` | Authentication token | - |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## License

MIT
