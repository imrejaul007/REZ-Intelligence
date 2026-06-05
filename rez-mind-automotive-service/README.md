# ReZ Automotive Mind Service

AI Mind service for automotive businesses providing intelligent insights and predictions.

## Overview

The Automotive Mind Service provides AI-powered intelligence for:
- **Vehicle Pricing Optimization** - Market-rate recommendations and pricing strategy
- **Service Prediction** - Predictive maintenance scheduling
- **Customer Lifetime Value** - Customer value scoring and segmentation
- **Inventory Optimization** - Spare parts demand forecasting
- **Lead Scoring** - Prospect qualification and prioritization
- **Marketing Campaigns** - Personalized customer engagement strategies

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port (default: 4061) | Yes |
| MONGODB_URI | MongoDB connection string | Yes |
| JWT_SECRET | JWT authentication secret | Yes |
| INTERNAL_TOKEN | Internal API authentication token | Yes |
| RABTUL_API_KEY | RABTUL notification service API key | Yes |

## API Endpoints

### Health
- `GET /health` - Service health check
- `GET /health/ready` - Readiness check

### AI Consultation
- `POST /api/v1/consult` - AI consultation chat
- `GET /api/v1/consult/history/:sessionId` - Get conversation history

### Pricing Optimization
- `POST /api/v1/pricing/recommend` - Get pricing recommendation
- `POST /api/v1/pricing/analyze` - Analyze market positioning
- `GET /api/v1/pricing/competitors` - Competitor analysis

### Service Predictions
- `POST /api/v1/service/predict` - Predict next service
- `POST /api/v1/service/schedule` - Optimal scheduling recommendations
- `GET /api/v1/service/history/:vehicleId` - Service history analysis

### Lead Scoring
- `POST /api/v1/leads/score` - Score a lead
- `POST /api/v1/leads/bulk-score` - Bulk lead scoring
- `GET /api/v1/leads/priorities` - Get lead priorities

## Authentication

All API endpoints require authentication via:
- JWT Bearer token in Authorization header
- X-Internal-Token header for internal service calls

## Rate Limiting

- AI consultation: 30 requests per minute
- Read operations: 100 requests per minute

## Architecture

```
src/
├── config/          # Configuration and environment validation
├── integrations/     # RABTUL notification integration
├── middleware/      # Auth, error handling, validation, rate limit
├── models/          # Mongoose database models
├── routes/           # Express route handlers
├── services/         # AI business logic
├── types/            # TypeScript interfaces
└── utils/            # Logger and utilities
```

## AI Capabilities

### 1. Vehicle Pricing Optimization
- Compares similar vehicles in market
- Analyzes depreciation curves
- Considers location and condition
- Recommends optimal price range

### 2. Service Prediction
- Analyzes service history patterns
- Considers kilometer intervals
- Monitors part wear indicators
- Predicts maintenance needs

### 3. Customer Lifetime Value
- Segments customers by value
- Predicts purchase patterns
- Identifies cross-sell opportunities
- Estimates retention probability

### 4. Lead Scoring
- Evaluates engagement signals
- Assesses purchase intent
- Prioritizes follow-up actions
- Predicts conversion probability

## License

Proprietary - ReZ Platform