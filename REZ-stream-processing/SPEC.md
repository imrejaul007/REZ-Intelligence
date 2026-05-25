# REZ Stream Processing - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Data Processing

---

## Overview

Real-time data streaming service using Kafka for event processing. Enables real-time analytics, event-driven architectures, and streaming ML inference.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Stream Processing                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Stream Sources:                                                         │
│  ├── User Events    → Clicks, views, searches                           │
│  ├── Transactions  → Orders, payments, refunds                           │
│  ├── System Events → Service health, errors                            │
│  └── IoT Events   → Device data, sensors                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/streams/*                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Processing Types

| Type | Description |
|------|-------------|
| Real-time | Millisecond latency processing |
| Micro-batch | Sub-second aggregation |
| Stateful | Windowed aggregations |
| ML Inference | Real-time scoring |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "kafkajs": "^2.2.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-signal-aggregator | Write | Event ingestion |
| REZ-event-bus | Read | Event publishing |

---

## Status

- [x] Service foundation
- [x] Kafka integration
- [x] Event processing
- [x] Real-time analytics
- [x] Stateful processing
- [ ] ML streaming

## Kafka Topics

| Topic | Purpose |
|-------|---------|
| `commerce.orders` | Order events |
| `commerce.payments` | Payment events |
| `identity.events` | User identity events |
| `engagement.events` | User engagement events |
| `intelligence.signals` | AI/ML signals |
| `geo.events` | Geo location events |
| `notification.events` | Notification events |
| `zevents.bookings` | Z-Events bookings |
| `zevents.checkins` | Z-Events check-ins |
