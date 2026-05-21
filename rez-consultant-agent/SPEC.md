# REZ Consultant Agent - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI consultant agent for providing expert recommendations and guidance. Uses domain knowledge and user context to offer personalized consulting advice.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Consultant Agent                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Expert Recommendations → Domain-specific advice                       │
│  ├── Guidance           → Best practices                                   │
│  ├── Analysis           → Data-driven insights                            │
│  └── Planning           → Strategic recommendations                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Consultation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/consult` | Submit consultation request |
| GET | `/api/consult/:id` | Get recommendation |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Status

- [x] Service foundation
- [x] Recommendations
- [x] Guidance
- [ ] Planning
