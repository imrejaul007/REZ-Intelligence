# REZ Culinary Expert - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for restaurant and food ordering domain. Provides menu recommendations, cuisine suggestions, dietary advice, and restaurant assistance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Culinary Expert                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Menu Recommendations  → Personalized dish suggestions               │
│  ├── Cuisine Suggestions  → Based on preferences                         │
│  ├── Dietary Advice      → Health-conscious recommendations              │
│  └── Restaurant Help    → Ordering, reservations                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Culinary
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/food/recommend` | Get food recommendations |
| POST | `/api/restaurant/help` | Restaurant assistance |
| POST | `/api/dietary/check` | Dietary check |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "@rez/shared-types": "file:../rez-shared-types",
  "express": "^4.19.2",
  "mongodb": "^6.5.0",
  "ioredis": "^5.3.2",
  "bullmq": "^5.1.0",
  "zod": "^3.22.4",
  "winston": "^3.12.0"
}
```

---

## Status

- [x] Service foundation
- [x] Menu recommendations
- [x] Cuisine suggestions
- [ ] Dietary advice
- [ ] Restaurant help
