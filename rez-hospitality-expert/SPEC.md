# REZ Hospitality Expert - SPEC.md

**Version:** 1.0.0
**Port:** 3000
**Company:** REZ-Intelligence
**Category:** Expert Agents

---

## Overview

Specialized AI concierge agent for hotels, stays, and resorts. Provides guest services, booking assistance, and hospitality recommendations using Claude AI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Hospitality Expert Agent                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── AI Concierge     → Conversational guest assistance                  │
│  ├── Booking Support  → Room and service reservations                    │
│  ├── Service Recommendations → Hotel amenities and experiences           │
│  ├── Guest Preferences → Personalized guest profiles                     │
│  └── Complaint Resolution → Issue handling and recovery                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "express": "^4.18.2",
  "mongoose": "^6.3.0",
  "ioredis": "^5.3.2",
  "bullmq": "^5.1.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-booking | Read/Write | Reservation management |
| StayOwn services | Read | Hotel inventory |
| REZ-care-service | Write | Guest complaints |

---

## Status

- [x] Service foundation
- [ ] AI concierge chat
- [ ] Booking support
- [ ] Service recommendations
- [ ] Guest preferences
- [ ] Complaint resolution
