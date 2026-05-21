# REZ Core Brain - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Infrastructure

---

## Overview

Global intelligence layer for all REZ agents. Provides centralized memory, context management, personalization engine, and cross-agent learning. The "brain" that connects all AI agents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Core Brain                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Memory Store     → Long-term user memory                           │
│  ├── Context Engine  → Conversation context                            │
│  ├── Personalization → User preference learning                         │
│  └── Cross-Agent Hub → Share insights between agents                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/memory/store` | Store memory |
| GET | `/api/memory/:userId` | Get user memories |
| DELETE | `/api/memory/:memoryId` | Delete memory |

### Context
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/context/create` | Create context |
| GET | `/api/context/:sessionId` | Get context |
| PATCH | `/api/context/:sessionId` | Update context |

### Personalization
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personalize/:userId` | Get preferences |
| POST | `/api/personalize/:userId/learn` | Learn preferences |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.2.0",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All AI Agents | Read/Write | Memory & context |
| REZ User Agents | Read/Write | Personalization |
| REZ Intent Graph | Read | Intent signals |

---

## Status

- [x] Service foundation
- [x] Memory store
- [x] Context engine
- [x] Personalization
- [x] Cross-agent hub
