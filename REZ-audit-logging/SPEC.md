# REZ Audit Logging - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Compliance

---

## Overview

Audit logging service for compliance and reporting. Captures all system actions, user activities, and data access events with immutable audit trails.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Audit Logging                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Action Logging   → Capture all system actions                       │
│  ├── User Activity   → Track user actions and sessions                  │
│  ├── Data Access     → Log all data read/write operations                │
│  └── Compliance Reports → Generate audit reports                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Audit Event Types

| Category | Events |
|----------|--------|
| Authentication | Login, logout, MFA, password change |
| Authorization | Permission granted, role changed |
| Data | Create, read, update, delete |
| Admin | Config changes, feature flags |
| Finance | Payment, refund, adjustment |

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
| All Services | Write | Audit events |
| REZ-data-governance | Read | Compliance reporting |

---

## Status

- [x] Service foundation
- [ ] Action logging
- [ ] User activity tracking
- [ ] Data access logging
- [ ] Compliance reports
