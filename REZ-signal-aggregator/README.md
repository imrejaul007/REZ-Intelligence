# REZ Signal Aggregator Service

Aggregate all signal services into unified scoring and provide real-time segment evaluation.

## Overview

The Signal Aggregator Service consolidates signals from multiple sources (location, behavioral, social, competitor, engagement) and computes unified scores for users. It also manages segment memberships based on signal thresholds.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REZ Signal Aggregator                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │ Location  │  │Behavioral │  │  Social   │  │ Competitor  │ │
│  │  Service  │  │  Service  │  │  Service  │  │   Service   │ │
│  │  (4013)   │  │  (4014)   │  │  (4015)   │  │   (4016)    │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘ │
│        └──────────────┴──────────────┴───────────────┘         │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │  Signal Aggregator │                        │
│                    │    (Port 4059)     │                        │
│                    └─────────┬─────────┘                        │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   MongoDB   │    │    Redis    │    │  Segment    │        │
│  │  (Storage)  │    │   (Cache)   │    │ Evaluation  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Signal Sources

| Source | Weight | Description |
|--------|--------|-------------|
| `location` | 15% | Location-based signals (visits, proximity) |
| `behavioral` | 25% | User behavior patterns |
| `social` | 15% | Social interactions and network effects |
| `competitor` | 20% | Competitive intelligence signals |
| `engagement` | 25% | Overall engagement metrics |

## Segments

Users are automatically segmented based on their signal scores:

| Segment | Criteria |
|---------|----------|
| `high-value` | Overall score >= 75 |
| `medium-value` | Overall score >= 50 |
| `at-risk` | Overall score <= 40 |
| `engaged` | Overall score >= 60 |
| `casual` | Overall score < 30 |
| `power-user` | Engagement score >= 80 |
| `competitor-conscious` | Competitor score >= 70 |
| `location-sensitive` | Location score >= 65 |
| `social-butterfly` | Social score >= 70 |
| `influencer` | Social >= 75 AND Engagement >= 75 |

## API Endpoints

### Health Check
```http
GET /health
```

### Get Unified Signals
```http
GET /signals/:userId
```

### Get Signal Summary
```http
GET /signals/:userId/summary
```

Response:
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "overall": 72,
    "topSignals": [
      { "type": "engagement", "score": 85 },
      { "type": "behavioral", "score": 78 },
      { "type": "social", "score": 65 }
    ],
    "segmentCount": 4,
    "lastUpdated": "2026-05-15T10:30:00.000Z"
  }
}
```

### Get Segment Memberships
```http
GET /signals/:userId/segments
```

### Get Users in Segment
```http
GET /signals/segments/:segment?limit=100&offset=0
```

### Force Recompute
```http
POST /signals/compute/:userId
```

### Real-Time Signals (Short Cache)
```http
GET /signals/real-time/:userId
```

### Get Signal Weights
```http
GET /signals/weights
```

### List All Segments
```http
GET /signals/segments/list
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4059` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/rez-signals` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `CACHE_TTL` | `300` | Cache TTL in seconds (5 min) |
| `REALTIME_CACHE_TTL` | `30` | Real-time cache TTL (30 sec) |
| `INTERNAL_SERVICE_TOKEN` | `dev-token` | Internal service auth token |

### Signal Source URLs

| Variable | Default |
|----------|---------|
| `REZ_LOCATION_SERVICE_URL` | `http://localhost:4013` |
| `REZ_BEHAVIORAL_SERVICE_URL` | `http://localhost:4014` |
| `REZ_SOCIAL_SERVICE_URL` | `http://localhost:4015` |
| `REZ_COMPETITOR_SERVICE_URL` | `http://localhost:4016` |
| `REZ_ENGAGEMENT_SERVICE_URL` | `http://localhost:4017` |

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

# Start production server
npm start
```

## Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 4059

CMD ["node", "dist/index.js"]
```

## Monitoring

The service exposes Prometheus-compatible metrics at `/metrics` (if prom-client is configured).

Key metrics:
- `signal_aggregations_total` - Total aggregations by source
- `signal_latency_seconds` - Aggregation latency by source
- `segment_memberships_total` - Segment membership counts
- `cache_hit_ratio` - Redis cache hit ratio

## Error Handling

- Failed signal source fetches return a neutral score (50)
- MongoDB/Redis failures are logged but don't crash the service
- All errors return structured JSON responses

## License

Proprietary - RABTUL Technologies
