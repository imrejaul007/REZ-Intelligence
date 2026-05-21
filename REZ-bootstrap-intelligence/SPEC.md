# REZ Bootstrap Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** 4115
**Company:** REZ-Intelligence
**Category:** Growth

---

## Overview

AI-powered onboarding intelligence for new merchants. Accelerates merchant activation by providing intelligent setup recommendations, automated configuration, and personalized guidance based on business type and goals.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Bootstrap Intelligence                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Onboarding Steps:                                                         │
│  1. Business Profile → Category, size, location                            │
│  2. AI Recommendations → Product/service setup                            │
│  3. Quick Wins → First order in 24h                                      │
│  4. Growth Hints → Expansion strategies                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Business Classification
- Business type detection
- Industry-specific templates
- Size-based recommendations

### AI Setup Assistance
- Product catalog suggestions
- Pricing recommendations
- Category optimization

### Quick Start Goals
- First order target
- First customer milestone
- Initial engagement metrics

### Growth Intelligence
- Seasonal recommendations
- Market opportunity detection
- Competitive positioning

---

## API Endpoints

### Onboarding
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bootstrap/start` | Start onboarding |
| GET | `/api/bootstrap/:merchantId/status` | Get onboarding status |
| POST | `/api/bootstrap/:merchantId/complete` | Complete step |

### Recommendations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations/:merchantId` | Get AI recommendations |
| POST | `/api/recommendations/:merchantId/apply` | Apply recommendation |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/merchant/:merchantId` | Onboarding analytics |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "zod": "^3.22.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Catalog | Write | Product setup |
| REZ Intent | Read | Category insights |
| REZ Merchant Intelligence | Write | Merchant profile |
| REZ Analytics | Write | Onboarding metrics |

---

## Status

- [x] Service foundation
- [ ] Business classification
- [ ] AI recommendations
- [ ] Quick start goals
- [ ] Growth hints
