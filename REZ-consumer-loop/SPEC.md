# REZ Consumer Loop - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce

---

## Overview

Demonstrates the QR Scan → Order → Reorder flywheel for the REZ consumer ecosystem. Shows the customer lifecycle from initial discovery through repeat purchases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ Consumer Loop                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Flywheel Stages:                                                         │
│  ├── QR Scan      → Discovery via QR code                              │
│  ├── First Order  → Initial purchase                                     │
│  ├── Engagement   → App install, profile completion                    │
│  ├── Repeat Order → Habit formation through reorder                     │
│  └── Loyalty      → Long-term customer value                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Key Metrics:                                                             │
│  ├── Scan-to-Install Rate                                             │
│  ├── Install-to-Order Rate                                             │
│  └── Repeat Order Rate                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flywheel Flow

```
QR Scan → Page View → Cart → First Order → Reorder → Loyalty
   ↓          ↓          ↓        ↓          ↓         ↓
Discovery → Browse → Decide → Convert → Retain → Advocate
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "uuid": "^9.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-qr-campaigns | Read | QR scan data |
| REZ-orders | Read | Order history |
| REZ-reorder-engine | Read | Reorder predictions |
| REZ-loyalty | Read | Loyalty data |

---

## Status

- [x] Service foundation
- [ ] Flywheel tracking
- [ ] Stage analytics
- [ ] Conversion metrics
- [ ] Loop optimization
