# REZ Orchestrator v2 - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Infrastructure

---

## Overview

Main coordinator for all AI agents in the REZ platform. Orchestrates agent communication, manages conversation context, handles task routing, and provides unified agent invocation interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Orchestrator v2                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Agent Router       → Route requests to agents                        │
│  ├── Context Manager   → Conversation context storage                     │
│  ├── Task Queue        → BullMQ async task processing                     │
│  └── Response Aggregator → Merge agent responses                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Agent Types:                                                              │
│  ├── Order Agent      → Order placement, tracking                         │
│  ├── Booking Agent    → Reservations                                     │
│  ├── Support Agent    → Customer support                                 │
│  └── NLU Agent        → Natural language understanding                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Orchestration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orchestrate` | Orchestrate multi-agent request |
| POST | `/api/agents/:name/invoke` | Invoke specific agent |
| GET | `/api/sessions/:id` | Get session context |

### Task Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List pending tasks |
| GET | `/api/tasks/:id` | Get task status |
| POST | `/api/tasks/:id/cancel` | Cancel task |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |
| GET | `/api/agents/status` | Agent status |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "bullmq": "^5.1.0",
  "ioredis": "^5.3.2",
  "axios": "^1.6.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "compression": "^1.7.4",
  "morgan": "^1.10.0"
}
```

---

## Agent Invocation Flow

1. **Request** → Parse user intent
2. **Route** → Identify required agents
3. **Parallel** → Invoke agents concurrently
4. **Aggregate** → Merge responses
5. **Respond** → Return unified response

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Service Connectors | Read/Write | Backend communication |
| REZ Priority Engine | Read | Task prioritization |
| REZ Intelligence Hub | Read | User context |
| All AI Agents | Invoke | Agent coordination |

---

## Status

- [x] Orchestrator foundation
- [x] Agent routing
- [x] Context management
- [x] Task queue
- [x] Response aggregation
