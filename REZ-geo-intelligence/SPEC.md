# REZ Geo Intelligence Core - Technical Specification

**Version:** 1.0.0  
**Port:** 4140  
**Status:** Production Ready

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ GEO INTELLIGENCE CORE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Event Bus ←── Z-Events, ReZ Ride, Merchant, Consumer, BuzzLocal          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │  Consumer   │ │  Merchant   │ │    Event    │ │    Zone     │         │
│  │   Graph     │ │   Graph     │ │   Graph     │ │   Graph     │         │
│  │  (Mongoose) │ │  (Mongoose) │ │  (Mongoose) │ │  (Mongoose) │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐ ┌──────────────────────┐                         │
│  │   Zone Hierarchy      │ │  Synthetic Demand   │                         │
│  │   5-Level System      │ │     Index Service    │                         │
│  └──────────────────────┘ └──────────────────────┘                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐ │
│  │    Demand            │ │  Recommendation      │ │  Event Graph         │ │
│  │  Prediction          │ │    Service           │ │  Integration         │ │
│  └──────────────────────┘ └──────────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Zone Hierarchy System

### 5-Level Structure

| Level | ID Pattern | Description | Example |
|-------|-----------|-------------|---------|
| City | `bangalore` | Metro/tier cities | Bangalore |
| District | `koramangala` | City districts | Koramangala |
| Neighborhood | `ngb_*` | Residential areas | Koramangala 5th Block |
| Micro-zone | `mz_*` | Building clusters | MZ-KRM-001 |
| Venue Cluster | `vc_*` | Event venues | VC-KRM-001 |

### Zone Hierarchy Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/zones/cities` | Optional | List all cities |
| GET | `/api/zones/:level` | Optional | List zones by level |
| GET | `/api/zones/:level/:zoneId` | Optional | Get specific zone |
| GET | `/api/zones/hierarchy/:zoneId` | Optional | Get full hierarchy |
| GET | `/api/zones/lookup?lng=&lat=` | Optional | Reverse geocode |
| GET | `/api/zones/near` | Optional | Find zones near location |
| POST | `/api/zones/seed` | Token | Seed demo data |

### Zone Hierarchy Example Response

```json
{
  "success": true,
  "data": {
    "city": { "zoneId": "bangalore", "name": "Bangalore", "population": 13000000 },
    "district": { "zoneId": "koramangala", "name": "Koramangala", "performanceIndex": 88 },
    "neighborhood": { "zoneId": "koramangala-5th-block", "name": "5th Block" }
  }
}
```

---

## Synthetic Demand Index

### 11 Component Weights

| Component | Weight | Source |
|-----------|--------|--------|
| Order Velocity | 0.12 | Commerce signals |
| Basket Size | 0.08 | Commerce signals |
| Fulfillment Rate | 0.08 | Commerce signals |
| Ride Frequency | 0.15 | Mobility signals |
| Ride Destination Ratio | 0.10 | Mobility signals |
| Event Attendance | 0.12 | Event signals |
| Event Buzz | 0.08 | Social signals |
| Footfall Count | 0.10 | Footfall signals |
| Footfall Density | 0.05 | Footfall signals |
| Weather Impact | 0.05 | Context signals |
| Time Impact | 0.07 | Context signals |

### Demand Index Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/demand-index/:zoneId` | Optional | Get demand index |
| GET | `/api/demand-index/near` | Optional | Get indices near location |
| GET | `/api/demand-index/:zoneId/history` | Optional | Get demand history |
| GET | `/api/demand-index/:zoneId/forecast` | Optional | Get demand forecast |

### Demand Index Response

```json
{
  "success": true,
  "data": {
    "index": {
      "zoneId": "ngb_koramangala_1",
      "overallIndex": 84,
      "confidence": 78,
      "components": {
        "orderVelocity": 85,
        "rideFrequency": 92,
        "eventBuzz": 76
      },
      "trend": "rising"
    }
  }
}
```

---

## Event Graph Integration

### Z-Events Sync Flow

```
Z-Events API → Event Bus → Geo Intelligence
                    ↓
              EventGraphService
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Create Event    Update Graph    Capture Signals
    Node         Edges          (Booking/Checkin)
```

### Event Graph Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/events/sync` | Token | Sync event from Z-Events |
| POST | `/api/events/booking-signal` | Token | Capture booking signal |
| POST | `/api/events/checkin-signal` | Token | Capture check-in signal |
| GET | `/api/events/near` | Optional | Find events near location |
| GET | `/api/events/by-affinity` | Token | Get events by user affinity |
| GET | `/api/events/:eventId/demand` | Optional | Get event demand prediction |
| GET | `/api/events/:eventId/merchants` | Optional | Get nearby merchants |

### Spillover Effects by Category

| Category | Ride Increase | Restaurant | Hotel | Nightlife |
|----------|---------------|------------|-------|-----------|
| Music | 0.9 | 0.6 | 0.15 | 0.8 |
| Sports | 0.7 | 0.5 | 0.1 | 0.2 |
| Tech | 0.4 | 0.7 | 0.4 | 0.0 |
| Food | 0.3 | 0.8 | 0.1 | 0.0 |
| Art | 0.5 | 0.5 | 0.1 | 0.3 |

---

## Graph Services

### Node Types

| Node | Schema | Geospatial Index |
|------|--------|------------------|
| Consumer | GeoConsumer | homeLocation, workLocation |
| Merchant | GeoMerchant | location |
| Event | GeoEvent | venue.location |
| Zone | GeoZone | center, boundary |

### Graph Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/graph/stats` | Optional | Get graph statistics |
| GET | `/api/graph/consumer/:userId` | Token | Get consumer profile |
| GET | `/api/graph/merchants/near` | Optional | Find merchants near location |
| GET | `/api/graph/consumers/near` | Token | Find consumers near location |

---

## Recommendation Service

### Context Types

| Context | Description | Use Case |
|---------|-------------|----------|
| `event` | Event-focused recommendations | Z-Events app |
| `ride` | Ride destination suggestions | ReZ Ride app |
| `food` | Restaurant recommendations | Merchant discovery |
| `hotel` | Hotel suggestions | StayOwn integration |
| `general` | Unified recommendations | Cross-app |
| `navigation` | Drop-off suggestions | Rider driver app |

### Recommendation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/recommendations` | Token | Unified recommendations |
| GET | `/api/recommendations/ride` | Token | Ride recommendations |
| GET | `/api/recommendations/food` | Token | Food recommendations |
| POST | `/api/recommendations/cross-app` | Token | Sync cross-app activity |

---

## Demand Prediction

### Base Demand by Time

| Time Slot | Ride | Delivery | Restaurant | Hotel |
|-----------|------|----------|------------|-------|
| Morning (7-9) | 0.6 | 0.2 | 0.1 | 0.3 |
| Lunch (12-14) | 0.4 | 0.7 | 0.8 | 0.4 |
| Evening (17-19) | 0.7 | 0.3 | 0.3 | 0.4 |
| Dinner (19-22) | 0.5 | 0.8 | 0.9 | 0.5 |
| Late Night (22-5) | 0.3 | 0.4 | 0.2 | 0.6 |

### Demand Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/demand/zone/:zoneId` | Optional | Predict zone demand |
| GET | `/api/demand/near` | Optional | Predict demand near location |

---

## Event Bus Subscriptions

### Subscribed Channels

| Channel | Payload | Action |
|---------|---------|--------|
| `event.booked` | Booking data | Update consumer affinities |
| `event.checkin` | Check-in data | Update attendance metrics |
| `event.cancelled` | Event data | Update event status |
| `event.viewed` | View data | Track engagement |
| `event.shared` | Share data | Track virality |
| `user.location_updated` | Location data | Update user location |
| `merchant.nearby_event` | Event data | Update merchant proximity |

---

## Authentication

### Headers Required

| Header | Description | Required For |
|--------|-------------|--------------|
| `X-Internal-Token` | Service authentication token | All authenticated endpoints |
| `X-User-Id` | User ID for context | Authenticated requests |

### Auth Levels

| Level | Description | Endpoints |
|-------|-------------|-----------|
| `authenticate` | Token + User ID required | `/graph/consumer`, `/events/sync` |
| `optionalAuth` | Token optional, user extracted if present | Most endpoints |
| Public | No auth required | `/health`, `/ready` |

---

## Environment Variables

```bash
# Service
PORT=4140
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/rez-geo-intelligence

# Cache
REDIS_URL=redis://localhost:6379

# Security
INTERNAL_SERVICE_TOKEN=your-secret-token

# Event Bus
EVENT_BUS_URL=http://localhost:4082

# External Services
RIDE_SERVICE_URL=http://localhost:4007
ORDER_SERVICE_URL=http://localhost:4006
EVENT_SERVICE_URL=http://localhost:4101
WEATHER_SERVICE_URL=http://localhost:4105
SOCIAL_SERVICE_URL=http://localhost:4110
FOOTFALL_SERVICE_URL=http://localhost:4115
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| General API | 1000 requests/minute |
| Graph queries | 100 requests/minute |
| Demand predictions | 200 requests/minute |
| Seed operations | 10 requests/minute |

---

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service health check |
| `GET /ready` | Readiness check (MongoDB connected) |

### Health Response

```json
{
  "status": "healthy",
  "service": "rez-geo-intelligence",
  "version": "1.0.0",
  "timestamp": "2026-05-24T16:00:00.000Z",
  "mongodb": "connected"
}
```
