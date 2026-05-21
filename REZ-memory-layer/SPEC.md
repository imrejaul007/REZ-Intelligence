# REZ Memory Layer - SPEC.md

**Version:** 1.0.0
**Port:** 4201
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Unified Customer Timeline Service that aggregates and stores customer events across all REZ applications. Provides a centralized event store with timeline reconstruction capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ Memory Layer                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Event Consumer    → Consume events from event bus                    │
│  ├── Timeline Builder  → Reconstruct user timelines                        │
│  ├── Cache Service     → Redis caching for fast retrieval                  │
│  └── Event Store      → MongoDB persistent storage                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Flow:                                                                │
│  Event Bus → Event Consumer → Event Store → Cache → Timeline API            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Timeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timeline/:userId` | Get user timeline |
| GET | `/api/timeline/:userId/category/:category` | Get timeline by category |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events` | Ingest new event |
| POST | `/api/events/batch` | Batch ingest events |
| GET | `/api/events/:userId` | Query user events |

---

## Data Models

### TimelineEvent
```
{
  userId: string
  category: 'purchase' | 'browse' | 'search' | 'engagement' | 'support'
  eventType: string
  timestamp: Date
  data: Record<string, any>
  metadata: {
    source: string
    sessionId?: string
    deviceId?: string
  }
}
```

### UserProfile
```
{
  userId: string (unique)
  lastEventTimestamp: Date
  preferences: Record<string, any>
  segments: string[]
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "compression": "^1.7.4",
  "express-rate-limit": "^7.1.5"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Event Bus | Read | Consume customer events |
| REZ Profile Service | Write | Update user profiles |
| All Services | Read | Timeline queries |

---

## Metrics (Prometheus)

- `rez_memory_layer_uptime_seconds`
- `rez_memory_heap_used_bytes`
- `rez_mongodb_status`
- `rez_event_consumer_connected`
- `rez_event_consumer_subscriptions`

---

## Status

- [x] Service foundation
- [x] Event consumer
- [x] Timeline API
- [x] Redis caching
- [x] Prometheus metrics
