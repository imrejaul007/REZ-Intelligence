# REZ Unified Attribution - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Attribution

---

## Overview

Unified Attribution Service that consolidates all attribution models across the REZ ecosystem. Provides single source of truth for attribution data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Unified Attribution Service                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Attribution Models:                                                     │
│  ├── First Touch     → Credit first interaction                         │
│  ├── Last Touch     → Credit last interaction                          │
│  ├── Linear         → Equal credit across touchpoints                   │
│  ├── Time Decay    → More weight to recent interactions                 │
│  ├── Position Based → 40% first, 40% last, 20% middle               │
│  └── Data Driven    → ML-based attribution                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Attribution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attribute` | Attribute conversion |
| GET | `/api/attribution/:conversionId` | Get attribution |

### Models
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/models` | List attribution models |
| POST | `/api/models` | Create custom model |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/channel` | Channel performance |
| GET | `/api/reports/campaign` | Campaign attribution |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.0",
  "zod": "^3.22.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-attribution-loyalty-bridge | Read | Attribution data |
| REZ-analytics | Write | Attribution reports |

---

## Status

- [x] Service foundation
- [ ] Attribution models
- [ ] Conversion tracking
- [ ] Report generation
- [ ] Custom model support
