# REZ Event Connector - SPEC.md

**Version:** 1.0.0
**Port:** 4158
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Event connector service that integrates REZ-event-platform with REZ-identity-graph and REZ-memory-engine. Processes events from multiple app sources and maintains cross-platform identity and memory.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Event Connector                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Event Flow:                                                               │
│  Event Platform → Event Connector → Identity Graph                       │
│                            └→ Memory Engine                               │
│                                                                             │
│  Supported Sources: REZ, WASIL, HABIXO, KARMA, Merchant OS                 │
│  Memory Types: Short-term, Long-term, Episodic, Semantic, Identity        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Types

| Event | Description | Actions |
|-------|-------------|---------|
| `user.signup` | User registration | Create identity, initialize memory |
| `order.completed` | Order placed | Update stats, store purchase history |
| `payment.completed` | Payment success | Store payment in memory |
| `search` | Search query | Store for personalization |
| `page.view` | Page navigation | Track engagement |
| `profile.update` | Profile change | Sync to identity graph |
| `session.start` | Session begins | Create session in memory |
| `session.end` | Session ends | Complete session tracking |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/ready` | Readiness probe |
| GET | `/metrics` | Service metrics |
| POST | `/api/events` | Ingest single event |
| POST | `/api/events/batch` | Batch event ingestion |
| GET | `/api/schemas` | Event schema documentation |

---

## Circuit Breaker

Protects against cascading failures when calling downstream services:
- **Identity Graph**: Threshold 5 failures, 60s timeout
- **Memory Engine**: Threshold 5 failures, 60s timeout
- **Event Platform**: Threshold 5 failures, 60s timeout

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "axios": "^1.6.5",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.0"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| MONGODB_URI | Yes | MongoDB connection |
| REDIS_URL | Yes | Redis connection |
| PORT | Yes | Service port |
| IDENTITY_GRAPH_URL | Yes | Identity graph service URL |
| MEMORY_ENGINE_URL | Yes | Memory engine service URL |
| EVENT_PLATFORM_URL | Yes | Event platform URL |
| INTERNAL_SERVICE_TOKEN | Yes | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-identity-graph | Write | Identity resolution, profile updates |
| REZ-memory-engine | Write | Memory storage, taste profiles |
| REZ-event-platform | Read | Event polling |

---

## Status

- [x] Service foundation
- [x] Event type schemas
- [x] Circuit breaker
- [x] Event deduplication
- [ ] Identity graph integration
- [ ] Memory engine integration
- [ ] Batch processing
