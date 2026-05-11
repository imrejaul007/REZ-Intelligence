# REZ Targeting Engine

Port: 3003

## Environment Variables
```bash
PORT=3003
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=*
```

## Health Check
GET /api/v1/health

## Deploy
[Render deployment](https://render.com)

## Features

- **Campaign Management**: Create, update, and manage ad/notification campaigns
- **User Segmentation**: Predefined segments (high_value, churned, foodies, etc.)
- **Targeting Rules Engine**: Segment matching, exclusion checks, frequency capping
- **Budget Pacing**: Daily/lifetime budget limits with pacing modes
- **A/B Testing**: Variant allocation with deterministic user assignment
- **Ad Templates**: Banner, push, in-app, SMS, and email templates
- **Analytics**: Campaign stats, CTR, conversion rates, ROAS

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Start server
npm start

# Development mode
npm run dev
```

## API Endpoints

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/campaigns` | Create targeting campaign |
| GET | `/api/v1/campaigns` | List all campaigns |
| GET | `/api/v1/campaigns/:id` | Get campaign by ID |
| PATCH | `/api/v1/campaigns/:id` | Update campaign |
| DELETE | `/api/v1/campaigns/:id` | Cancel campaign |
| GET | `/api/v1/campaigns/:id/audience` | Preview matching audience |
| POST | `/api/v1/campaigns/:id/trigger` | Fire campaign |
| GET | `/api/v1/campaigns/:id/stats` | Get campaign statistics |
| GET | `/api/v1/campaigns/stats` | Get all campaigns stats |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/templates` | Create ad template |
| GET | `/api/v1/templates` | List templates |
| GET | `/api/v1/templates/:id` | Get template |
| PATCH | `/api/v1/templates/:id` | Update template |
| DELETE | `/api/v1/templates/:id` | Deactivate template |
| POST | `/api/v1/templates/:id/personalize` | Get personalized content |
| POST | `/api/v1/templates/:id/render` | Render for channel |

### Segments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/segments` | List all segments |
| GET | `/api/v1/segments/:id` | Get segment details |
| POST | `/api/v1/segments/evaluate` | Evaluate user segments |

## Predefined User Segments

- **high_value**: Top 20% by Lifetime Value
- **churned**: No order 30+ days
- **window_shoppers**: Browse frequently, rarely buy
- **deal_seekers**: Always discount responsive
- **foodies**: High frequency, variety seekers
- **budget_minders**: Low AOV, price sensitive
- **new_users**: First order within 7 days
- **reorder_probability_high**: Likely to reorder based on patterns
- **recently_purchased**: Made purchase in last 7 days

## License

Proprietary - ReZ Inc.
