# REZ Event Bus Service

**Shared Event Bus Service for REZ Agent OS v3**

A high-performance, distributed event bus service that provides real-time event publishing and subscription capabilities using Redis pub/sub and Kafka for durable event streaming.

## Features

- **Multi-Transport Architecture**: Combines Redis pub/sub for real-time delivery with Kafka for durable event streaming
- **Event Schema Validation**: Zod-based validation with predefined event schemas
- **Subscription Management**: Create, update, delete, and query subscriptions
- **Batch Publishing**: Support for atomic batch event publishing
- **Health Monitoring**: Comprehensive health checks for Redis and Kafka
- **Service Authentication**: Internal service token-based authentication
- **Structured Logging**: Winston-based structured logging for production observability
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT signals

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ Event Bus Service                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Express   │───▶│  Publisher  │───▶│   Redis     │     │
│  │   Server    │    │  Service   │    │  Pub/Sub    │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│         │                  │                               │
│         │                  ▼                               │
│         │           ┌─────────────┐                        │
│         │           │   Kafka     │                        │
│         │           │  Producer   │                        │
│         │           └─────────────┘                        │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │  Subscriber │───▶│  Delivery  │                        │
│  │  Service   │    │  Handlers  │                        │
│  └─────────────┘    └─────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Event Types

The following standardized event types are supported:

| Event Type | Category | Description |
|------------|----------|-------------|
| `USER_MESSAGE_RECEIVED` | USER_INTERACTION | User sent a message to the system |
| `USER_MESSAGE_SENT` | USER_INTERACTION | System sent a message to the user |
| `INTENT_DETECTED` | INTENT_PROCESSING | User intent was detected and classified |
| `AGENT_SELECTED` | AGENT_ORCHESTRATION | An agent was selected to handle the request |
| `AGENT_SWITCHED` | AGENT_ORCHESTRATION | Request transferred to a different agent |
| `COLLABORATION_STARTED` | COLLABORATION | Multi-agent collaboration session started |
| `ORDER_CREATED` | BUSINESS_LOGIC | A new order was created |
| `ORDER_COMPLETED` | BUSINESS_LOGIC | An order was completed, cancelled, or refunded |
| `PAYMENT_INITIATED` | PAYMENT | A payment was initiated |
| `PAYMENT_COMPLETED` | PAYMENT | A payment was completed or failed |
| `SERVICE_HEALTH_CHANGED` | HEALTH | Service health status changed |

## Quick Start

### Prerequisites

- Node.js 18+
- Redis 6+
- Kafka 3.x (optional, for durable event streaming)

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

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4082 | Service port |
| `NODE_ENV` | development | Environment |
| `REDIS_URL` | redis://localhost:6379 | Redis connection URL |
| `REDIS_KEY_PREFIX` | rez:event-bus: | Redis key prefix |
| `KAFKA_BROKERS` | kafka:9092 | Kafka broker addresses (comma-separated) |
| `KAFKA_CLIENT_ID` | rez-event-bus | Kafka client ID |
| `KAFKA_GROUP_ID` | rez-event-bus-group | Kafka consumer group ID |
| `INTERNAL_SERVICE_TOKENS_JSON` | {} | JSON map of service tokens |
| `LOG_LEVEL` | info | Logging level |
| `LOG_FORMAT` | json | Log format (json or simple) |
| `EVENT_RETENTION_HOURS` | 168 | Event retention period (7 days) |
| `MAX_EVENT_PAYLOAD_SIZE` | 1048576 | Max payload size (1MB) |
| `MAX_SUBSCRIPTIONS_PER_CLIENT` | 100 | Max subscriptions per client |

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Full health check |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events/publish` | Publish a single event |
| POST | `/events/publish/batch` | Publish multiple events |
| GET | `/events/types` | Get all valid event types |
| GET | `/events/history` | Get event history |
| GET | `/events/:eventId` | Get specific event |
| GET | `/events/stats` | Get publisher statistics |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/subscriptions` | Create subscription |
| GET | `/subscriptions` | List subscriptions |
| GET | `/subscriptions/:id` | Get subscription |
| PUT | `/subscriptions/:id` | Update subscription |
| DELETE | `/subscriptions/:id` | Delete subscription |
| GET | `/subscriptions/stats` | Get subscription stats |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Service statistics |

## Authentication

All API endpoints (except health checks) require authentication via the `X-Internal-Token` header:

```bash
curl -X POST http://localhost:4082/events/publish \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "eventType": "ORDER_CREATED",
    "payload": {
      "orderId": "ORD-123",
      "customerId": "CUST-456",
      "totalAmount": 99.99
    },
    "source": "order-service"
  }'
```

## Usage Examples

### Publish an Event

```bash
curl -X POST http://localhost:4082/events/publish \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "eventType": "INTENT_DETECTED",
    "payload": {
      "userId": "user-123",
      "intent": {
        "name": "book_hotel",
        "confidence": 0.95,
        "entities": {
          "location": "Paris",
          "checkIn": "2024-06-01",
          "checkOut": "2024-06-05"
        }
      },
      "context": {
        "sessionId": "sess-abc123",
        "previousIntents": ["search_hotel"]
      }
    },
    "source": "intent-service",
    "priority": "high",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Create a Subscription

```bash
curl -X POST http://localhost:4082/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "subscriberId": "notification-service",
    "eventTypes": ["ORDER_CREATED", "PAYMENT_COMPLETED"],
    "url": "https://notification-service.internal/webhook/events",
    "deliveryStrategy": "at_least_once",
    "metadata": {
      "description": "Order and payment notifications",
      "maxRetries": 3,
      "timeoutMs": 30000
    }
  }'
```

### Query Event History

```bash
curl -X GET "http://localhost:4082/events/history?eventType=ORDER_CREATED&limit=50" \
  -H "X-Internal-Token: your-service-token"
```

## Testing

```bash
npm test
```

## License

MIT
