# REZ RCS Bridge

Rich Communication Services (RCS) Bridge for India - supporting Jio and Airtel carriers.

## Overview

RCS is the successor to SMS, providing rich messaging capabilities including:
- Rich cards with images and buttons
- Carousels (horizontal scrolling cards)
- Quick reply suggestions
- Read receipts and typing indicators
- Two-way messaging

## Features

- **Multi-carrier support**: Jio RCS and Airtel RCS APIs
- **Rich message types**: Cards, carousels, button suggestions
- **Webhook handling**: Inbound messages and status updates
- **Message logging**: MongoDB persistence for all messages
- **Internal auth**: Service-to-service authentication
- **Health checks**: Readiness and liveness endpoints

## Prerequisites

- Node.js >= 18.0.0
- MongoDB 6.0+
- Redis 7.0+
- Jio RCS API credentials (for Jio)
- Airtel RCS API credentials (for Airtel)

## Installation

```bash
cd rez-rcs-bridge
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4087 |
| JIO_RCS_API_KEY | Jio API key | - |
| JIO_RCS_API_SECRET | Jio API secret | - |
| JIO_RCS_BASE_URL | Jio API base URL | https://api.jio.com/rcs/v1 |
| AIRTEL_RCS_API_KEY | Airtel API key | - |
| AIRTEL_RCS_API_SECRET | Airtel API secret | - |
| AIRTEL_RCS_BASE_URL | Airtel API base URL | https://api.airtel.in/rcs/v1 |
| ORCHESTRATOR_URL | Orchestrator service URL | http://localhost:4006 |
| INTERNAL_SERVICE_TOKENS_JSON | JSON map of service tokens | - |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| MONGODB_URI | MongoDB connection URI | mongodb://localhost:27017/rez_rcs |
| LOG_LEVEL | Logging level | info |

## API Endpoints

### Send Rich Card

```bash
POST /api/rcs/send
X-Internal-Token: <service-token>

{
  "to": "+919876543210",
  "card": {
    "title": "Hotel Booking Confirmed",
    "description": "Your room at Grand Hotel is confirmed",
    "imageUrl": "https://example.com/hotel.jpg",
    "buttons": [
      { "type": "url", "title": "View Details", "url": "https://example.com/booking" },
      { "type": "reply", "title": "Cancel", "value": "cancel_123" }
    ]
  }
}
```

### Send Carousel

```bash
POST /api/rcs/send-carousel
X-Internal-Token: <service-token>

{
  "to": "+919876543210",
  "cards": [
    {
      "title": "Room 1",
      "description": "Deluxe Room - $100/night",
      "imageUrl": "https://example.com/room1.jpg"
    },
    {
      "title": "Room 2",
      "description": "Suite - $200/night",
      "imageUrl": "https://example.com/room2.jpg"
    }
  ]
}
```

### Send Button Message

```bash
POST /api/rcs/send-button
X-Internal-Token: <service-token>

{
  "to": "+919876543210",
  "text": "How would you like to pay?",
  "buttons": [
    { "type": "url", "title": "Pay Now", "url": "https://example.com/pay" },
    { "type": "reply", "title": "Later", "value": "pay_later" }
  ]
}
```

### Get Message Status

```bash
GET /api/rcs/status/:messageId
X-Internal-Token: <service-token>
```

### Check Carriers

```bash
GET /api/rcs/carriers
X-Internal-Token: <service-token>
```

### Webhook Endpoint

```bash
POST /webhook/rcs
```

Receives status updates and inbound messages from carriers.

## RCS Message Types

### Rich Card

A standalone rich card with:
- Title (max 100 chars)
- Description (max 500 chars)
- Optional image
- Up to 4 buttons

### Carousel

Horizontal scrolling list of 1-10 rich cards.

### Button Suggestions

Text message with up to 4 suggestion buttons.

## Button Types

| Type | Description | Payload |
|------|-------------|---------|
| url | Opens a URL | `url` field |
| phone | Dials a phone number | `phoneNumber` field |
| reply | Sends reply to bot | `value` field |
| quickReply | Quick suggestion reply | `value` field |
| copy | Copies text to clipboard | `value` field |
| location | Requests/picks location | `value` field |

## Phone Number Format

Phone numbers should be in E.164 format:
- `+919876543210` (with country code)
- `9876543210` (10-digit Indian mobile)

The service automatically normalizes phone numbers.

## RCS in India

### Jio RCS
- Google's Jibe platform integration
- Available on JioPhones and Android
- Requires Jio RCS business account

### Airtel RCS
- Integrated with Airtel's network
- Supports both consumer and business RCS
- OAuth2 authentication

### When RCS Fails

The service is designed to work with:
1. **Primary carrier**: If configured, attempts Jio first
2. **Fallback carrier**: Falls back to Airtel if Jio fails
3. **Future expansion**: Add more carriers as needed

## Development

```bash
# Build
npm run build

# Run
npm start

# Development mode
npm run dev

# Lint
npm run lint
```

## Architecture

```
rez-rcs-bridge/
├── src/
│   ├── config/          # Configuration and validation
│   ├── models/          # Data models and schemas
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic and SDK clients
│   ├── utils/           # Utilities (logger, auth)
│   └── index.ts         # Application entry point
├── .env.example         # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Message Flow

1. **Outbound**:
   - Service calls RCS API (Jio/Airtel)
   - Carrier delivers to recipient
   - Webhook reports delivery/read status
   - Status updated in database

2. **Inbound**:
   - User sends RCS message
   - Carrier forwards to webhook
   - Webhook validated and processed
   - Message logged and forwarded to orchestrator

## Security

- Internal endpoints require `X-Internal-Token` header
- Webhook signatures verified per carrier
- All credentials in environment variables
- No secrets in code or logs

## License

Proprietary - ReZ Commerce Platform
