# REZ Reconciliation Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Finance

---

## Overview

Reconciliation service for daily balance checks, transaction verification, discrepancy detection, dispute handling, and audit reports. Ensures financial integrity across the platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Reconciliation Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Daily Balance Checks → Verify ending balances                       │
│  ├── Transaction Verification → Match transactions                        │
│  ├── Discrepancy Detection → Flag mismatches                            │
│  ├── Dispute Handling → Manage transaction disputes                      │
│  └── Audit Reports → Generate reconciliation reports                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Scheduled Jobs: Cron-based daily reconciliation                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Reconciliation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reconcile` | Run reconciliation |
| GET | `/api/reconcile/:id` | Get reconciliation status |

### Disputes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/disputes` | Create dispute |
| GET | `/api/disputes/:id` | Get dispute |
| PATCH | `/api/disputes/:id` | Update dispute |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily` | Daily report |
| GET | `/api/reports/discrepancies` | Discrepancy report |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "pg": "^8.11.3",
  "cron": "^3.1.6",
  "winston": "^3.11.0"
}
```

---

## Status

- [x] Service foundation
- [x] Daily reconciliation
- [ ] Transaction verification
- [ ] Discrepancy detection
- [ ] Dispute handling
- [ ] Audit reports
