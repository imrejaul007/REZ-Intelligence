# REZ Unified Recommendations - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Recommendations

---

## Overview

Single API for all recommendations across REZ apps. Provides unified access to product, content, merchant, and search recommendations from all recommendation engines.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ Unified Recommendations                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Recommendation Types:                                                    │
│  ├── Products    → Product suggestions                               │
│  ├── Merchants   → Store recommendations                              │
│  ├── Content     → Articles, videos                                   │
│  ├── Search      → Search result rankings                              │
│  └── Complementary → Add-on suggestions                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/recommend/*                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommendation Sources

| Source | Service |
|--------|---------|
| Products | REZ-recommendation-engine |
| Merchants | REZ-merchant-intelligence |
| Content | REZ-creative-engine |
| Search | REZ-search-service |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-recommendation-engine | Read | Product recs |
| REZ-signal-aggregator | Read | User signals |

---

## Status

- [x] Service foundation
- [ ] Unified API
- [ ] Product recommendations
- [ ] Merchant recommendations
- [ ] Content recommendations
- [ ] Search ranking
