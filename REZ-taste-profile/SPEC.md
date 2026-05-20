# REZ Taste Profile - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Personalization

---

## Overview

Consumer taste and preference intelligence service. Analyzes user behavior to build detailed taste profiles across food, fashion, entertainment, and lifestyle categories for hyper-personalized recommendations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Taste Profile                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Taste Analysis    → Analyze user preferences                       │
│  ├── Category Profiling → Build category-specific profiles              │
│  ├── Preference Learning → ML-based preference extraction                │
│  └── Taste Matching     → Match users to products/merchants           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Taste Categories

| Category | Description |
|----------|-------------|
| Food | Cuisine, dietary preferences, price sensitivity |
| Fashion | Style, colors, brands, sizes |
| Entertainment | Movies, music, events |
| Lifestyle | Travel, fitness, hobbies |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-recommendation-engine | Read | Personalized recs |
| REZ-creative-engine | Read | Personalized content |
| REZ-signal-aggregator | Write | Preference signals |

---

## Status

- [x] Service foundation
- [ ] Taste analysis
- [ ] Category profiling
- [ ] Preference learning
- [ ] Taste matching
- [ ] Privacy controls
