# REZ Feature Flags Service

Centralized feature flag management service for the REZ platform.

## Overview

The REZ Feature Flags Service provides a unified API for managing feature toggles across all REZ services. It enables:
- Feature rollout management
- A/B testing support
- User-specific flag targeting
- Real-time flag updates

## Features

- **Feature Management**: Create, update, and delete feature flags
- **Targeting Rules**: Enable flags for specific users, segments, or percentages
- **Environment Support**: Development, staging, and production environments
- **Real-time Updates**: Webhook notifications when flags change
- **Audit Logging**: Track all flag changes with timestamps and user info

## Quick Start

### Prerequisites

- Node.js 18+
- Redis (optional, for caching)
- MongoDB (optional, for persistence)

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

### Feature Flags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/flags` | List all feature flags |
| GET | `/flags/:key` | Get flag by key |
| POST | `/flags` | Create new flag |
| PUT | `/flags/:key` | Update flag |
| DELETE | `/flags/:key` | Delete flag |

### Flag Evaluation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/flags/:key/evaluate` | Evaluate flag for user |
| POST | `/flags/:key/evaluate` | Bulk evaluate flags |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage Examples

### Create a Feature Flag

```bash
curl -X POST http://localhost:4030/flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new_checkout_flow",
    "description": "Enable new checkout experience",
    "enabled": true,
    "rolloutPercentage": 10,
    "targetUsers": []
  }'
```

### Evaluate a Flag

```bash
curl http://localhost:4030/flags/new_checkout_flow/evaluate?userId=user123
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4030 | Service port |
| NODE_ENV | development | Environment |
| REDIS_URL | - | Redis connection string |
| MONGODB_URI | - | MongoDB connection string |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`. Connect your GitHub repository to Render and deploy.

## License

MIT
