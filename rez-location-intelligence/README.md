# REZ Location Intelligence Service

Location intelligence service for tracking and analyzing user location patterns across the REZ platform.

## Features

- **Visit Tracking**: Record user visits to locations via QR scans, check-ins, deliveries, and bookings
- **Pattern Detection**: Automatic detection of user behavior patterns
  - Commuter patterns (office workers)
  - Mall-goer patterns (shoppers)
  - Traveler patterns (frequent flyers)
  - Gym enthusiast patterns
  - Foodie patterns
  - Explorer patterns
- **Segment Classification**: Assign users to behavioral segments based on location data
- **Dwell Time Analysis**: Track time spent at locations
- **Footfall Analytics**: Aggregate analytics for zones and locations
- **Geofence Support**: Track entry/exit of defined zones

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ Location Intelligence                  │
├─────────────────────────────────────────────────────────────┤
│  Routes Layer                                                 │
│  ├── Location Routes (user profiles, visits)               │
│  ├── Pattern Routes (detection, segments)                   │
│  └── Analytics Routes (footfall, zone stats)                │
├─────────────────────────────────────────────────────────────┤
│  Services Layer                                               │
│  ├── LocationService (CRUD operations)                       │
│  ├── PatternDetectionService (algorithm implementations)     │
│  ├── SegmentService (classification)                        │
│  └── AnalyticsService (aggregations)                        │
├─────────────────────────────────────────────────────────────┤
│  Models Layer                                                 │
│  ├── LocationVisit                                           │
│  ├── UserLocationProfile                                     │
│  └── LocationZone                                            │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### User Location Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/:userId` | Get user location profile |
| GET | `/api/location/:userId/patterns` | Get detected patterns |
| GET | `/api/location/:userId/segments` | Get user segments |
| GET | `/api/location/:userId/visits` | Get visit history |

### Visit Recording

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/location/visit` | Record a location visit |
| POST | `/api/location/visit/batch` | Record multiple visits |

### Segments & Zones

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/segments` | List all segments |
| GET | `/api/location/segments/:segment/users` | Get users in segment |
| GET | `/api/location/zone/:zone/users` | Get users in zone |
| GET | `/api/location/zones` | List all zones |
| POST | `/api/location/zones` | Create zone |
| PUT | `/api/location/zones/:zoneId` | Update zone |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/footfall` | Get footfall analytics |
| GET | `/api/location/footfall/zone/:zoneId` | Zone-specific footfall |
| GET | `/api/location/dwell-time` | Dwell time analytics |
| GET | `/api/location/heatmap` | Location heatmap data |

## Location Types

- `mall` - Shopping malls and retail centers
- `restaurant` - Dining establishments
- `office` - Office buildings and business parks
- `college` - Educational institutions
- `airport` - Airports and terminals
- `gym` - Fitness centers
- `store` - Retail stores
- `other` - Miscellaneous locations

## Pattern Types

| Pattern | Description | Detection Criteria |
|---------|-------------|-------------------|
| `commuter` | Office workers | Mon-Fri, 9-6pm, same location |
| `mall_goer` | Frequent shoppers | Mall visits, weekend heavy, premium zones |
| `traveler` | Frequent travelers | Airport visits, multiple cities, irregular |
| `explorer` | Adventurous users | Varied locations, high diversity |
| `gym_enthusiast` | Fitness focused | Regular gym, consistent times |
| `foodie` | Food enthusiasts | Restaurant visits, varied cuisine zones |

## User Segments

| Segment | Description |
|---------|-------------|
| `premium_mall_visitor` | Frequently visits premium malls |
| `office_commuter` | Regular office location patterns |
| `college_student` | College campus frequent visitors |
| `frequent_traveler` | Airport regulars |
| `high_footfall_seeker` | Always in busy zones |
| `food_enthusiast` | Restaurant-focused visits |
| `fitness_focused` | Regular gym/park visits |
| `explorer` | High location diversity |

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Authentication

All endpoints require `X-Internal-Token` header:

```bash
curl -X GET http://localhost:4040/api/location/user123 \
  -H "X-Internal-Token: your-token-here"
```

## Environment Variables

See `.env.example` for all configuration options.

## Health Check

```bash
GET /health
```

## Related Services

- **REZ Intent Graph** (`/REZ-Intelligence/rez-intent-graph`) - Intent tracking
- **REZ Attribution Platform** (`/RTNM-Group/REZ-attribution-platform`) - Attribution tracking
- **REZ Journey Service** (`/REZ-Media/REZ-journey-service`) - User journey tracking
