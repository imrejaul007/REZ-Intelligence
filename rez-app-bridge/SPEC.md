# REZ App Bridge - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Bridge service connecting REZ Consumer App to the Orchestrator. Handles Firebase integration, real-time communication via Socket.IO, and routes app events to appropriate agents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ App Bridge                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Integrations:                                                          │
│  ├── Firebase     → Push notifications                                 │
│  ├── Socket.IO  → Real-time communication                            │
│  └── Orchestrator → Agent routing                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Bridge
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bridge/event` | Bridge app event |
| GET | `/api/bridge/status` | Get connection status |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/push` | Send push notification |
| GET | `/api/fcm/token` | Register FCM token |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "redis": "^4.6.12",
  "socket.io": "^4.7.2",
  "firebase-admin": "^12.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Firebase | Write | Push notifications |
| REZ Orchestrator | Invoke | Agent routing |
| REZ Event Bus | Write | Event emission |

---

## Status

- [x] Bridge foundation
- [x] Firebase integration
- [x] Socket.IO server
- [x] Push notifications
- [x] Agent routing
