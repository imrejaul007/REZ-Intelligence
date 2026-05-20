# REZ Conversation Intelligence - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** NLP

---

## Overview

Conversation intelligence service for learning from every conversation. Analyzes support chats, voice calls, and messaging to extract insights, sentiment, and action items.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             REZ Conversation Intelligence                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Analysis Types:                                                           │
│  ├── Sentiment Analysis → Positive/negative/neutral                     │
│  ├── Intent Detection  → User intent classification                     │
│  ├── Entity Extraction → Named entity recognition                       │
│  ├── Topic Modeling   → Conversation topics                              │
│  └── Action Items    → Tasks identified from conversation               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## NLP Features

| Feature | Description |
|---------|-------------|
| Sentiment | Emotion detection |
| Intent | What user wants |
| Entities | People, places, products |
| Topics | Conversation themes |
| Summary | Key points extraction |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "bullmq": "^5.1.0",
  "sentiment": "^5.0.2",
  "natural": "^6.10.4",
  "compromise": "^14.10.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-care-service | Read | Support conversations |
| REZ-signal-aggregator | Write | Conversation signals |

---

## Status

- [x] Service foundation
- [ ] Sentiment analysis
- [ ] Intent detection
- [ ] Entity extraction
- [ ] Topic modeling
- [ ] Action item extraction
