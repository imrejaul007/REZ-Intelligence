# REZ Consultant Agent

A purpose-built consultant agent for the REZ commerce platform, providing AI-powered travel recommendations, expert guidance, and personalized trip planning.

## Features

- **AI-Powered Recommendations**: Intelligent suggestions based on travel preferences, budget, and style
- **Personalized Itineraries**: Day-by-day trip planning with optimized schedules
- **Budget Optimization**: Smart allocation of travel budget across categories
- **Expert Destination Advice**: In-depth knowledge of destinations worldwide
- **Activity Suggestions**: Curated experiences matching travel styles
- **Accommodation Guidance**: Recommendations for perfect places to stay
- **Seasonal Advice**: Best timing recommendations for optimal travel experiences
- **Group Travel Planning**: Specialized support for families, friends, and teams

## Architecture

```
rez-consultant-agent/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── services/
│   │   ├── consultantAgent.ts       # Core consultation logic
│   │   └── recommendationEngine.ts  # AI recommendation engine
│   └── routes/
│       └── consultant.routes.ts   # API endpoints
├── package.json
└── tsconfig.json
```

## API Endpoints

### Consultation
```
POST /api/v1/consultant/consult
```
Process natural language travel consultation requests.

### Destinations
```
POST /api/v1/consultant/destinations  # Get destination recommendations
```

### Itinerary
```
POST /api/v1/consultant/itinerary  # Generate personalized itinerary
```

### Budget
```
POST /api/v1/consultant/budget/optimize  # Optimize travel budget
```

### Activities
```
POST /api/v1/consultant/activities  # Get activity recommendations
```

### Accommodations
```
POST /api/v1/consultant/accommodations  # Get accommodation recommendations
```

## Travel Styles

| Style | Description |
|-------|-------------|
| `budget` | Cost-conscious travel with value focus |
| `mid_range` | Balanced comfort and value |
| `luxury` | Premium experiences and accommodations |
| `adventure` | Active, thrill-seeking experiences |
| `relaxation` | Calm, spa-focused travel |
| `cultural` | Arts, history, and local experiences |
| `family` | Activities suitable for all ages |
| `romantic` | Couples-focused, intimate experiences |
| `solo` | Solo traveler friendly |
| `business` | Work-focused with efficiency |

## Experience Levels

| Level | Description |
|-------|-------------|
| `first_time` | New to the destination |
| `occasional` | Travels a few times per year |
| `regular` | Experienced traveler |
| `frequent` | Travels frequently |
| `expert` | Very experienced, knows the destination well |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3003 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |

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

### Natural Language Consultation
```bash
curl -X POST http://localhost:3003/api/v1/consultant/consult \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I want to plan a romantic trip for my anniversary, around 5 days, budget of 3000",
    "context": {
      "customer": {
        "id": "cust_123",
        "name": "John Doe",
        "email": "john@example.com",
        "travelStyle": "romantic",
        "experienceLevel": "occasional",
        "budgetRange": { "min": 2000, "max": 5000 },
        "preferredDestinations": ["bali", "santorini"],
        "preferredActivities": ["beach", "spa", "dining"],
        "travelFrequency": "occasionally",
        "groupSize": 2,
        "specialRequirements": [],
        "allergies": [],
        "accessibilityNeeds": [],
        "pastTrips": [],
        "loyaltyTier": "gold"
      },
      "budget": 3000,
      "travelDates": {
        "start": "2026-06-15",
        "end": "2026-06-20"
      }
    }
  }'
```

### Get Destination Recommendations
```bash
curl -X POST http://localhost:3003/api/v1/consultant/destinations \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 2500,
    "travelStyle": "adventure",
    "preferredActivities": ["hiking", "nature"],
    "groupSize": 2
  }'
```

### Generate Itinerary
```bash
curl -X POST http://localhost:3003/api/v1/consultant/itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Bali",
    "startDate": "2026-06-15",
    "endDate": "2026-06-20",
    "travelStyle": "mid_range",
    "budget": 2000,
    "groupSize": 2,
    "preferences": ["temples", "beach", "local cuisine"]
  }'
```

### Optimize Budget
```bash
curl -X POST http://localhost:3003/api/v1/consultant/budget/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "totalBudget": 3000,
    "duration": 5,
    "travelStyle": "luxury",
    "groupSize": 2,
    "destination": "Bali"
  }'
```

### Get Activity Recommendations
```bash
curl -X POST http://localhost:3003/api/v1/consultant/activities \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Bali",
    "travelStyle": "adventure",
    "budget": 500,
    "groupSize": 2,
    "preferences": ["hiking", "water sports"]
  }'
```

## Response Structure

### Consultation Response
```json
{
  "success": true,
  "data": {
    "response": "Human-readable message with recommendations",
    "recommendations": [...],
    "insights": [...],
    "nextSteps": [...],
    "data": {...}
  },
  "meta": {
    "sessionId": "uuid",
    "processingTimeMs": 123,
    "timestamp": "ISO8601"
  }
}
```

## Recommendation Types

| Type | Description |
|------|-------------|
| `destination` | Country/city recommendations |
| `activity` | Tours, experiences, and things to do |
| `accommodation` | Hotels, resorts, rentals |
| `restaurant` | Dining recommendations |
| `transport` | Transportation options |
| `experience` | Unique experiences |

## Budget Allocation

The budget optimization engine recommends:

| Category | Budget % (Luxury) | Budget % (Mid-Range) | Budget % (Budget) |
|----------|-------------------|----------------------|-------------------|
| Accommodation | 45% | 35% | 25% |
| Activities | 15% | 25% | 30% |
| Food & Dining | 20% | 20% | 20% |
| Transportation | 10% | 10% | 15% |
| Contingency | 5% | 5% | 5% |

## License

Proprietary - REZ Commerce Platform
