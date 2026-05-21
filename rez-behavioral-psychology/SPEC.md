# REZ Behavioral Psychology - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Analytics

---

## Overview

Behavioral psychology scoring service for user personas. Analyzes user behavior patterns and assigns psychological scores to enable personalized engagement strategies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ Behavioral Psychology Service                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Scoring Dimensions:                                                     │
│  ├── Motivation   → Purchase drivers                                      │
│  ├── Engagement  → Activity patterns                                       │
│  ├── Loyalty     → Retention signals                                       │
│  └── Influence   → Social proof sensitivity                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Psychology
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/score` | Calculate persona score |
| GET | `/api/persona/:userId` | Get user persona |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Status

- [x] Service foundation
- [x] Psychology scoring
- [x] Persona classification
- [ ] Influence scoring
