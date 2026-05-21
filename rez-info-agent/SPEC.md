# REZ Info Agent - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for general information delivery. Handles FAQs, policies, company information, and general knowledge queries. Provides quick, accurate responses to common questions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Info Agent                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── FAQ Delivery      → Frequently asked questions                        │
│  ├── Policy Answers   → Company policies, terms                          │
│  ├── General Info     → Company information                              │
│  └── Knowledge Base   → Structured knowledge lookup                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Information
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/info/query` | Query information |
| GET | `/api/info/faq/:topic` | Get FAQ topic |
| GET | `/api/info/policy/:name` | Get policy |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Status

- [x] Service foundation
- [x] FAQ delivery
- [x] Policy answers
- [ ] Knowledge base
