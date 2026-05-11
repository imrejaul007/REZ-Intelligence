# REZ Intent Predictor

Real-time user intent prediction service for the REZ platform.

## Overview

The REZ Intent Predictor analyzes user behavior and predicts purchase intent in real-time. It enables:
- Real-time intent detection
- Dormant intent identification
- Purchase probability scoring
- Personalized nudge triggers

## Features

- **Intent Detection**: Identify user intent from browsing, search, and cart behavior
- **Dormant Intent**: Detect purchase intents that have gone cold
- **Probability Scoring**: Calculate purchase probability for each intent
- **Nudge Triggers**: Trigger personalized reminders for high-probability intents
- **Time Decay**: Factor in recency and frequency of intent signals

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │───▶│  Intent    │───▶│   Nudge    │
│  Behavior   │    │  Predictor │    │  Service   │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   MongoDB   │
                   │  (Storage)  │
                   └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Intent Prediction

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/intent/predict` | Predict user intent |
| GET | `/api/intent/:userId` | Get user's active intents |
| GET | `/api/intent/:userId/dormant` | Get dormant intents |

### Intent Signals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signals` | Record intent signal |
| GET | `/api/signals/:userId` | Get user's signals |

### Nudge Triggers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nudges/:userId` | Get nudge recommendations |
| POST | `/api/nudges/:userId/trigger` | Trigger a nudge |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Intent Signal Types

| Signal | Description |
|--------|-------------|
| search | User performed a search |
| view | User viewed a product |
| add_to_cart | User added item to cart |
| remove_from_cart | User removed item from cart |
| wishlist | User added to wishlist |
| checkout_start | User started checkout |
| checkout_complete | User completed purchase |

## Usage Examples

### Record Intent Signal

```bash
curl -X POST http://localhost:4018/api/signals \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "signalType": "view",
    "entityType": "product",
    "entityId": "prod-456",
    "metadata": {
      "category": "electronics",
      "price": 299.99
    }
  }'
```

### Get User Intents

```bash
curl http://localhost:4018/api/intent/user-123
```

### Trigger Nudge

```bash
curl -X POST http://localhost:4018/api/nudges/user-123/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "intent-789",
    "channel": "push",
    "template": "abandoned_cart_reminder"
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4018 | Service port |
| NODE_ENV | development | Environment |
| MONGODB_URI | - | MongoDB connection string |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
