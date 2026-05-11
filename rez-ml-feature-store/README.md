# REZ ML Feature Store

ML Feature Store for serving machine learning features for user, merchant, transaction, and behavioral data.

## Overview

The REZ ML Feature Store provides a centralized repository for machine learning features:
- Feature registration and versioning
- Feature serving for real-time inference
- Feature computation and storage
- Online and offline feature stores

## Features

- **Feature Registry**: Register and manage ML features
- **Feature Serving**: Low-latency feature retrieval
- **Feature Versioning**: Track feature versions and changes
- **Batch Computation**: Pre-compute features for training
- **Online Store**: Real-time feature serving

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Training  │───▶│  Feature   │───▶│  Inference │
│   Pipeline  │    │   Store    │    │   Service  │
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

- Node.js 20+
- MongoDB 7+

### Installation

```bash
npm install
npm run build
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

### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/features` | List all features |
| GET | `/features/:name` | Get feature details |
| POST | `/features` | Register new feature |
| GET | `/features/:name/versions` | Get feature versions |

### Feature Serving

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/serve/:name` | Get feature value |
| POST | `/serve/batch` | Batch feature retrieval |
| GET | `/serve/user/:userId` | Get user features |
| GET | `/serve/merchant/:merchantId` | Get merchant features |

### Feature Computation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/compute` | Compute features |
| GET | `/compute/:name/status` | Get computation status |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Feature Types

| Type | Description |
|------|-------------|
| user | User-related features |
| merchant | Merchant-related features |
| transaction | Transaction features |
| behavioral | User behavior features |
| temporal | Time-based features |

## Usage Examples

### Register a Feature

```bash
curl -X POST http://localhost:4100/features \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_order_count_7d",
    "type": "user",
    "description": "Number of orders in last 7 days",
    "version": "1.0.0"
  }'
```

### Serve Feature

```bash
curl "http://localhost:4100/serve/user_order_count_7d?userId=user123"
```

### Batch Serve Features

```bash
curl -X POST http://localhost:4100/serve/batch \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "features": ["user_order_count_7d", "user_avg_order_value"]
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4100 | Service port |
| NODE_ENV | development | Environment |
| MONGODB_URI | - | MongoDB connection string |
| REDIS_URL | - | Redis connection string |
| INTERNAL_SERVICE_TOKENS_JSON | - | Service authentication tokens |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
