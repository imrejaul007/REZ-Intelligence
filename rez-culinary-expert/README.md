# REZ Culinary Expert Agent

A specialized AI agent for restaurants and food ordering, built as part of the REZ commerce platform.

## Overview

The REZ Culinary Expert Agent is an intelligent assistant that helps users:

- Browse and explore restaurant menus
- Get personalized food recommendations
- Filter dishes based on dietary restrictions and allergies
- Find perfect food and drink pairings
- Place and manage food orders
- Learn about cuisines, ingredients, and nutritional information

## Features

### Core Capabilities

- **Menu Navigation**: Full menu browsing with category organization, search, and filtering
- **Smart Recommendations**: AI-powered suggestions based on preferences, mood, occasion, and dietary needs
- **Dietary Filtering**: Comprehensive support for vegetarian, vegan, gluten-free, keto, paleo, and other diets
- **Allergen Awareness**: Detection and warning for the 9 major food allergens
- **Food Pairing**: Wine, beer, cocktail, and non-alcoholic pairing suggestions
- **Order Management**: Complete order flow from cart to confirmation

### Technical Features

- **TypeScript**: Full type safety with Zod schema validation
- **Express.js**: RESTful API with comprehensive route handling
- **MongoDB**: Document storage for menus, orders, and user profiles
- **Redis**: Caching layer for performance optimization
- **Anthropic AI**: Natural language understanding and generation
- **Rate Limiting**: Built-in DDoS protection
- **Helmet**: Security headers and CORS configuration
- **Winston Logging**: Structured logging with file rotation

## Project Structure

```
rez-culinary-expert/
├── src/
│   ├── config/
│   │   ├── systemPrompt.ts    # AI system prompt for culinary expert personality
│   │   ├── tone.ts            # Communication tone configuration
│   │   └── knowledge.ts       # Food knowledge base (cuisines, allergens, etc.)
│   ├── services/
│   │   ├── expertise.ts       # Food expertise and knowledge queries
│   │   ├── menuService.ts     # Menu browsing and search
│   │   ├── dietaryService.ts  # Dietary filtering and allergen checking
│   │   └── recommendations.ts # Personalized recommendations
│   ├── intents/
│   │   ├── culinaryIntents.ts # Intent classification system
│   │   └── orderFlow.ts       # Order state machine
│   ├── responses/
│   │   └── templates.ts      # Response formatting templates
│   ├── routes/
│   │   └── culinary.routes.ts # Express API routes
│   ├── utils/
│   │   └── logger.ts          # Winston logging utility
│   └── index.ts               # Main entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# - Set MONGODB_URI
# - Set REDIS_URL
# - Set ANTHROPIC_API_KEY
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

## API Endpoints

### Chat

```bash
POST /api/culinary/chat
```

Send a natural language message and get an AI-powered response.

**Request:**
```json
{
  "message": "What do you recommend for a romantic dinner?",
  "userId": "user123",
  "restaurantId": "rest456",
  "tone": "default"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Here are my recommendations...",
    "intent": "GET_RECOMMENDATION",
    "confidence": 0.85
  }
}
```

### Menu

```bash
# Get full menu
GET /api/culinary/menu/:restaurantId

# Search menu items
POST /api/culinary/menu/:restaurantId/search
{
  "searchQuery": "pasta",
  "filters": {
    "dietaryTags": ["vegetarian"],
    "excludeAllergens": ["peanuts"]
  }
}

# Get item details
GET /api/culinary/menu/:restaurantId/items/:itemId
```

### Recommendations

```bash
# Get personalized recommendations
POST /api/culinary/recommendations
{
  "restaurantId": "rest456",
  "userId": "user123",
  "context": {
    "occasion": "date",
    "mood": "indulgent",
    "budget": "moderate"
  },
  "limit": 5
}

# Get pairing suggestions
GET /api/culinary/pairings/:restaurantId/:itemId?type=wine
```

### Dietary Management

```bash
# Set dietary restriction
POST /api/culinary/dietary/restrictions
{
  "userId": "user123",
  "restriction": "vegetarian",
  "enabled": true
}

# Update allergy profile
POST /api/culinary/dietary/allergies
{
  "userId": "user123",
  "allergies": [
    {
      "allergenId": "peanuts",
      "severity": "severe",
      "notes": "Carries EpiPen"
    }
  ]
}

# Check dish compatibility
POST /api/culinary/dietary/check
{
  "userId": "user123",
  "restaurantId": "rest456",
  "itemId": "item789"
}
```

### Orders

```bash
# Start order
POST /api/culinary/orders/start
{
  "userId": "user123",
  "restaurantId": "rest456"
}

# Add item to order
POST /api/culinary/orders/add-item
{
  "userId": "user123",
  "restaurantId": "rest456",
  "itemId": "item789",
  "quantity": 2,
  "specialInstructions": "Extra sauce on the side"
}

# Place order
POST /api/culinary/orders/place
{
  "userId": "user123",
  "restaurantId": "rest456",
  "pickup": false,
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94105"
  },
  "paymentMethod": "card",
  "tip": 5.00
}

# Cancel order
POST /api/culinary/orders/cancel
{
  "userId": "user123",
  "orderId": "order789"
}

# Get order history
GET /api/culinary/orders/:userId
```

### Expertise

```bash
# Get all cuisines
GET /api/culinary/expertise/cuisines

# Get cuisine info
GET /api/culinary/expertise/cuisines/italian

# Get dietary tags
GET /api/culinary/expertise/dietary

# Get expertise summary
GET /api/culinary/expertise/summary
```

### Health

```bash
# Health check
GET /health

# Readiness check
GET /ready
```

## Intent Classification

The agent automatically classifies user messages into these intents:

| Intent | Description | Example |
|--------|-------------|---------|
| GREETING | User says hello | "Hi there!" |
| VIEW_MENU | User wants to see menu | "Show me the menu" |
| SEARCH_ITEMS | User searches for items | "Find me pasta dishes" |
| GET_RECOMMENDATION | User wants suggestions | "What do you recommend?" |
| GET_PAIRING | User wants pairings | "What wine goes with this?" |
| SET_DIETARY_RESTRICTION | User mentions diet | "I'm vegetarian" |
| CHECK_ALLERGENS | User asks about allergens | "Does this contain nuts?" |
| ADD_TO_ORDER | User adds item | "Add this to my order" |
| PLACE_ORDER | User places order | "Place my order" |
| GET_NUTRITION | User asks about nutrition | "How many calories?" |
| GET_INGREDIENTS | User asks about ingredients | "What's in this dish?" |
| HELP | User asks for help | "What can you do?" |

## Dietary Tags Supported

- Vegetarian
- Vegan
- Gluten-Free
- Dairy-Free
- Nut-Free
- Keto
- Paleo
- Low-Carb
- Whole30
- Halal
- Kosher

## Major Allergens (FDA Big 9)

- Milk/Dairy
- Eggs
- Fish
- Shellfish
- Tree Nuts
- Peanuts
- Wheat
- Soybeans
- Sesame

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection URI | mongodb://localhost:27017 |
| MONGODB_DB_NAME | Database name | rez_culinary |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| ANTHROPIC_API_KEY | Anthropic API key | - |
| INTERNAL_SERVICE_TOKENS_JSON | Service tokens for internal auth | {} |
| CORS_ORIGINS | Allowed CORS origins | http://localhost:3000 |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 60000 |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 |

## Security

- All webhook handlers use HMAC signature verification
- Internal endpoints require X-Internal-Token header
- Rate limiting prevents abuse
- Helmet.js provides security headers
- Input validation with Zod schemas
- Parameterized MongoDB queries

## Monitoring

The service exports metrics via the health endpoints:

- `/health` - Full health check with service status
- `/ready` - Readiness probe for Kubernetes

Logs are written to:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

## Integration with Other Services

The Culinary Expert Agent integrates with:

- **REZ Intent Graph**: For intent tracking and ML scoring
- **REZ Payment Service**: For order payments
- **REZ Order Service**: For order management
- **REZ Notification Service**: For order updates

Service-to-service communication uses the `X-Internal-Token` header for authentication.

## License

MIT
