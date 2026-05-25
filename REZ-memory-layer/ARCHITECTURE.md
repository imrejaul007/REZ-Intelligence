# REZ Memory Layer - Architecture

## Overview
Unified customer timeline service with event aggregation, segmentation, and preferences.

## Components

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer (Express)                      │
├───────────────────────────────────────────────────────┤
│  GET  /timeline/:userId       - Get user timeline           │
│  GET  /timeline/:userId/summary  - Get segments/preferences  │
│  POST /events                 - Ingest events             │
│  POST /events/batch           - Batch ingest              │
│  WS   /ws                   - Real-time subscriptions    │
└───────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────▼───────────────────────┐
│                    Service Layer                        │
├───────────────────────────────────────────────────────┤
│  EventNormalizer     - Standardize event format        │
│  TimelineAggregator - Build timeline + segments         │
│  CacheService      - Redis caching (24h TTL          │
│  EventConsumer     - WebSocket to Event Bus           │
└───────────────────────────────────────────────────┘
                              │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ MongoDB  │         │  Redis  │         │Event Bus│
   │ Events   │         │  Cache  │         │ Webhook │
   └─────────┘         └─────────┘         └─────────┘
```

## Data Model

```
Timeline Event:
├── userId          - Customer identifier
├── type            - Event type (order, view, cart, etc)
├── category        - commerce, loyalty, engagement
├── source         - whatsapp, app, web, api
├── timestamp      - Event time
├── data           - Event payload
└── metadata       - Session, device, location

Computed Profile:
├── segments       - active_shopper, vip, churned
├── preferences    - categories, brands, channels
├── patterns      - Behavioral patterns
└── metrics       - eventCount, lastSeen, firstSeen
```

## Event Flow

```
1. Event arrives (API/WebSocket/Event Bus)
2. Normalize to common schema
3. Store in MongoDB
4. Update profile cache
5. Compute new segments
6. Emit profile.updated event
```

## Caching Strategy

| Data | TTL | Eviction |
|------|-----|----------|
| Timeline | 24h | On new event |
| Segments | 1h | Manual |
| Preferences | 30m | Manual |

## Environment Variables

```bash
PORT=4201
MONGODB_URI=mongodb://localhost:27017/rez-memory
REDIS_URL=redis://localhost:6379
EVENT_BUS_URL=http://localhost:4025
CACHE_TTL_TIMELINE=86400
CACHE_TTL_SEGMENTS=3600
```
