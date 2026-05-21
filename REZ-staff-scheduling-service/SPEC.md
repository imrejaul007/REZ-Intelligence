# REZ Staff Scheduling Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Operations

---

## Overview

Workforce management and staff scheduling service. Manages employee schedules, shift assignments, and time tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ Staff Scheduling Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Schedule Management → Create and manage schedules                     │
│  ├── Shift Assignments  → Assign shifts to employees                       │
│  ├── Time Tracking     → Clock in/out tracking                            │
│  ├── Availability     → Employee availability management                   │
│  └── Conflict Detection → Prevent double-booking                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules` | Create schedule |
| GET | `/api/schedules` | List schedules |
| GET | `/api/schedules/:id` | Get schedule |
| PATCH | `/api/schedules/:id` | Update schedule |

### Shifts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shifts` | Create shift |
| GET | `/api/shifts/:id` | Get shift |
| POST | `/api/shifts/:id/assign` | Assign employee |

### Time
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/time/clock-in` | Clock in |
| POST | `/api/time/clock-out` | Clock out |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Service foundation
- [ ] Schedule management
- [ ] Shift assignments
- [ ] Time tracking
- [ ] Availability management
