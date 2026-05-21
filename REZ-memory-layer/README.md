# REZ Memory Layer

**Unified Customer Timeline Service** - Port 4201

A production-ready customer timeline service that aggregates all events across the REZ ecosystem, providing AI-ready user profiles for personalization.

## Architecture

```
Events from Bus → Timeline Aggregator → Redis Cache + MongoDB Storage → Timeline API
```

## Features

- **Event Ingestion**: Consume events from REZ Event Bus or ingest via REST API
- **Timeline Aggregation**: Build comprehensive user timelines from multiple sources
- **Event Enrichment**: Add context from product, merchant, and user data
- **Segment Computation**: Automatically detect user segments (high-value, engaged, etc.)
- **Preference Detection**: Identify category, brand, channel, and time preferences
- **Pattern Detection**: Discover behavioral patterns in user activity
- **Caching**: Redis-based caching for fast timeline reads

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Build
npm run build

# Start
npm start

# Development
npm run dev
```

## Environment Variables

See `.env.example` for all configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4201 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/rez_memory_layer |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| REZ_EVENT_BUS_URL | Event Bus URL | http://localhost:4025 |
| INTERNAL_SERVICE_TOKEN | Service authentication token | - |

## API Endpoints

### Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timeline/:userId` | Get user timeline |
| GET | `/api/timeline/:userId/summary` | Get timeline summary |
| GET | `/api/timeline/:userId/segments` | Get computed segments |
| GET | `/api/timeline/:userId/preferences` | Get detected preferences |
| GET | `/api/timeline/:userId/activity` | Get activity metrics |
| GET | `/api/timeline/:userId/full` | Get complete user timeline |
| POST | `/api/timeline/:userId/events` | Manual event ingestion |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events` | Ingest single event |
| POST | `/api/events/batch` | Batch ingest events |
| POST | `/api/events/normalize` | Normalize event preview |
| GET | `/api/events/stats` | Get ingestion statistics |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Full health check |
| GET | `/live` | Liveness probe |
| GET | `/ready` | Readiness probe |
| GET | `/metrics` | Prometheus metrics |

## Event Sources

Events can originate from these sources:

- `whatsapp` - WhatsApp interactions
- `support` - Support tickets
- `order` - Order events
- `payment` - Payment events
- `loyalty` - Loyalty/points events
- `campaign` - Marketing campaigns
- `qr` - QR code scans
- `ai` - AI/chatbot interactions
- `push` - Push notifications
- `auth` - Authentication events
- `catalog` - Product catalog events
- `search` - Search events
- `delivery` - Delivery events
- `booking` - Booking/reservation events
- `dooh` - Digital out-of-home events

## Event Categories

- `commerce` - Purchase-related events
- `engagement` - User engagement events
- `identity` - Authentication/identity events
- `loyalty` - Loyalty program events
- `intelligence` - AI/intelligence events
- `support` - Customer support events
- `marketing` - Marketing campaign events
- `notification` - Notification events

## Authentication

All API endpoints require authentication via `X-Internal-Token` header:

```bash
curl -H "X-Internal-Token: your-token" http://localhost:4201/api/timeline/user123
```

## Data Models

### TimelineEvent

```typescript
{
  id: string;
  userId: string;
  type: string;
  category: EventCategory;
  source: EventSource;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata: EventMetadata;
}
```

### ComputedSegment

```typescript
{
  segmentId: string;
  segmentName: string;
  confidence: number;
  lastTriggered: Date;
  triggers: string[];
}
```

### ComputedPreferences

```typescript
{
  categories: CategoryPreference[];
  brands: BrandPreference[];
  priceRanges: PriceRangePreference[];
  channels: ChannelPreference[];
  timePatterns: TimePattern[];
}
```

## Caching Strategy

| Data | TTL | Description |
|------|-----|-------------|
| Timeline | 24 hours | Recent timeline events |
| Segments | 1 hour | Computed user segments |
| Preferences | 30 min | Detected preferences |

## Monitoring

Health checks available at:
- `/health` - Full status with service health
- `/metrics` - Prometheus-compatible metrics

## License

Proprietary - RTNM Group
