# REZ Fraud Detection Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Security

---

## Overview

Real-time fraud prevention service for the REZ platform. Analyzes transactions and user behavior to detect and prevent fraudulent activities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ Fraud Detection Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Detection Types:                                                         │
│  ├── Transaction Fraud  → Payment fraud, card testing                     │
│  ├── Account Fraud     → Fake accounts, account takeover                  │
│  ├── Behavioral Fraud  → Unusual patterns, bot detection                  │
│  └── Velocity Fraud    → Rapid-fire transactions                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Risk Levels: Low (0-0.3) | Medium (0.3-0.6) | High (0.6-0.8) | Critical (0.8+) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Assessment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assess` | Assess transaction risk |
| GET | `/api/assess/:transactionId` | Get assessment |

### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | List fraud rules |
| POST | `/api/rules` | Create rule |

### Cases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cases` | List fraud cases |
| GET | `/api/cases/:id` | Case details |
| POST | `/api/cases/:id/action` | Take action |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.10"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-payment-service | Read | Transaction data |
| REZ-identity-graph | Read | User identity |

---

## Status

- [x] Service foundation
- [ ] Transaction scoring
- [ ] Rule engine
- [ ] Case management
- [ ] ML models
