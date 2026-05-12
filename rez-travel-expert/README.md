# REZ Travel Expert

A purpose-built travel expert agent for the REZ commerce platform, providing intelligent destination recommendations, itinerary planning, and travel assistance.

## Features

- **Destination Discovery**: Intelligent recommendations based on travel style, budget, and preferences
- **Itinerary Planning**: Day-by-day trip planning with activity suggestions and timing
- **Transportation Booking**: Flight, train, bus, and car rental options and comparisons
- **Accommodation Search**: Hotels, resorts, vacation rentals, and boutique stays
- **Budget Planning**: Detailed cost estimates and budget optimization
- **Seasonal Advice**: Best time to visit, weather insights, and travel tips
- **Packing Guidance**: Essential packing lists and travel tips

## Architecture

```
rez-travel-expert/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── config/
│   │   ├── systemPrompt.ts          # Agent personality and behavior
│   │   └── knowledge.ts            # Destinations, transport, accommodations
│   ├── services/
│   │   └── travelExpert.ts         # Core travel expertise logic
│   ├── intents/
│   │   └── travelIntents.ts        # Intent recognition and entity extraction
│   └── routes/
│       └── travel.routes.ts         # API endpoints
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### Chat
```
POST /api/v1/travel/chat
```
Process travel-related messages and return intelligent responses.

### Destinations
```
GET  /api/v1/travel/destinations           # List all destinations
GET  /api/v1/travel/destinations/:id       # Get destination details
```

### Trips
```
POST   /api/v1/travel/trips                 # Create a new trip
GET    /api/v1/travel/trips                 # List trips
GET    /api/v1/travel/trips/:id             # Get trip by ID
PATCH  /api/v1/travel/trips/:id             # Update trip
DELETE /api/v1/travel/trips/:id             # Cancel trip
```

### Planning
```
POST /api/v1/travel/itinerary/generate      # Generate itinerary
POST /api/v1/travel/budget/estimate         # Get budget estimate
```

### Reference Data
```
GET /api/v1/travel/transport-options        # List transport modes
GET /api/v1/travel/accommodation-types      # List accommodation types
```

## Destination Types

| Type | Description |
|------|-------------|
| `beach` | Tropical beaches and coastal destinations |
| `city` | Urban destinations and metropolitan areas |
| `mountain` | Mountain retreats and alpine destinations |
| `adventure` | Adventure travel and outdoor activities |
| `romantic` | Honeymoon and romantic getaways |
| `cultural` | Cultural immersion and historical sites |
| `nature` | Natural wonders and eco-tourism |
| `luxury` | High-end luxury destinations |

## Budget Levels

| Level | Daily Budget (per person) |
|-------|---------------------------|
| `budget` | $60-$120 |
| `moderate` | $120-$250 |
| `luxury` | $250-$500 |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3003 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |
| HOTEL_SERVICE_URL | Hotel service URL | localhost:4003 |
| TRANSPORT_SERVICE_URL | Transport service URL | localhost:4004 |
| BOOKING_SERVICE_URL | Booking service URL | localhost:4005 |

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode
npm run dev
```

## Example Usage

### Send a travel message
```bash
curl -X POST http://localhost:3003/api/v1/travel/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to go somewhere warm for 7 days with my partner",
    "context": {
      "traveler": {
        "id": "user_123",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "preferences": ["beach", "romantic"],
        "budgetLevel": "moderate",
        "tier": "premium"
      }
    }
  }'
```

### Create a trip
```bash
curl -X POST http://localhost:3003/api/v1/travel/trips \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "maldives",
    "startDate": "2024-06-15T00:00:00Z",
    "endDate": "2024-06-22T00:00:00Z",
    "travelers": 2,
    "budget": 5000,
    "styles": ["beach", "romantic"]
  }'
```

### Get budget estimate
```bash
curl -X POST http://localhost:3003/api/v1/travel/budget/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "destinationId": "bali",
    "duration": 10,
    "travelers": 2,
    "budgetLevel": "moderate"
  }'
```

### Generate itinerary
```bash
curl -X POST http://localhost:3003/api/v1/travel/itinerary/generate \
  -H "Content-Type: application/json" \
  -d '{
    "destinationId": "tokyo",
    "days": 5
  }'
```

## Travel Styles

The agent recognizes these travel styles:
- `adventure` - Active outdoor activities and thrills
- `relaxation` - Beach, spa, and peaceful retreats
- `cultural` - Museums, history, and local traditions
- `romantic` - Honeymoon and couple getaways
- `family` - Family-friendly activities
- `budget` - Cost-conscious travel
- `luxury` - High-end experiences
- `foodie` - Culinary experiences
- `nature` - Wildlife and natural wonders

## License

Proprietary - REZ Commerce Platform
