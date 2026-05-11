# REZ ML Model Registry

ML Model Registry Service for managing machine learning models in the REZ platform.

## Overview

The REZ ML Model Registry provides centralized model management:
- Model versioning and storage
- Model deployment and serving
- A/B testing support
- Performance monitoring

## Features

- **Model Registration**: Register and version ML models
- **Model Storage**: Store model artifacts
- **Deployment Management**: Deploy models to production
- **A/B Testing**: Run model experiments
- **Performance Tracking**: Monitor model performance

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5+

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

### Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models` | List all models |
| GET | `/models/:id` | Get model details |
| POST | `/models` | Register new model |
| PUT | `/models/:id` | Update model |
| DELETE | `/models/:id` | Delete model |

### Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models/:id/versions` | List model versions |
| POST | `/models/:id/versions` | Add new version |

### Deployment

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deploy/:modelId/:version` | Deploy model |
| GET | `/deployments` | List deployments |
| GET | `/deployments/:id` | Get deployment status |
| DELETE | `/deployments/:id` | Rollback deployment |

### Experiments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/experiments` | List experiments |
| POST | `/experiments` | Create experiment |
| GET | `/experiments/:id` | Get experiment details |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage Examples

### Register a Model

```bash
curl -X POST http://localhost:4101/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "recommendation-v1",
    "type": "recommendation",
    "description": "Collaborative filtering model",
    "metrics": {
      "precision": 0.85,
      "recall": 0.72
    }
  }'
```

### Deploy Model

```bash
curl -X POST http://localhost:4101/deploy/model123/v1.0.0 \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production",
    "trafficPercentage": 10
  }'
```

## Model Types

| Type | Description |
|------|-------------|
| recommendation | Product recommendation models |
| prediction | General prediction models |
| classification | Classification models |
| detection | Object detection models |
| nlp | Natural language models |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4101 | Service port |
| NODE_ENV | development | Environment |
| MONGODB_URI | - | MongoDB connection string |
| REDIS_URL | - | Redis connection string |
| INTERNAL_SERVICE_TOKENS_JSON | - | Service authentication tokens |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
