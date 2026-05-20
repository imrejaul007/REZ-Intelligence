# REZ Context Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Context

---

## Overview

Context engine that determines routing context for the REZ commerce platform. Analyzes user session, device, location, and behavior to provide contextual personalization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Context Engine                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Context Sources:                                                          │
│  ├── Session     → Current user session                               │
│  ├── Device     → Mobile/desktop/tablet                               │
│  ├── Location   → GPS, city, timezone                                 │
│  ├── Time       → Time of day, day of week                           │
│  └── Behavior   → Recent actions, preferences                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Context Types

| Context | Description |
|---------|-------------|
| Browsing | Product discovery mode |
| Shopping | Active purchase intent |
| Checkout | Ready to buy |
| Idle | No recent activity |
| Returning | Coming back after absence |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-personalization-engine | Write | Context for personalization |
| REZ-signal-aggregator | Read | Behavioral signals |

---

## Status

- [x] Service foundation
- [ ] Session context
- [ ] Device detection
- [ ] Location context
- [ ] Time context
- [ ] Behavioral context
