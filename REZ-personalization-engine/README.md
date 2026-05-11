# REZ Personalization Engine

Port: 4017

## Environment Variables
```bash
PORT=4017
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
NODE_ENV=development
COLLABORATIVE_FILTERING_WEIGHT=0.4
CONTENT_BASED_WEIGHT=0.35
CONTEXTUAL_BANDIT_EXPLORATION_RATE=0.1
DIVERSITY_THRESHOLD=0.3
CACHE_TTL_SECONDS=300
CORS_ORIGIN=*
```

## Health Check
GET /health

## Deploy
[Render deployment](https://render.com)

## Features

### User DNA Profile
The engine maintains a comprehensive user DNA profile including:
- **Behavioral Patterns**: User interaction patterns with frequency and confidence scores
- **Preference Vector**: Multi-dimensional preference representation
- **Content Affinity Scores**: Scores for content types and categories
- **Communication Style**: formal/casual/friendly/professional/mixed
- **Notification Timing Preference**: Optimal times for notifications
- **Price Sensitivity Tier**: budget/moderate/premium/luxury/insensitive
- **Brand Preferences**: Brand affinity scores
- **Category Interests**: Interest scores by category

### Personalization Layers
- **Homepage Feed**: Personalized item ranking
- **Search Results**: Personalized boost scores
- **Recommendations**: Relevant + diverse suggestions
- **Notifications**: Optimal timing + channel selection
- **Email/SMS Content**: Personalized subject lines and offers
- **Ad Targeting**: Behavioral segment targeting

## API Endpoints

### Personalization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personalize/homepage` | Get personalized homepage feed |
| GET | `/api/personalize/search` | Personalize search results |
| POST | `/api/personalize/search` | Personalize provided results |
| GET | `/api/personalize/recommendations` | Get recommendations |
| POST | `/api/personalize/user/:userId` | Update user profile |
| GET | `/api/personalize/user/:userId` | Get user profile |
| POST | `/api/personalize/interaction` | Record interaction |
| GET | `/api/personalize/segment/:userId` | Get user segment |
| GET | `/api/personalize/similar/:itemId` | Get similar items |
| POST | `/api/personalize/batch` | Batch personalization |

### Content Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/content` | Create content item |
| GET | `/api/content` | List content items |
| GET | `/api/content/:itemId` | Get content item |
| PUT | `/api/content/:itemId` | Update content item |
| DELETE | `/api/content/:itemId` | Delete content item |
| POST | `/api/content/bulk` | Bulk create/update |

## Installation

```bash
npm install
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## License

MIT
