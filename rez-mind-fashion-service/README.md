# ReZ Fashion Mind Service

AI Mind service for fashion businesses providing intelligent insights and predictions.

## Overview

The Fashion Mind Service provides AI-powered intelligence for:
- **Trend Analysis** - Fashion trend predictions and analysis
- **Style Matching** - Customer style profile matching
- **Inventory Optimization** - Demand forecasting and reorder recommendations
- **Size Forecasting** - Size demand prediction
- **Cross-sell Recommendations** - Product pairing suggestions
- **Personalized Fashion Advice** - AI-powered style recommendations

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4063 |
| MONGODB_URI | MongoDB URI | - |
| JWT_SECRET | JWT secret | - |
| INTERNAL_TOKEN | Internal API token | - |
| SESSION_TTL_DAYS | Session TTL | 90 |

## API Endpoints

### Health
- `GET /health` - Service health check
- `GET /health/ready` - Readiness check

### AI Consultation
- `POST /api/v1/consult` - AI consultation chat
- `GET /api/v1/consult/history/:sessionId` - Get session history

### Trend Analysis
- `POST /api/v1/trends/analyze` - Analyze current trends
- `POST /api/v1/trends/predict` - Predict upcoming trends
- `GET /api/v1/trends/seasonal` - Seasonal trend analysis

### Style Matching
- `POST /api/v1/style/match` - Match customer to products
- `GET /api/v1/style/segments` - Get customer segments

### Inventory Optimization
- `POST /api/v1/inventory/optimize` - Get reorder recommendations
- `POST /api/v1/inventory/forecast` - Demand forecasting
- `GET /api/v1/inventory/dead-stock` - Dead stock analysis

## Authentication

JWT Bearer token or X-Internal-Token header.

## Rate Limiting

- AI: 30 requests/minute
- Read: 100 requests/minute

## License

Proprietary - ReZ Platform