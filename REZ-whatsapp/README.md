# REZ WhatsApp - Unified WhatsApp Layer

**Port:** 4202

A unified WhatsApp commerce and messaging layer that consolidates all WhatsApp functionality into one canonical service.

## Overview

This service replaces 4 separate WhatsApp services:
- `rez-whatsapp-commerce` (4031)
- `rez-whatsapp-store`
- `rez-whatsapp-provisioning` (3005)
- `rez-whatsapp-orchestrator-bridge` (4010)

## Features

### Conversation Engine
- **14-state conversation machine**: idle, browsing, searching, viewing_product, adding_to_cart, cart_review, checkout, payment_pending, order_confirmed, support, tracking, completed, expired
- **NLP-based intent detection**: Automatically detects user intent from messages
- **Context-aware responses**: Maintains conversation context across interactions

### Session Management
- **Redis + MongoDB persistence**: Fast reads with durable storage
- **Multi-tenant support**: Separate sessions per merchant
- **24-hour default timeout**: Configurable session TTL

### Messaging
- **Send/receive WhatsApp messages**
- **Template message support**
- **Broadcast campaigns**
- **Message deduplication**

### Commerce
- **Cart management**: Add, update, remove items
- **Order creation**: With payment links
- **Delivery tracking**: Real-time status updates

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start service
npm start

# Development mode
npm run dev
```

## API Endpoints

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/send` | Send WhatsApp message |
| POST | `/api/whatsapp/session` | Create session |
| GET | `/api/whatsapp/session/:userId` | Get session |
| DELETE | `/api/whatsapp/session/:userId` | End session |

### Cart & Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/cart` | Cart operations |
| POST | `/api/whatsapp/checkout` | Create order |
| GET | `/api/whatsapp/orders` | List orders |
| GET | `/api/whatsapp/orders/:id` | Get order |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| GET | `/api/templates/:id` | Get template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/send` | Send template |

### Broadcast

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/broadcast` | Start broadcast |
| GET | `/api/broadcast/:id` | Get broadcast status |
| POST | `/api/broadcast/:id/cancel` | Cancel broadcast |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/whatsapp` | WhatsApp webhook |
| GET | `/webhook/whatsapp` | Webhook verification |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Full health check |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |

## Example Usage

### Create Session
```bash
curl -X POST http://localhost:4202/api/whatsapp/session \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "userId": "user_123",
    "merchantId": "merchant_456"
  }'
```

### Send Message
```bash
curl -X POST http://localhost:4202/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "to": "+919876543210",
    "message": "Hello from REZ!"
  }'
```

### Add to Cart
```bash
curl -X POST http://localhost:4202/api/whatsapp/cart \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "sessionId": "session_123",
    "operation": "add",
    "item": {
      "productId": "prod_456",
      "name": "Pizza Margherita",
      "price": 299,
      "quantity": 2,
      "merchantId": "merchant_456"
    }
  }'
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | No (default: 4202) |
| MONGODB_URI | MongoDB connection | Yes |
| REDIS_URL | Redis connection | Yes |
| TWILIO_ACCOUNT_SID | Twilio Account SID | Yes |
| TWILIO_AUTH_TOKEN | Twilio Auth Token | Yes |
| WHATSAPP_PHONE_NUMBER | WhatsApp number | Yes |
| INTERNAL_SERVICE_TOKEN | Internal auth token | Yes |

## Architecture

```
WhatsApp Cloud API
       ↓
┌──────────────────────────────────────┐
│    Unified WhatsApp Layer (4202)     │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────┐  ┌────────────┐ │
│  │ Conversation │  │  Session   │ │
│  │    Engine    │  │  Manager   │ │
│  └──────────────┘  └────────────┘ │
│                                      │
│  ┌──────────────┐  ┌────────────┐ │
│  │    Cart     │  │  Template  │ │
│  │   Service   │  │  Manager   │ │
│  └──────────────┘  └────────────┘ │
│                                      │
│  ┌──────────────┐  ┌────────────┐ │
│  │    Order    │  │ Broadcast  │ │
│  │   Service   │  │  Service   │ │
│  └──────────────┘  └────────────┘ │
│                                      │
└──────────────────────────────────────┘
       ↓
  ┌─────┴─────┐
  │           │
  ▼           ▼
Redis      MongoDB
```

## License

MIT
