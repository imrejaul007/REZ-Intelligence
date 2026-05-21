# REZ Realtime Gateway - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Real-time

---

## Overview

WebSocket gateway for real-time events. Provides low-latency WebSocket connections for pushing real-time updates to clients.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Realtime Gateway                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: WebSocket (ws)                                                 │
│  Features:                                                                │
│  ├── Event Broadcasting → Push events to clients                         │
│  ├── Connection Management → Track active connections                   │
│  ├── Room Support    → Topic-based subscriptions                        │
│  └── Redis Pub/Sub  → Scale across instances                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Events

### Server → Client
| Event | Description |
|-------|-------------|
| `event` | General event broadcast |
| `update` | Data update notification |
| `alert` | Alert notification |

### Client → Server
| Event | Description |
|-------|-------------|
| `subscribe` | Subscribe to topic |
| `unsubscribe` | Unsubscribe from topic |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "ws": "^8.16.0",
  "redis": "^4.6.0"
}
```

---

## Status

- [x] Service foundation
- [ ] WebSocket server
- [ ] Event broadcasting
- [ ] Room management
- [ ] Redis pub/sub
