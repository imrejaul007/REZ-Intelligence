# REZ Event Bus

Central event bus service for the REZ ecosystem with Redis pub/sub and MongoDB.

## Overview

The REZ Event Bus provides a unified event streaming infrastructure that enables:
- Event publishing and subscription
- Real-time event distribution
- Event persistence and replay
- Dead letter queue handling

## Features

- **Event Publishing**: Publish events to named channels
- **Event Subscription**: Subscribe to events by channel or pattern
- **Redis Pub/Sub**: Real-time event distribution via Redis
- **MongoDB Persistence**: Store events for replay and auditing
- **BullMQ Integration**: Queue-based event processing
- **Dead Letter Queue**: Handle failed event processing

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Publisher  │───▶│  Event Bus  │───▶│ Subscriber  │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   MongoDB   │
                   │  (Persist)  │
                   └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   BullMQ    │
                   │  (Process)  │
                   └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5+
- Redis 6+

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
npm run build
npm start
```

## API Endpoints

### Event Publishing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events/publish` | Publish an event |
| POST | `/events/:channel` | Publish to specific channel |

### Event Subscription

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events/subscriptions` | List active subscriptions |
| POST | `/events/subscribe` | Subscribe to channel |
| DELETE | `/events/unsubscribe` | Unsubscribe from channel |

### Event Retrieval

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | Query events |
| GET | `/events/:eventId` | Get event by ID |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Event Format

```typescript
interface Event {
  id: string;
  channel: string;
  type: string;
  payload: any;
  timestamp: Date;
  metadata?: {
    source: string;
    correlationId?: string;
    causationId?: string;
  };
}
```

## Usage Examples

### Publish an Event

```bash
curl -X POST http://localhost:4000/events/publish \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "orders",
    "type": "order.created",
    "payload": {
      "orderId": "ORD-123",
      "customerId": "CUST-456",
      "total": 99.99
    }
  }'
```

### Subscribe to Events

```bash
curl -X POST http://localhost:4000/events/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "orders",
    "callbackUrl": "https://your-service.com/webhook"
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Service port |
| NODE_ENV | development | Environment |
| MONGODB_URI | mongodb://localhost:27017/rez-event-bus | MongoDB connection |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | - | Redis password |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
