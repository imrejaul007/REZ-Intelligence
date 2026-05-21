# REZ Agent Registry - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Agent Infrastructure

---

## Overview

Central registry for tracking and monitoring all expert agents in the REZ system. Provides agent discovery, health monitoring, and orchestration capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Agent Registry                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                           │
│  ├── Agent Registration  → Track all expert agents                       │
│  ├── Health Monitoring   → Real-time agent status                       │
│  ├── Capabilities Registry → Agent capability discovery                  │
│  └── Orchestration       → Route requests to agents                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Agent Types:                                                            │
│  ├── Expert Agents (Fitness, Salon, Hospitality, etc.)                   │
│  ├── Task Agents (Sales, Fraud, Support, etc.)                           │
│  └── System Agents (Research, Analysis, etc.)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Agent details |
| POST | `/api/agents/register` | Register agent |
| PATCH | `/api/agents/:id` | Update agent |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Registry health |
| GET | `/api/health/agents` | All agent health |

### Capabilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/capabilities` | List capabilities |
| GET | `/api/agents/:id/capabilities` | Agent capabilities |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "node-cron": "^3.0.3"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-autonomous-agents | Write | Agent registration |
| All Expert Agents | Write | Status updates |

---

## Status

- [x] Service foundation
- [ ] Agent registration
- [ ] Health monitoring
- [ ] Capability registry
- [ ] Orchestration routing
