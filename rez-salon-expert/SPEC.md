# REZ Salon Expert - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Expert Agents

---

## Overview

Purpose-built AI salon expert agent for beauty services, appointments, treatments, and skincare recommendations. Provides personalized beauty guidance and salon service recommendations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Salon Expert Agent                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Service Recommendations → Hair, skin, nail treatments               │
│  ├── Appointment Suggestions → Best times and services                    │
│  ├── Skincare Advice    → Personalized skincare routines                  │
│  ├── Product Matching   → Beauty product recommendations                  │
│  └── Trend Analysis    → Latest beauty trends                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.0"
}
```

---

## Status

- [x] Service foundation
- [ ] Service recommendations
- [ ] Appointment suggestions
- [ ] Skincare advice
- [ ] Product matching
- [ ] Trend analysis
