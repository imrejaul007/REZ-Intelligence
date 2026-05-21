# REZ Realtime Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Real-time

---

## Overview

Real-time WebSocket service for live activities. Enables push notifications, live updates, and real-time user engagement across the REZ ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Realtime Service                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: WebSocket via Socket.IO                                       │
│  Features:                                                                │
│  ├── Real-time Updates → Live data push to clients                       │
│  ├── Presence Tracking → Online/offline status                          │
│  ├── Room Management → Topic-based subscriptions                        │
│  └── Event Broadcasting → System-wide notifications                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ room: string }` | Join a room |
| `leave-room` | `{ room: string }` | Leave a room |
| `subscribe` | `{ channel: string }` | Subscribe to channel |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `live-update` | `{ type, data }` | Real-time update |
| `notification` | `{ message }` | Push notification |
| `presence-update` | `{ userId, status }` | Presence change |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.4",
  "ioredis": "^5.3.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All Services | Write | Push real-time updates |
| REZ-signal-aggregator | Read | Live signals |

---

## Status

- [x] Service foundation
- [x] WebSocket server
- [ ] Room management
- [ ] Presence tracking
- [ ] Event broadcasting
