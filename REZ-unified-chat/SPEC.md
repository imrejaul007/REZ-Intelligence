# REZ Unified Chat - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Communication

---

## Overview

Unified chat service that provides a single chat interface for customers across Agent OS and Support Copilot. Enables seamless handoff between AI agents and human support agents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Unified Chat                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Agent OS Chat      → AI-powered conversations                      │
│  ├── Support Chat       → Human agent support                            │
│  ├── Smart Routing      → Agent ↔ Human handoff                        │
│  └── Real-time Updates  → WebSocket notifications                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ws": "^8.16.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-autonomous-agents | Read | AI responses |
| REZ-support-copilot | Read | Support suggestions |
| REZ-care-service | Read/Write | Ticket integration |

---

## Status

- [x] Service foundation
- [ ] Real-time messaging
- [ ] Agent handoff
- [ ] Conversation history
- [ ] Typing indicators
