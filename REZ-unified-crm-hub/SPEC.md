# REZ Unified CRM Hub - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** CRM

---

## Overview

Advanced CRM platform combining HubSpot, Klaviyo, Toast, and Shopify CRM capabilities into a unified solution. Provides customer management, marketing automation, and analytics across all REZ commerce touchpoints.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Unified CRM Hub                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Integrations:                                                           │
│  ├── HubSpot        → Sales and marketing CRM                         │
│  ├── Klaviyo        → Email and SMS marketing                        │
│  ├── Toast          → Restaurant POS integration                       │
│  └── Shopify        → E-commerce integration                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/crm/*                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## CRM Features

| Feature | Description |
|---------|-------------|
| Contact Management | Unified customer profiles |
| Lead Tracking | Pipeline and deal management |
| Marketing Automation | Email/SMS campaigns |
| Analytics | Customer insights and reports |
| Integration Hub | Connect external CRMs |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "jsonwebtoken": "^9.0.3",
  "zod": "^3.22.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-care-service | Read | Support data |
| REZ-unified-profile | Read | Customer profiles |
| REZ-targeting-engine | Write | Marketing campaigns |

---

## Status

- [x] Service foundation
- [ ] HubSpot integration
- [ ] Klaviyo integration
- [ ] Toast integration
- [ ] Shopify integration
- [ ] Unified contact management
- [ ] Marketing automation
