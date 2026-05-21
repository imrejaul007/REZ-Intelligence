# REZ Retail Expert - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for retail and shopping domain. Provides product search, personalized recommendations, sizing assistance, and shopping guidance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Retail Expert                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Product Search        → Natural language search                      │
│  ├── Recommendations      → Personalized suggestions                      │
│  ├── Sizing Assistance    → Size guides, fit help                       │
│  └── Shopping Guidance     → Compare, review, buy                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Retail
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/retail/search` | Search products |
| POST | `/api/retail/recommend` | Get recommendations |
| POST | `/api/retail/sizing` | Get sizing help |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.19.2",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "zod": "^3.22.4",
  "winston": "^3.12.0",
  "express-rate-limit": "^7.2.0",
  "compression": "^1.7.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Intent Graph | Read | Shopping intent |
| RABTUL Catalog | Read | Product catalog |
| RABTUL Order | Write | Order placement |

---

## Status

- [x] Service foundation
- [x] Product search
- [x] Recommendations
- [x] Sizing assistance
- [ ] Price comparison
