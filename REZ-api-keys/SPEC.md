# REZ API Keys - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Security

---

## Overview

API Key Management System for the REZ platform. Manages API key creation, rotation, and access control for service-to-service and external API authentication.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ API Keys Service                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Key Generation   → Generate secure API keys                       │
│  ├── Key Rotation    → Automatic rotation support                        │
│  ├── Access Control  → Scoped permissions                                │
│  └── Audit Logging   → Track key usage                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Create API key |
| GET | `/api/keys` | List keys |
| GET | `/api/keys/:id` | Get key details |
| DELETE | `/api/keys/:id` | Revoke key |

### Validation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys/validate` | Validate API key |

---

## Dependencies

```json
{
  "express": "^4.21.0",
  "mongoose": "^8.5.0",
  "zod": "^3.23.8",
  "uuid": "^10.0.0"
}
```

---

## Status

- [x] Service foundation
- [ ] Key generation
- [ ] Key rotation
- [ ] Access control
- [ ] Audit logging
