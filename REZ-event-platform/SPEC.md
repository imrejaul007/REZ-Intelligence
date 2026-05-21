# REZ Event Platform - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Event Infrastructure

---

## Overview

Central event platform for the REZ ecosystem. Handles event publishing, schema validation, and consumption with BullMQ for job processing and Redis for caching.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Event Platform                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Event Publisher   → Publish events to platform                       │
│  ├── Schema Registry  → Validate event schemas                          │
│  ├── Event Consumer   → Process and route events                        │
│  └── Job Queue (BullMQ) → Async event processing                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Event Types: Commerce, Identity, Engagement, Intelligence              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Categories

| Category | Events |
|----------|--------|
| Commerce | order.*, payment.*, refund.* |
| Identity | user.*, auth.*, session.* |
| Engagement | page.*, search.*, click.* |
| Intelligence | intent.*, churn.*, predict.* |

---

## API Endpoints

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events` | Publish event |
| GET | `/api/events/:id` | Get event |
| POST | `/api/events/batch` | Batch publish |

### Schema
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | List event schemas |
| POST | `/api/schemas` | Register schema |
| GET | `/api/schemas/:name/validate` | Validate event |

### Consumers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/consumers` | List consumers |
| POST | `/api/consumers` | Register consumer |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.23.1",
  "ioredis": "^5.3.2",
  "bullmq": "^5.4.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "swagger-ui-express": "^5.0.1"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All Services | Read | Event publishing |
| REZ-event-bus | Write | Event routing |
| REZ-signal-aggregator | Write | Signal events |

---

## Status

- [x] Service foundation
- [x] Event publishing
- [x] Schema validation
- [ ] Event consumers
- [ ] Job queue processing
- [ ] Event replay
