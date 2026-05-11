# REZ AI Plugins

Modular AI plugin registry for the REZ platform.

## Overview

The REZ AI Plugins service provides a centralized registry for AI capabilities that can be shared across all REZ services. It enables:
- Plugin discovery and registration
- Capability sharing across services
- Unified AI interface

## Features

- **Plugin Registry**: Register and discover AI plugins
- **Capability Sharing**: Share AI capabilities across services
- **Base Plugin Interface**: Standard interface for all plugins
- **Dynamic Loading**: Load plugins at runtime

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

### Plugins

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plugins` | List all registered plugins |
| GET | `/plugins/:id` | Get plugin details |
| POST | `/plugins` | Register a new plugin |
| DELETE | `/plugins/:id` | Unregister plugin |

### Capabilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/capabilities` | List all capabilities |
| GET | `/capabilities/:name` | Get capability details |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage

### Import Base Plugin

```typescript
import { BasePlugin } from '@rez/ai-plugins/base-plugin';

class MyPlugin extends BasePlugin {
  async execute(input: any): Promise<any> {
    // Your AI logic here
    return { result: 'processed' };
  }
}
```

### Register Plugin

```bash
curl -X POST http://localhost:4000/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sentiment-analysis",
    "version": "1.0.0",
    "capabilities": ["nlp", "sentiment"]
  }'
```

## Plugin Types

- **NLP**: Natural language processing
- **Image**: Image recognition and generation
- **Prediction**: ML-based predictions
- **Recommendation**: Recommendation engines
- **Sentiment**: Sentiment analysis

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
