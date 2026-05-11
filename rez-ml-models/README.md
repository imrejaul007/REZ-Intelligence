# REZ ML Models

Unified ML services for the REZ platform.

## Overview

The REZ ML Models service provides centralized machine learning capabilities:
- Model inference
- Feature engineering
- Model orchestration

## Features

- **Model Inference**: Run ML model predictions
- **Feature Engineering**: Transform raw data into features
- **Model Orchestration**: Manage ML workflows
- **Batch Processing**: Process large datasets

## Quick Start

### Prerequisites

- Node.js 18+

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

### Inference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/inference/:modelName` | Run model inference |
| POST | `/api/inference/batch` | Batch inference |

### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/features/transform` | Transform features |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage Examples

### Run Inference

```bash
curl -X POST http://localhost:4102/api/inference/recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "context": {
      "time": "evening",
      "location": "home"
    }
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
