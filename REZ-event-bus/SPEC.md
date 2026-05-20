# REZ Event Bus - SPEC.md

**Version:** 1.0.0
**Port:** 4082
**Company:** REZ-Intelligence
**Category:** Event Streaming

---

## Overview

Shared event bus service for REZ Agent OS v3. Provides centralized event routing using Redis pub/sub for real-time delivery and Kafka for durable event streaming. Supports schema validation, dead letter queues, and multi-subscriber patterns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Event Bus (4082)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Event Transport:                                                            │
│  ├── Redis Pub/Sub     → Low-latency real-time events (< 10ms)             │
│  └── Kafka Producer    → Durable event streaming with replay                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                               │
│  ├── Schema Registry    → Event type validation                            │
│  ├── Dead Letter Q     → Failed event handling                            │
│  ├── Multi-subscriber  → Multiple consumers per event                      │
│  └── Event Replay      → Kafka replay for recovery                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /events/*, /subscriptions/*                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Categories

```
commerce.*      → Orders, payments, refunds, fulfillment
identity.*      → User creation, login, linking
loyalty.*       → Points, tiers, rewards
engagement.*    → Page views, clicks, shares, QR scans
intelligence.*  → Intent, churn, predictions, segments
support.*       → Tickets, CSAT, sentiment
media.*         → Ad impressions, conversions, views
notification.*  → Sent, opened, clicked
agent.*         → Autonomous agent actions
dooh.*          → Screen impressions, QR scans
```

---

## API Endpoints

### Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events/publish` | POST | Publish an event to Redis + Kafka |
| `/events/types` | GET | List all registered event types |
| `/events/schema/:type` | GET | Get schema for event type |

### Subscriptions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/subscriptions` | GET | List active subscriptions |
| `/subscriptions` | POST | Create new subscription |
| `/subscriptions/:id` | DELETE | Remove subscription |
| `/subscriptions/:id/pause` | POST | Pause subscription |
| `/subscriptions/:id/resume` | POST | Resume subscription |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Full health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |

### Stats

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stats` | GET | Event bus statistics |

---

## Event Schema

### Publish Event

**Request:**
```json
{
  "type": "commerce.order.completed",
  "payload": {
    "orderId": "order_123",
    "userId": "user_456",
    "total": 999,
    "items": ["prod_1", "prod_2"]
  },
  "metadata": {
    "source": "rez-order-service",
    "correlationId": "corr_abc"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "evt_xyz789",
  "publishedAt": "2026-05-20T10:30:00Z",
  "subscribers": 3
}
```

### Create Subscription

**Request:**
```json
{
  "name": "order-tracking",
  "eventTypes": ["commerce.order.*"],
  "filter": {
    "userId": "user_456"
  },
  "endpoint": "http://localhost:4006/webhook"
}
```

---

## Data Models

### Event

```typescript
interface Event {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  metadata: {
    source: string;
    timestamp: Date;
    correlationId?: string;
    causationId?: string;
  };
  publishedAt: Date;
}
```

### Subscription

```typescript
interface Subscription {
  id: string;
  name: string;
  eventTypes: string[];
  filter?: Record<string, unknown>;
  endpoint: string;
  status: 'active' | 'paused' | 'failed';
  createdAt: Date;
}
```

### Dead Letter Event

```typescript
interface DeadLetterEvent {
  originalEvent: Event;
  error: string;
  attempts: number;
  lastAttempt: Date;
  status: 'pending' | 'retrying' | 'failed';
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "ioredis": "^5.3.2",
  "kafkajs": "^2.2.4",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.1",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "compression": "^1.7.4"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4082 | Service port |
| `REDIS_URL` | redis://localhost:6379 | Redis connection |
| `KAFKA_BROKERS` | localhost:9092 | Kafka broker addresses |
| `KAFKA_TOPIC` | rez-events | Default Kafka topic |
| `CORS_ORIGINS` | * | Allowed CORS origins |
| `NODE_ENV` | development | Environment |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All REZ Services | Write | Event producers |
| REZ-signal-aggregator | Read | Signal ingestion |
| REZ-care-service | Read | Support events |
| REZ-analytics | Read | Analytics events |

---

## Performance Characteristics

| Metric | Target |
|--------|--------|
| Redis pub/sub latency | < 5ms |
| Kafka produce latency | < 50ms |
| Event throughput | 10,000 events/sec |
| Subscriber capacity | 1,000 concurrent |

---

## Status

- [x] Redis pub/sub integration
- [x] Kafka producer
- [x] Event publishing
- [x] Subscription management
- [x] Schema validation
- [x] Health checks
- [x] Request logging
- [x] Graceful shutdown
- [ ] Dead letter queue UI
- [ ] Event replay API
- [ ] Schema registry UI
