# REZ Social Signals Service

Track social commerce signals including offer sharing behavior, referral metrics, influence scoring, and community organizer detection.

## Features

- **Influence Scoring**: Calculate influence scores (0-100) based on reach, engagement, and conversion
- **Sharing Behavior Analytics**: Track share frequency, preferred channels, and viral coefficients
- **Referral Tracking**: Monitor referral conversions and calculate LTV
- **Community Detection**: Identify community organizers and active members
- **Social Reach Metrics**: Track impressions across WhatsApp, Instagram, Facebook, Twitter, and more

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Configuration

Create a `.env` file with:

```bash
# Server Configuration
PORT=4060
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-social-signals

# Security
INTERNAL_SERVICE_TOKEN=your-secure-token-here
```

## API Endpoints

### User Social Profile

```
GET /api/social/:userId
```

Get complete social profile for a user.

### Influence Score

```
GET /api/social/:userId/influence
```

Get influence score breakdown including:
- Total score (0-100)
- Reach, engagement, and conversion scores
- Influence tier (macro, mid, micro, nano, none)

### Sharing Behavior

```
GET /api/social/:userId/sharing
```

Get sharing behavior metrics:
- Frequency (shares per month)
- Average reach per share
- Share rate (% of offers shared)
- Preferred channels
- Viral coefficient
- Top shared categories

### Referral Metrics

```
GET /api/social/:userId/referrals
```

Get referral performance:
- Total referrals
- Conversion rate
- Average order value
- Total referral revenue
- Referral LTV

### Track Share Event

```
POST /api/social/share
Content-Type: application/json
X-Internal-Token: your-token

{
  "userId": "user123",
  "contentType": "offer",
  "contentId": "offer456",
  "channel": "whatsapp",
  "recipientCount": 50,
  "clickCount": 10,
  "conversionCount": 2,
  "revenue": 150.00
}
```

### Track Referral

```
POST /api/social/referral
Content-Type: application/json
X-Internal-Token: your-token

{
  "referrerId": "user123",
  "referralCode": "REF123",
  "source": "whatsapp",
  "conversionValue": 500.00
}
```

### Top Influencers

```
GET /api/social/influencers?limit=20&minScore=20
```

Get ranked list of top influencers.

### Users by Segment

```
GET /api/social/segments/:segment
```

Segments: `influencer`, `referrer`, `community_organizer`, `viral_sharer`, `engaged_user`

## Data Models

### UserSocialProfile

```typescript
{
  userId: string;
  sharingBehavior: {
    frequency: number;
    avgReach: number;
    shareRate: number;
    preferredChannels: ShareChannel[];
    viralCoefficient: number;
    topSharedCategories: string[];
  };
  influenceScore: {
    total: number;
    reachScore: number;
    engagementScore: number;
    conversionScore: number;
    tier: 'macro' | 'mid' | 'micro' | 'nano' | 'none';
  };
  communityRole: {
    role: 'organizer' | 'active_member' | 'lurker' | 'none';
    groupsJoined: number;
    eventsOrganized: number;
    eventsAttended: number;
  };
  referralMetrics: {
    totalReferrals: number;
    successfulReferrals: number;
    conversionRate: number;
    referralRevenue: number;
  };
}
```

## Influence Algorithm

The influence score is calculated using weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Reach Score | 30% | Based on total impressions |
| Engagement Score | 30% | Based on click-through rate |
| Conversion Score | 40% | Based on conversions and revenue |

### Tier Definitions

| Tier | Score | Criteria |
|------|-------|----------|
| Macro | 80+ | Top performers with high absolute metrics |
| Mid | 50+ | Good performance, moderate scale |
| Micro | 20+ | Active but smaller scale |
| Nano | 5+ | Minimal but detectable influence |
| None | <5 | No significant influence |

## Security

All API endpoints require the `X-Internal-Token` header for authentication.

```bash
curl -H "X-Internal-Token: your-token" \
     https://api.service.com/api/social/user123
```

## Testing

```bash
npm test
```

## Architecture

```
src/
├── index.ts              # Entry point, Express app setup
├── types/
│   └── index.ts         # TypeScript interfaces
├── models/
│   └── index.ts         # Mongoose schemas
├── services/
│   ├── socialSignalsService.ts   # Main service logic
│   └── influenceCalculator.ts    # Influence algorithms
├── routes/
│   └── socialRoutes.ts  # API routes
└── middleware/
    └── index.ts         # Auth, rate limiting, etc.
```

## License

Proprietary - RABTUL Technologies
