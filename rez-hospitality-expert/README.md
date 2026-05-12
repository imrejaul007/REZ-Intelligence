# REZ Hospitality Expert Agent

A specialized AI concierge agent for hotels, stays, and resorts. Built with TypeScript, Express, and MongoDB.

## Overview

The REZ Hospitality Expert Agent is designed to provide exceptional guest experiences through:

- **Warm, Personalized Service**: AI-powered responses that feel like talking to a dedicated concierge
- **Comprehensive Intent Detection**: Understands 16+ hospitality-specific intents
- **Workflow Automation**: Streamlined check-in/check-out processes
- **Smart Recommendations**: Personalized room upgrades, dining, and local suggestions
- **Multi-channel Integration**: REST API ready for web, mobile, and chatbot platforms

## Features

### Intent Categories

| Category | Intents |
|----------|---------|
| **Arrivals** | Check-In, Early Check-In |
| **Departures** | Check-Out, Late Check-Out, Luggage Storage |
| **Dining** | Room Service, Restaurant Reservations, Menu Inquiries |
| **Housekeeping** | Cleaning, Turndown, Extra Amenities, Maintenance |
| **Concierge** | Local Recommendations, Tour Bookings, Transportation |
| **Wellness** | Spa Treatments, Fitness Center, Pool Access |
| **Business** | Meeting Rooms, Workstation Setup, Airport Transfers |
| **Support** | Complaints, Billing, WiFi Technical Support |

### Room Types Supported

- Standard, Deluxe, Executive
- Suites: Junior Suite, One-Bedroom Suite, Presidential Suite
- Specialty: Family, Ocean View, Pool View, Accessible

### Amenities Knowledge Base

- 25+ property amenities with hours, locations, and pricing
- Restaurant and dining options
- Spa and wellness services
- Recreation and activities
- Accessibility services

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB 6+
- Redis 7+ (optional, for production)

### Installation

```bash
# Navigate to project directory
cd REZ-Intelligence/rez-hospitality-expert

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Add your ANTHROPIC_API_KEY for AI features
```

### Configuration

Edit `.env`:

```env
PORT=3015
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=rez_hospitality
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your_api_key_here
LOG_LEVEL=info
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## API Reference

### Base URL

```
http://localhost:3015/api/v1/hospitality
```

### Endpoints

#### Health Check

```http
GET /health
```

Returns service health status.

#### Create Session

```http
POST /session
Content-Type: application/json

{
  "guestId": "guest-123",
  "reservationId": "res-456",
  "language": "en"
}
```

#### Chat

```http
POST /chat
Content-Type: application/json

{
  "sessionId": "uuid-session-id",
  "message": "I'd like to check in please",
  "guestId": "guest-123",
  "reservationId": "res-456"
}
```

**Response:**

```json
{
  "sessionId": "uuid-session-id",
  "message": "Welcome! I'm delighted to assist with your check-in...",
  "intent": "CHECK_IN",
  "confidence": 0.95,
  "quickReplies": ["Start check-in", "Early check-in", "Arrival info"],
  "metadata": {
    "sentiment": "positive"
  }
}
```

#### Workflow Actions

```http
POST /workflow
Content-Type: application/json

{
  "sessionId": "uuid-session-id",
  "workflowType": "checkin",
  "action": "start"
}
```

#### Get Amenities

```http
GET /amenities?category=PROPERTY
```

#### Get Recommendations

```http
GET /recommendations?type=rooms&sessionId=uuid-session-id
GET /recommendations?type=dining
GET /recommendations?type=local
```

### Error Responses

```json
{
  "error": "Validation Error",
  "message": "Request body validation failed",
  "details": [
    {
      "field": "message",
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

## Architecture

```
src/
├── config/           # Configuration files
│   ├── index.ts      # Main config
│   ├── systemPrompt.ts
│   ├── tone.ts
│   └── knowledge.ts
├── intents/          # Intent handlers
│   ├── hospitalityIntents.ts
│   └── checkInOut.ts
├── middleware/       # Express middleware
│   └── validation.ts
├── responses/        # Response templates
│   └── templates.ts
├── routes/           # API routes
│   └── hospitality.routes.ts
├── services/         # Business logic
│   ├── expertise.ts
│   ├── workflows.ts
│   └── recommendations.ts
├── types/            # TypeScript types
│   └── index.ts
├── utils/            # Utilities
│   └── logger.ts
└── index.ts          # Entry point
```

## Supported Intents

| Intent | Description | Typical Response |
|--------|-------------|------------------|
| `CHECK_IN` | Guest arrival and registration | Welcome flow, early check-in options |
| `CHECK_OUT` | Guest departure process | Bill review, luggage storage options |
| `ROOM_SERVICE` | In-room dining orders | Menu options, delivery times |
| `HOUSEKEEPING` | Room cleaning and amenities | Turndown, extra towels, maintenance |
| `CONCIERGE` | Local recommendations | Restaurant, tours, transportation |
| `AMENITIES` | Property facilities info | Pool, gym, spa hours |
| `DINING` | Restaurant information | Reservations, menus, dietary |
| `SPA_WELLNESS` | Spa and wellness services | Treatment booking, packages |
| `TRANSPORTATION` | Transportation arrangements | Airport transfers, car rental |
| `LOCAL_RECOMMENDATIONS` | Nearby attractions | Beaches, shopping, dining |
| `ROOM_UPGRADE` | Upgrade suggestions | Suite options, pricing |
| `COMPLAINT` | Issue resolution | Empathy, escalation if needed |
| `GENERAL_INQUIRY` | Miscellaneous questions | Information provision |
| `EMERGENCY` | Urgent situations | Immediate assistance |
| `BILLING` | Payment and charges | Bill review, disputes |
| `WIFI_TECHNICAL` | Technical support | Password, connection help |

## Tone Configuration

The agent adapts its tone based on context:

| Tone | Use Case |
|------|----------|
| `WELCOME` | Check-in, check-out, greetings |
| `PROFESSIONAL` | Room service, billing, general |
| `SYMPATHETIC` | Complaints, issues |
| `ENTHUSIASTIC` | Dining, concierge, recommendations |
| `REASSURING` | Emergency, spa, problem resolution |
| `INFORMATIVE` | Amenities, policies |
| `DISCREET` | Sensitive matters |
| `PLAYFUL` | Light conversations |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/services/expertise.test.ts
```

## Development

### Building

```bash
# TypeScript compilation
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Project Structure

```
rez-hospitality-expert/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts           # Express server
│   ├── config/            # Configuration
│   ├── services/          # Business logic
│   ├── intents/           # Intent handlers
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   ├── responses/         # Response templates
│   ├── types/             # TypeScript types
│   └── utils/            # Utilities
└── tests/                 # Test files
```

## Integration

### Internal Service Authentication

For service-to-service calls, include the internal token:

```http
POST /api/v1/hospitality/chat
X-Internal-Token: your-internal-service-token
Content-Type: application/json

{
  "sessionId": "...",
  "message": "..."
}
```

### Webhook Integration

Receive updates from other services:

```typescript
// Example: Payment service webhook
POST /api/v1/hospitality/webhook/payment
X-Internal-Token: your-internal-token

{
  "event": "payment.completed",
  "reservationId": "res-123",
  "data": { ... }
}
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit a pull request

## License

MIT

## Support

For questions or support, contact the REZ engineering team.
