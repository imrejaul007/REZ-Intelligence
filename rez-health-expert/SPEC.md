# REZ Health Expert - SPEC.md

**Version:** 1.0.0
**Port:** 3011
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for health and wellness domain. Provides health guidance, symptom awareness information, and appointment booking assistance. Note: Does not provide medical advice.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Health Expert                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Health Information    → General wellness guidance                    │
│  ├── Symptom Awareness     → General symptom information                  │
│  ├── Appointment Booking   → Schedule appointments                        │
│  └── Wellness Tracking     → Health metrics & tips                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/health/search` | Search health topics |
| POST | `/api/health/symptom` | Get symptom info |
| POST | `/api/health/appointment` | Book appointment |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.19.2",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "zod": "^3.22.4",
  "winston": "^3.12.0",
  "express-rate-limit": "^7.2.0",
  "compression": "^1.7.4"
}
```

---

## Disclaimer

**Important:** This service provides general health information only. It does not:
- Diagnose medical conditions
- Prescribe treatments
- Replace professional medical advice

Users should always consult healthcare professionals for medical concerns.

---

## Status

- [x] Service foundation
- [x] Health information
- [x] Symptom awareness
- [x] Appointment booking
- [ ] Wellness tracking
