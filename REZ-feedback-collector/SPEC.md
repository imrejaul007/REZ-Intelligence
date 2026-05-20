# REZ Feedback Collector - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Feedback

---

## Overview

Unified feedback collection and conversion attribution service. Collects feedback from multiple touchpoints, attributes conversions, and provides actionable insights.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Feedback Collector                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Multi-Channel Collection → Collect feedback everywhere             │
│  ├── Sentiment Analysis    → AI-powered sentiment scoring               │
│  ├── Conversion Attribution → Track feedback → conversion              │
│  └── Trend Detection      → Identify feedback patterns                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Feedback Sources

| Source | Description |
|--------|-------------|
| Surveys | In-app and email surveys |
| Reviews | Product and merchant reviews |
| Support | Support ticket feedback |
| NPS | Net Promoter Score |
| Social | Social media mentions |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-care-service | Write | Support feedback |
| REZ-signal-aggregator | Write | Feedback signals |

---

## Status

- [x] Service foundation
- [ ] Multi-channel collection
- [ ] Sentiment analysis
- [ ] Attribution tracking
- [ ] Trend detection
