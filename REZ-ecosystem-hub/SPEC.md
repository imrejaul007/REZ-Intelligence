# REZ Ecosystem Hub - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Central integration hub connecting REZ Intelligence, REZ Media, RABTUL platform, and CorpPerks. Provides unified data flows and cross-company intelligence sharing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Ecosystem Hub                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Connected Platforms:                                                      │
│  ├── REZ Intelligence → AI/ML services                                  │
│  ├── REZ Media       → Ads, Karma, DOOH                                 │
│  ├── RABTUL         → Auth, Wallet, Payments                          │
│  └── CorpPerks       → Enterprise rewards                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/connect/*, /api/sync/*                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Flows

| From | To | Data |
|------|-----|------|
| REZ Media | RABTUL | Ad engagement → Loyalty |
| CorpPerks | REZ Intelligence | Employee data → Predictions |
| RABTUL | REZ Media | Purchase → Targeting |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Intelligence | Read/Write | AI services |
| REZ Media | Read/Write | Ad campaigns |
| RABTUL Platform | Read/Write | Platform services |
| CorpPerks | Read | Employee data |

---

## Status

- [x] Service foundation
- [ ] Cross-platform integration
- [ ] Data synchronization
- [ ] Unified reporting
- [ ] Privacy controls
