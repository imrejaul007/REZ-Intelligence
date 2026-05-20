# REZ Merchant OS - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Merchant SaaS

---

## Overview

Unified merchant SaaS dashboard with AI intelligence. Provides merchants with a comprehensive operating system for managing their business on the REZ platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Merchant OS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Dashboard Features:                                                       │
│  ├── Analytics      → Sales, orders, customer insights                    │
│  ├── Inventory     → Product management, stock tracking                    │
│  ├── Orders        → Order lifecycle management                           │
│  ├── Customers     → Customer profiles and segments                       │
│  ├── AI Insights   → AI-powered recommendations and predictions            │
│  └── Integrations  → Connect with platform services                       │
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
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-analytics | Read | Dashboard data |
| REZ-catalog | Read/Write | Products |
| REZ-orders | Read/Write | Orders |
| REZ-merchant-intelligence | Read | AI insights |

---

## Status

- [x] Service foundation
- [ ] Analytics dashboard
- [ ] Inventory management
- [ ] Order management
- [ ] Customer management
- [ ] AI insights
- [ ] Platform integrations
