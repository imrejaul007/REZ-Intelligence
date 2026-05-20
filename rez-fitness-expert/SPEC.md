# REZ Fitness Expert - SPEC.md

**Version:** 1.0.0
**Port:** 3010
**Company:** REZ-Intelligence
**Category:** Expert Agents

---

## Overview

Purpose-built AI fitness expert agent for workout planning, fitness recommendations, and progress tracking. Provides personalized fitness guidance through conversational interface.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Fitness Expert Agent                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── AI Chat         → Conversational fitness guidance                     │
│  ├── Workout Plans  → Personalized workout routines                        │
│  ├── Exercise Library → Searchable exercise database                       │
│  ├── Progress Tracking → Track fitness metrics over time                    │
│  └── Recommendations → AI-powered fitness suggestions                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed health with memory stats |
| GET | `/health/ready` | Readiness probe |
| POST | `/api/v1/fitness/chat` | Chat with fitness expert |
| POST | `/api/v1/fitness/workout-plan` | Generate workout plan |
| GET | `/api/v1/fitness/exercises` | Get exercises |
| POST | `/api/v1/fitness/progress` | Track fitness progress |

---

## Dependencies

```json
{
  "express": "^4.19.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "compression": "^1.7.4",
  "express-rate-limit": "^7.2.0",
  "zod": "^3.22.4",
  "winston": "^3.12.0",
  "uuid": "^9.0.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3010 | Service port |
| NODE_ENV | development | Environment |
| ALLOWED_ORIGINS | localhost:3000 | CORS origins |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate limit window |
| RATE_LIMIT_MAX_REQUESTS | 100 | Max requests per window |

---

## Status

- [x] Service foundation
- [ ] AI chat interface
- [ ] Workout plan generation
- [ ] Exercise library
- [ ] Progress tracking
- [ ] Fitness recommendations
