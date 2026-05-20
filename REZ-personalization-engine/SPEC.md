# REZ Personalization Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Personalization

---

## Overview

Personalization engine that personalizes everything for users based on their identity, preferences, and behavior. Provides personalized content, product recommendations, UI layouts, and marketing messages.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Personalization Engine                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Personalization Layers:                                                  │
│  ├── Feed Ordering    → Content/promotion ranking                       │
│  ├── Search Ranking  → Personalized search results                      │
│  ├── UI Customization → Layout and theme preferences                    │
│  └── Marketing      → Personalized messaging                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/personalize/*                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Personalization Types

| Type | Description |
|------|-------------|
| Content | Articles, videos, posts |
| Products | Product recommendations |
| Layout | Grid vs list, theme |
| Notifications | Timing and message |
| Search | Personalized rankings |
| Pricing | User-specific offers |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.23.1",
  "bcryptjs": "^2.4.3",
  "mathjs": "^12.2.1",
  "node-cache": "^5.1.2",
  "zod": "^3.23.8",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-recommendation-engine | Read | Product recs |
| REZ-identity-graph | Read | User identity |
| REZ-signal-aggregator | Read | Behavioral signals |

---

## Status

- [x] Service foundation
- [ ] Content personalization
- [ ] Product personalization
- [ ] UI customization
- [ ] Notification timing
- [ ] A/B testing
