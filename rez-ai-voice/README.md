# REZ AI Voice

Universal voice ordering service for all REZ platform verticals.

## Overview

The REZ AI Voice service provides voice-based ordering capabilities:
- Voice-to-text transcription
- Natural language understanding
- Voice order processing
- Text-to-speech responses

## Features

- **Voice Recognition**: Convert speech to text
- **Order Understanding**: Parse orders from natural speech
- **Confirmation**: Read back order details via TTS
- **Multi-language**: Support for multiple languages
- **Error Handling**: Graceful handling of voice recognition errors

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

### Voice Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/process` | Process voice input |
| POST | `/api/voice/text` | Process text input |

### Order Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order from voice |
| GET | `/api/orders/:id` | Get order status |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Usage Examples

### Process Voice Input

```bash
curl -X POST http://localhost:4000/api/voice/process \
  -H "Content-Type: application/json" \
  -d '{
    "audioData": "base64-encoded-audio",
    "userId": "user-123",
    "language": "en"
  }'
```

### Process Text Input

```bash
curl -X POST http://localhost:4000/api/voice/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I would like to order a large pepperoni pizza",
    "userId": "user-123"
  }'
```

## Supported Verticals

- **Food Delivery**: Restaurant ordering
- **Retail**: Product ordering
- **Services**: Appointment booking

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
