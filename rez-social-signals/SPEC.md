# REZ Social Signals Service - SPEC.md

**Version:** 1.0.0
**Port:** 4146
**Company:** REZ-Intelligence
**Category:** Social Commerce Intelligence

---

## Overview

Track social commerce signals including shares, referrals, and influence scores. Provides the intelligence layer for viral marketing, referral programs, and influencer identification.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   REZ Social Signals (4146)                 │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/social/*                                     │
│  ├── GET  /:userId              - User social profile     │
│  ├── GET  /:userId/influence    - Influence score        │
│  ├── GET  /:userId/sharing      - Sharing behavior        │
│  ├── GET  /:userId/referrals    - Referral metrics       │
│  ├── POST /share                - Track share event       │
│  ├── POST /referral             - Track referral          │
│  ├── GET  /influencers          - Top influencers         │
│  └── GET  /segments/:seg        - Users by segment        │
├─────────────────────────────────────────────────────────────┤
│  Models: ShareEvent, ReferralEvent, UserSocialProfile       │
│  Services: SocialSignalsService, InfluenceCalculator        │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Share Tracking** | Track shares across WhatsApp, Instagram, Facebook, Twitter, Link |
| **Referral Tracking** | Track referral codes, conversions, and revenue attribution |
| **Influence Scoring** | Calculate influence based on reach (30%), engagement (30%), conversion (40%) |
| **Community Roles** | Detect organizers, active members, lurkers based on activity |
| **Social Reach** | Track impressions, unique recipients, channel-specific reach |
| **Top Influencers** | Rank users by influence score |
| **Social Segments** | Segment by: influencer, referrer, community_organizer, viral_sharer, engaged_user |

### Influence Tiers

| Tier | Score | Criteria |
|------|-------|----------|
| `macro` | 80+ | 100k+ impressions, 100+ conversions, $10k+ revenue |
| `mid` | 50+ | 10k+ impressions, 20+ conversions, $2k+ revenue |
| `micro` | 20+ | 1k+ impressions, 5+ conversions |
| `nano` | 5+ | 100+ impressions |
| `none` | 0 | No significant influence |

### Share Channels

- `whatsapp`
- `instagram`
- `facebook`
- `twitter`
- `link`

### Content Types

- `product`
- `offer`
- `store`
- `campaign`
- `general`

---

## Data Models

### ShareEvent

```typescript
interface IShareEvent {
  shareId: string;
  userId: string;
  contentType: 'product' | 'offer' | 'store' | 'campaign' | 'general';
  contentId: string;
  contentTitle?: string;
  channel: ShareChannel;
  recipientCount: number;
  clickCount: number;
  conversionCount: number;
  revenue: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

### ReferralEvent

```typescript
interface IReferralEvent {
  referralId: string;
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  source: string;
  status: 'pending' | 'converted' | 'expired';
  conversionValue?: number;
  conversionTimestamp?: Date;
  expiresAt?: Date;
  timestamp: Date;
}
```

### UserSocialProfile

```typescript
interface IUserSocialProfile {
  userId: string;
  sharingBehavior: {
    frequency: number;           // Shares per month
    avgReach: number;            // Avg impressions per share
    shareRate: number;           // % of offers shared
    preferredChannels: ShareChannel[];
    viralCoefficient: number;    // Conversions per share
    topSharedCategories: string[];
  };
  influenceScore: {
    total: number;               // 0-100
    reachScore: number;
    engagementScore: number;
    conversionScore: number;
    tier: 'macro' | 'mid' | 'micro' | 'nano' | 'none';
    trendingScore: number;
  };
  communityRole: {
    role: 'organizer' | 'active_member' | 'lurker' | 'none';
    groupsJoined: number;
    groupsCreated: number;
    eventsOrganized: number;
    eventsAttended: number;
    communityEngagement: number;
    moderatorOf?: string[];
  };
  socialReach: {
    totalImpressions: number;
    uniqueRecipients: number;
    whatsappReach: number;
    instagramReach: number;
    facebookReach: number;
    twitterReach: number;
    linkReach: number;
    estimatedAudience: number;
    reachByCategory: Record<string, number>;
  };
  referralMetrics: {
    totalReferrals: number;
    pendingReferrals: number;
    successfulReferrals: number;
    conversionRate: number;
    avgOrderValueFromReferrals: number;
    referralRevenue: number;
    referralLTV: number;
  };
  lastUpdated: Date;
}
```

---

## API Endpoints

### GET /api/social/:userId

Get user social profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "influenceScore": { "total": 45, "tier": "micro", ... },
    "sharingBehavior": { "frequency": 8.5, "preferredChannels": ["whatsapp"], ... },
    "socialReach": { "totalImpressions": 5200, ... },
    "referralMetrics": { "totalReferrals": 12, "conversionRate": 0.33, ... }
  }
}
```

### POST /api/social/share

Track share event.

**Request:**
```json
{
  "userId": "user_123",
  "contentType": "offer",
  "contentId": "offer_456",
  "channel": "whatsapp",
  "recipientCount": 25,
  "clickCount": 8,
  "conversionCount": 2,
  "revenue": 500
}
```

### POST /api/social/referral

Track referral event.

**Request:**
```json
{
  "referrerId": "user_123",
  "refereeId": "user_789",
  "referralCode": "REWARD50",
  "source": "whatsapp",
  "conversionValue": 250
}
```

### GET /api/social/influencers

Get top influencers.

**Query:** `?limit=20&minScore=20`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user_123",
      "influenceScore": { "total": 85, "tier": "macro", ... },
      "totalRevenue": 15000,
      "totalConversions": 120,
      "topChannel": "whatsapp",
      "rank": 1
    }
  ]
}
```

### GET /api/social/segments/:segment

Get users by social segment.

**Segments:** `influencer`, `referrer`, `community_organizer`, `viral_sharer`, `engaged_user`

---

## Influence Calculation

### Scoring Formula

```
Total Score = (Reach Score × 0.30) + (Engagement Score × 0.30) + (Conversion Score × 0.40)

Reach Score = min(100, impressions/10000 × 50 + uniqueRecipients/1000 × 10)
Engagement Score = min(100, CTR × 10)
Conversion Score = min(100, conversionRate × 5 + revenueFactor × 0.5)
```

### Community Role Scoring

```
Organizer Score = eventsOrganized × 5 + groupsCreated × 3 + groupsJoined × 0.5
                 + postsCount × 0.3 + commentsCount × 0.2 + reactionsCount × 0.1
                 + (isModerator ? 20 : 0)
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.2.0",
  "redis": "^4.6.13",
  "helmet": "^7.1.0",
  "zod": "^3.22.4"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4146 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-social-signals | MongoDB connection |
| `REDIS_URL` | redis://localhost:6379 | Redis cache |
| `RATE_LIMIT_REQUESTS` | 100 | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window |

---

## Integration Points

| Service | Method | Purpose |
|---------|--------|---------|
| REZ Event Bus | Publish | Emit social.* events |
| Commerce Graph | Write | Sync influencer data |
| Recommendation Engine | Read | Influence-based recommendations |
| Attribution Hub | Write | Track referral attribution |

---

## Status

- [x] Service implemented
- [x] Models defined
- [x] API routes implemented
- [x] Influence calculation logic
- [x] Community role detection
- [ ] Event bus integration
- [ ] Commerce graph sync
