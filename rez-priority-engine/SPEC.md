# REZ Priority Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Priority Hierarchy Engine for REZ Agent OS. Provides intelligent request prioritization and routing based on urgency, business impact, and SLA requirements. Used by autonomous agents to sequence tasks.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Priority Engine                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Priority Dimensions:                                                     │
│  ├── Urgency    → Time-sensitive requests                                  │
│  ├── Business Impact → Revenue/customer impact                             │
│  ├── SLA         → Contractual obligations                                 │
│  └── Dependencies → Task prerequisites                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Rule Types:                                                              │
│  ├── Emergency Rules → P0 critical issues                                  │
│  ├── Payment Rules → Financial transactions                               │
│  └── Domain Rules  → Business-specific priorities                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Priority Levels

| Level | Name | Description | SLA |
|-------|------|-------------|-----|
| P0 | Critical | System down, security breach | Immediate |
| P1 | High | Revenue impact, user blocking | 1 hour |
| P2 | Medium | Degraded experience | 4 hours |
| P3 | Low | Feature requests, improvements | 24 hours |

---

## API Endpoints

### Priority
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/priority/resolve` | Resolve priority for request |
| GET | `/api/priority/queue` | Get prioritized queue |
| POST | `/api/priority/rules` | Add priority rule |

### Request Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Submit request |
| GET | `/api/requests/:id` | Get request status |
| PUT | `/api/requests/:id/priority` | Update priority |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.2.0",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.2.0",
  "crypto-js": "^4.2.0"
}
```

---

## Rule Types

### Emergency Rules
High-priority categories that bypass normal queue:
- Security incidents
- Payment failures
- Data corruption

### Payment Rules
Financial transaction priorities:
- Refund requests (high)
- Settlement requests (critical)
- Chargebacks (critical)

### Domain Rules
Business-specific priority overrides:
- Merchant tier-based priority
- Customer value-based priority
- Contract SLA requirements

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Agent OS | Read/Write | Agent task prioritization |
| REZ Care Service | Write | Support ticket routing |
| RABTUL Payment | Read | Payment priority signals |

---

## Status

- [x] Service foundation
- [x] Priority resolution
- [x] Queue management
- [x] Emergency rules
- [x] Payment rules
- [x] Domain rules
