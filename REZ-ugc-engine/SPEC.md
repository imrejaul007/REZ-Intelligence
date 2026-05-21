# REZ UGC Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Content

---

## Overview

User-generated content engine with content moderation, engagement tracking, and rights management. Handles reviews, comments, photos, and social content across the REZ platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ UGC Engine                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Content Moderation   → Auto-moderation pipeline                     │
│  ├── Engagement Tracker   → Likes, views, shares tracking                │
│  ├── Rights Manager       → Creator rights & attribution                  │
│  └── Content Storage      → MongoDB + Redis cache                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Content Types

| Type | Description |
|------|-------------|
| `review` | Product/merchant reviews with ratings |
| `comment` | Comments on content |
| `photo` | User-uploaded images |
| `social` | Social media posts |
| `story` | Temporary content |

---

## Moderation Pipeline

1. **Upload** → Content received
2. **Pre-check** → Basic validation
3. **AI Scan** → Toxicity/profanity detection
4. **Human Review** → Flagged content queue
5. **Publish** → Approved content available

---

## API Endpoints

### Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/content` | Create content |
| GET | `/api/content/:id` | Get content |
| PUT | `/api/content/:id` | Update content |
| DELETE | `/api/content/:id` | Delete content |

### Engagement
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/content/:id/like` | Like content |
| DELETE | `/api/content/:id/like` | Unlike content |
| POST | `/api/content/:id/view` | Record view |
| POST | `/api/content/:id/share` | Record share |

### Moderation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/moderate` | Submit for moderation |
| GET | `/api/moderation/queue` | Get review queue |
| POST | `/api/moderation/:id/approve` | Approve content |
| POST | `/api/moderation/:id/reject` | Reject content |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^5.3.0",
  "winston": "^3.11.0"
}
```

---

## Data Models

### Content
```
{
  contentId: string
  type: 'review' | 'comment' | 'photo' | 'social' | 'story'
  authorId: string
  targetId: string (merchant/product)
  body: string
  media: [{ url, type }]
  status: 'pending' | 'approved' | 'rejected'
  moderationScore: number
  engagement: { views, likes, shares, comments }
  createdAt: Date
  updatedAt: Date
}
```

---

## Status

- [x] Content CRUD
- [x] Moderation pipeline
- [x] Engagement tracking
- [ ] Rights management
- [ ] AI moderation
