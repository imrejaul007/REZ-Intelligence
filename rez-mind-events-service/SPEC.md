# ReZ Mind Events Service - Technical Specification

## Overview

The ReZ Mind Events Service is an AI-powered intelligence service designed for event organizers to optimize attendance, pricing, vendor selection, and guest satisfaction.

## Service Architecture

### Core Components

1. **EventsIntelligence Service**
   - Analyzes event data and generates insights
   - Coordinates between prediction and optimization services
   - Provides holistic event recommendations

2. **AttendancePredictor Service**
   - Predicts event attendance based on historical data
   - Analyzes demand patterns
   - Identifies factors affecting attendance

3. **PricingOptimizer Service**
   - Calculates optimal ticket prices
   - Implements dynamic pricing strategies
   - Analyzes price sensitivity

4. **VendorMatcher Service**
   - Recommends vendors based on event requirements
   - Scores vendor compatibility
   - Tracks vendor performance

## Data Models

### EventsMindSession
- **Purpose**: Stores AI consultation sessions
- **Retention**: 60 days TTL
- **Indexes**: sessionId (unique), eventId

### AttendancePrediction
- **Purpose**: Stores attendance predictions
- **Indexes**: eventId + date

### PricingOptimization
- **Purpose**: Stores pricing recommendations
- **Indexes**: eventId + date

### VendorMatch
- **Purpose**: Stores vendor recommendations
- **Indexes**: eventId + vendorId

## API Specification

### POST /api/consult

**Request:**
```json
{
  "eventId": "string (required)",
  "organizerId": "string (optional)",
  "eventDetails": {
    "type": "string",
    "date": "ISO date",
    "venue": "string",
    "capacity": "number"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "predictions": {...},
    "pricing": {...},
    "vendors": {...},
    "marketing": {...}
  }
}
```

### POST /api/pricing/:eventId/optimize

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPrice": "number",
    "optimizedPrice": "number",
    "demandLevel": "low|medium|high",
    "confidence": "number"
  }
}
```

### GET /api/vendor/:eventId/matches

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "vendorId": "string",
        "vendorName": "string",
        "matchScore": "number",
        "specialty": "string"
      }
    ]
  }
}
```

## Industry Knowledge Base

### Event Types
1. **Corporate Events**: Conferences, seminars, team building
2. **Social Events**: Weddings, birthdays, reunions
3. **Entertainment**: Concerts, festivals, shows
4. **Sports**: Tournaments, marathons, matches
5. **Educational**: Workshops, training, webinars
6. **Charity**: Galas, fundraisers, auctions

### Pricing Factors

| Factor | Impact |
|--------|--------|
| Event Type | 30% |
| Date/Time | 20% |
| Venue | 15% |
| Marketing | 15% |
| Competition | 10% |
| Weather | 10% |

### Attendance Patterns

| Factor | Effect |
|--------|--------|
| Weekend | +20% |
| Holiday | +30% |
| Bad Weather | -15% |
| Competitor Event | -10% |
| Good Reviews | +15% |
| Early Bird | +10% |

## Rate Limiting

- **AI Consultation**: 30 requests per minute
- **Read Operations**: 100 requests per minute
- **Pricing Operations**: 50 requests per minute

## Authentication

- Internal service authentication via `X-Internal-Token` header
- JWT Bearer token support for external services
- Rate limiting per service token

## Dependencies

- MongoDB: Primary data store
- RABTUL Platform: Intent routing and notifications
- ReZ Intelligence Hub: AI model orchestration

## Performance Targets

- Response time: < 500ms for AI consultations
- Throughput: 100 concurrent requests
- Availability: 99.9% uptime

## Monitoring

- Health endpoints for load balancer integration
- Detailed metrics in `/health/detailed`
- Request tracing via correlation IDs

## Security

- Helmet.js for HTTP headers
- CORS configuration for allowed origins
- Rate limiting to prevent abuse
- Input validation with Zod schemas