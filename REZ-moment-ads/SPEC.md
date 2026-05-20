# REZ Moment Ads - SPEC.md

**Version:** 1.0.0
**Port:** 4111
**Company:** REZ-Intelligence
**Category:** Advertising

---

## Overview

Moment-based advertising engine for real-time ad targeting. Enables advertisers to target users based on real-time context and intent signals.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Moment Ads Engine                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Real-time Targeting → Context-aware ad delivery                        │
│  ├── Moment Detection   → Identify high-intent moments                     │
│  ├── Dynamic Pricing   → Moment-based CPM/CPC                            │
│  ├── Attribution      → Track moment-to-conversion                       │
│  └── Analytics       → Performance by moment type                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Service foundation
- [ ] Real-time targeting
- [ ] Moment detection
- [ ] Dynamic pricing
- [ ] Attribution tracking
- [ ] Analytics dashboard
