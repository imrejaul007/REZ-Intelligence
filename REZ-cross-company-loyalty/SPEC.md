# REZ Cross-Company Loyalty - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Loyalty

---

## Overview

Universal loyalty and rewards system across all REZ companies. Enables cross-company point earning and redemption with unified loyalty infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Cross-Company Loyalty                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Universal Points    → Single points across companies                │
│  ├── Cross-Company Earn  → Earn from any REZ service                     │
│  ├── Cross-Company Redeem → Redeem at any partner                        │
│  ├── Tier Management     → Shared loyalty tiers                          │
│  └── Point Transfer     → User-to-user transfers                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.0",
  "axios": "^1.6.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All REZ Companies | Read/Write | Point transactions |
| REZ-wallet | Write | Point balance |
| REZ-gamification | Read | Karma integration |

---

## Status

- [x] Service foundation
- [ ] Universal points system
- [ ] Cross-company earning
- [ ] Cross-company redemption
- [ ] Tier management
- [ ] Point transfers
