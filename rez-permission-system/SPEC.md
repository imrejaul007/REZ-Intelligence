# REZ Permission System - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Role-based access control (RBAC) system for the REZ platform. Manages permissions, roles, and access policies across all services.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Permission System                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Role Manager      → Define roles                                     │
│  ├── Permission Store → Store permissions                               │
│  ├── Policy Engine    → Evaluate access policies                         │
│  └── Audit Logger     → Log access decisions                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/roles` | Create role |
| GET | `/api/roles` | List roles |
| GET | `/api/roles/:id` | Get role |
| PUT | `/api/roles/:id` | Update role |
| DELETE | `/api/roles/:id` | Delete role |

### Permissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/permissions` | Create permission |
| GET | `/api/permissions` | List permissions |
| POST | `/api/check` | Check access |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5"
}
```

---

## Status

- [x] Role management
- [x] Permission management
- [x] Access checking
- [ ] Policy engine
