# REZ Intelligence Hub - SPEC.md

**Version:** 2.0.0
**Port:** 4020
**Company:** REZ-Intelligence
**Category:** Intelligence

---

## Overview

Unified user and merchant intelligence hub combining profiles, derived signals, voice AI, and autonomous agents. Provides real-time user preferences, intent signals, and behavioral analytics with voice interaction capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Intelligence Hub                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Intelligence Layers:                                                      │
│  ├── User Profiles     → Derived signals from events                      │
│  ├── Merchant Profiles → Demand patterns, segments                        │
│  ├── Voice AI         → Speech-to-text + TTS                             │
│  └── Autonomous Agents → Order, booking, support, NLU                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Finance Intelligence → Financial insights                           │
│  ├── User Intelligence   → Intent & behavior                              │
│  └── Voice Processing   → Voice command routing                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/profile/user` | Create/update user profile |
| GET | `/profile/user/:userId` | Get user profile |
| GET | `/profiles` | List profiles (paginated) |

### Voice AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/process` | Process voice/text input |
| POST | `/api/voice/text` | Process text input |
| POST | `/webhook/voice` | Twilio webhook |
| GET | `/api/agents/status` | Agent status |

### Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/intelligence/*` | User intelligence routes |
| GET | `/api/finance/*` | Finance intelligence routes |
| GET | `/api/dashboard/*` | Dashboard routes |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Comprehensive health check |
| GET | `/health/voice` | Voice AI health |

---

## User Profile Schema

```typescript
{
  userId: string
  derived_signals: {
    preferences: {
      cuisines: string[]
      price_range: string
      time_pattern: string
      dietary: string[]
    }
    intent_signals: {
      current_intent: string
      intent_confidence: number
      purchase_probability: number
    }
    behavior: {
      frequency: string
      avg_order_value: number
      engagement_level: string
    }
  }
  segments: string[]
  updatedAt: Date
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.23.1",
  "axios": "^1.16.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.23.8"
}
```

---

## Features

| Feature | Status |
|---------|--------|
| User Profiles | ✅ |
| Merchant Profiles | ✅ |
| Derived Signals | ✅ |
| Voice AI (STT/TTS) | ✅ |
| Autonomous Agents | ✅ |
| Rate Limiting | ✅ |
| Authentication | ✅ |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Intent Graph | Read/Write | Intent signals |
| RABTUL Services | Read | User data |
| Twilio | Webhook | Voice calls |
| REZ Analytics | Write | Dashboard data |

---

## Status

- [x] User profiles
- [x] Merchant profiles
- [x] Derived signals
- [x] Finance intelligence
- [x] User intelligence
- [x] Voice AI
- [x] Autonomous agents
