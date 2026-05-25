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
- [x] Session context
- [x] Device detection
- [x] Location context
- [x] Time context
- [x] Behavioral context
- [x] Weather multipliers
- [x] Holiday calendar (India)
- [x] Traffic multipliers
- [x] Unified context service

## Context Multipliers

### Weather Impact

| Condition | Outdoor | Indoor | Delivery | Ride |
|-----------|--------|--------|----------|------|
| Clear | 1.2x | 0.9x | 0.85x | 1.1x |
| Rain | 0.4x | 1.4x | 1.5x | 1.3x |
| Hot | 0.6x | 1.3x | 1.4x | 1.5x |
| Cold | 0.5x | 1.4x | 1.2x | 1.3x |

### Time Slot Impact

| Slot | Hours | Delivery | Ride | Dining |
|------|-------|----------|------|--------|
| Breakfast | 7-10 | 1.3x | 1.1x | 1.4x |
| Lunch | 12-14 | 1.5x | 1.3x | 1.6x |
| Dinner | 19-22 | 1.6x | 1.4x | 1.8x |
| Late Night | 22-5 | 1.2x | 1.1x | 1.0x |
