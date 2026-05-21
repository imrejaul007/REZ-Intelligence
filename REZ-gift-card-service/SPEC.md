# REZ Gift Card Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce

---

## Overview

Digital gift card service for the REZ platform. Manages gift card issuance, balance tracking, and redemption across the ecosystem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Gift Card Service                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Card Issuance   → Create digital gift cards                         │
│  ├── Balance Management → Track and update balances                       │
│  ├── Redemption      → Redeem at participating merchants                  │
│  └── Transfers      → User-to-user gift card transfers                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Cards
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cards` | Create gift card |
| GET | `/api/cards/:id` | Get card details |
| GET | `/api/cards/:id/balance` | Check balance |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cards/:id/load` | Load value |
| POST | `/api/cards/:id/redeem` | Redeem |
| POST | `/api/cards/:id/transfer` | Transfer |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Service foundation
- [ ] Card issuance
- [ ] Balance management
- [ ] Redemption
- [ ] Transfers
