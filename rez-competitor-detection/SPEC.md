# REZ Competitor Detection - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Commerce Intelligence

---

## Overview

Competitor detection service that identifies competitor switching behavior, switch triggers, and win-back opportunities. Monitors user behavior patterns to detect when users are considering competitors.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ Competitor Detection                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Detection Types:                                                           │
│  ├── Switch Signals    → User looking at competitors                    │
│  ├── Churn Indicators → Decreased engagement with platform                │
│  ├── Price Sensitivity → Response to competitor pricing                   │
│  └── Win-Back Triggers → Re-engagement opportunities                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detection Signals

| Signal | Description |
|--------|-------------|
| Search Spillover | Users searching outside platform |
| Price Check | Comparing competitor prices |
| Reduced Orders | Declining purchase frequency |
| Negative Sentiment | Complaints, low ratings |
| App Uninstall | App removal intent |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4",
  "redis": "^4.6.10",
  "axios": "^1.6.2",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-signal-aggregator | Read | Behavioral signals |
| REZ-predictive-engine | Read | Churn predictions |

---

## Status

- [x] Service foundation
- [ ] Competitor signal detection
- [ ] Switch trigger analysis
- [ ] Win-back opportunity scoring
- [ ] Competitor intelligence
