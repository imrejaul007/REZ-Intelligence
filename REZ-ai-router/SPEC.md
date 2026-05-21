# REZ AI Router - SPEC.md

**Version:** 1.0.0
**Port:** 4052
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Centralized AI routing service with multi-provider support (Anthropic, OpenAI, Google). Provides cost optimization, automatic failover, and usage analytics for AI operations across the REZ platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REZ AI Router                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Providers:                                                                 │
│  ├── Anthropic (Claude) → Primary for reasoning tasks                       │
│  ├── OpenAI (GPT-4)    → General purpose                                   │
│  └── Google (Gemini)   → Multimodal tasks                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Tier-based routing (fast/balanced/powerful)                            │
│  ├── Automatic failover on provider errors                                  │
│  ├── Cost optimization with max-cost limits                                │
│  └── Usage analytics per provider/model                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Model Tiers

| Tier | Use Case | Example Models |
|------|----------|---------------|
| `fast` | Quick responses | Claude Haiku, GPT-3.5 |
| `balanced` | General tasks | Claude Sonnet, GPT-4o |
| `powerful` | Complex reasoning | Claude Opus, GPT-4 |

---

## API Endpoints

### Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate` | Generate AI response |
| POST | `/api/ai/generate/stream` | Stream response (SSE) |

### Cost Estimation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/estimate` | Estimate generation cost |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/analytics` | Usage analytics |
| GET | `/api/ai/health/:provider` | Provider health check |
| GET | `/health` | Service health |
| GET | `/ready` | Readiness check |

---

## Request Schema

### Generate Request
```json
{
  "userId": "string",
  "prompt": "string",
  "systemPrompt": "string (optional)",
  "tier": "fast|balanced|powerful",
  "provider": "anthropic|openai|google (optional)",
  "fallback": "boolean (default: true)",
  "maxCost": "number (optional)"
}
```

### Response
```json
{
  "success": true,
  "content": "string",
  "usage": {
    "provider": "string",
    "model": "string",
    "promptTokens": "number",
    "completionTokens": "number",
    "totalTokens": "number",
    "cost": "number"
  }
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "axios": "^1.6.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "redis": "^4.6.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `OPENAI_API_KEY` | No | OpenAI API key |
| `GOOGLE_AI_API_KEY` | No | Google AI API key |
| `MONGODB_URI` | No | For usage analytics |
| `INTERNAL_SERVICE_TOKEN` | Yes | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All Services | Read | AI generation requests |
| REZ Creative Engine | Read | Content generation |
| REZ Care Service | Read | Support AI |

---

## Status

- [x] Multi-provider routing
- [x] Streaming support (Anthropic)
- [x] Cost estimation
- [x] Usage analytics
- [x] Automatic failover
