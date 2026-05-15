# REZ Hyperlocal Targeting Service

Geofence-based advertising targeting service for physical locations including malls, offices, colleges, airports, and high footfall zones.

## Features

- **Geofence Targeting**: Define geofences around physical locations and get detailed targeting information
- **Audience Profiling**: Demographic, behavioral, and segment-based audience analytics
- **Ad Slot Management**: Browse and book available advertising slots across zones
- **Footfall Analytics**: Real-time and historical footfall data with predictions
- **Dynamic Pricing**: CPM-based pricing with multipliers for formats, segments, and peak hours
- **Booking Management**: Complete booking lifecycle with status tracking

## Quick Start

### Installation

```bash
cd REZ-hyperlocal-targeting
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4059` |
| `NODE_ENV` | Environment | `development` |

## API Endpoints

### Targeting

#### POST /target/geofence
Get targeting information for a geographic location.

```json
{
  "lat": 12.9352,
  "lng": 77.6245,
  "radius": 500,
  "zoneType": "mall"
}
```

#### GET /target/audience-size
Estimate audience size based on targeting criteria.

```json
{
  "zoneIds": ["mall-001", "office-001"],
  "demographics": {
    "ageGroups": ["18-24", "25-34"],
    "incomeLevels": ["middle", "upper-middle"]
  },
  "behavioral": {
    "peakHoursOnly": true
  },
  "segments": ["shoppers", "foodies"]
}
```

### Zones

#### GET /zones
List all zones with optional filters.

Query params: `type`, `city`, `active`

#### GET /zones/:zoneId
Get detailed zone information.

#### GET /zones/:zoneId/audience
Get audience profile for a zone.

Query params: `demographics` (true/summary), `behavioral` (summary), `segments` (true)

#### GET /zones/:zoneId/footfall
Get footfall analytics.

Query params: `period` (hourly/daily/weekly/monthly/trends)

#### GET /zones/:zoneId/slots
Get available ad slots.

Query params: `format`, `minPrice`, `maxPrice`, `available`

### Bookings

#### POST /zones/:zoneId/booking
Book an ad slot.

```json
{
  "slotId": "mall-001-b1",
  "advertiserId": "adv-123",
  "campaignId": "camp-456",
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "targeting": {
    "ageGroups": ["25-34"],
    "peakHoursOnly": true,
    "segments": ["shoppers"]
  }
}
```

#### GET /bookings
List all bookings.

Query params: `status`, `advertiserId`, `zoneId`, `limit`, `offset`

#### GET /bookings/:bookingId
Get booking details.

#### PATCH /bookings/:bookingId
Update booking status.

```json
{
  "status": "confirmed"
}
```

### Utilities

#### GET /stats
Platform statistics overview.

#### GET /health
Service health check.

## Data Models

### Zone Types

| Type | Description | Typical CPM |
|------|-------------|-------------|
| `mall` | Shopping malls | ₹80-150 |
| `office` | Office complexes | ₹100-200 |
| `college` | Educational institutions | ₹50-100 |
| `airport` | Airports | ₹200-350 |
| `high_street` | Commercial high streets | ₹100-180 |

### Ad Formats

| Format | Price Multiplier | Description |
|--------|-----------------|-------------|
| `banner` | 1.0x | Static display ads |
| `video` | 1.5-2.5x | Video advertisements |
| `interactive` | 2.0-3.2x | Touch-enabled displays |

### Booking Statuses

- `pending` - Awaiting confirmation
- `confirmed` - Booking confirmed
- `cancelled` - Booking cancelled
- `completed` - Campaign completed

## Sample Zones

The service includes 5 pre-configured sample zones:

1. **Phoenix Marketcity Mall** (mall) - Premium shopping destination
2. **Manyata Tech Park** (office) - Large tech campus
3. **Christ University** (college) - Educational institution
4. **Kempegowda International Airport** (airport) - Airport terminal
5. **MG Road High Street** (high_street) - Commercial district

## Pricing Model

Base CPM rates are multiplied by:

1. **Zone type** - Airport highest, college lowest
2. **Format** - Interactive highest, banner lowest
3. **Segments** - Business travelers, frequent flyers premium
4. **Timing** - Peak hours 1.3-2.0x multiplier

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              REZ Hyperlocal Targeting Service                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Zone Manager│  │ Audience    │  │ Booking Manager      │ │
│  │             │  │ Analytics   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    In-Memory Store                          │
│         (Production: Redis + PostgreSQL recommended)        │
└─────────────────────────────────────────────────────────────┘
```

## Security

- Internal service token via `X-Internal-Token` header
- Request validation with Zod schemas
- CORS and Helmet security headers
- Rate limiting (configurable)

## Future Enhancements

- [ ] Real-time footfall via IoT integration
- [ ] Weather-based audience predictions
- [ ] Competitor proximity analysis
- [ ] Historical campaign performance
- [ ] A/B testing for ad placements
- [ ] Programmatic bidding integration
- [ ] Multi-city expansion

## License

MIT

## Support

For API documentation or support, contact the REZ Intelligence team.
