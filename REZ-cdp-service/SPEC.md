# REZ CDP Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Customer Data Platform

---

## Overview

Customer Data Platform providing unified customer profiles, identity resolution, and segmentation across all REZ touchpoints. Creates a single view of each customer from multiple data sources.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ CDP Service                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Unified Profiles    → Single customer view                          │
│  ├── Identity Resolution → Cross-device/channel linking                  │
│  ├── Segmentation       → Dynamic audience segments                       │
│  └── Data Enrichment   → Third-party data enrichment                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-identity-graph | Read | Identity resolution |
| REZ-unified-profile | Read | Profile data |
| REZ-realtime-segments | Write | Segment updates |

---

## Status

- [x] Service foundation
- [ ] Unified profiles
- [ ] Identity resolution
- [ ] Dynamic segmentation
- [ ] Data enrichment
