# REZ SMS Bridge

REZ SMS Bridge connects SMS messages to the Orchestrator service, enabling customers to interact with the REZ platform via SMS.

## Overview

This service acts as a bridge between Twilio webhooks and the Orchestrator, parsing SMS commands and forwarding them to the appropriate backend services.

## Features

- **Incoming SMS Handling**: Receive and process SMS from Twilio webhooks
- **Command Parsing**: Parse SMS commands like `REZ ORDER BIRYANI`, `REZ STATUS 123`
- **Multiple SMS Providers**: Support for Twilio (primary) and MSG91 (backup)
- **Orchestrator Integration**: Forward parsed commands to the Orchestrator service
- **Template SMS**: Send templated messages (order confirmations, status updates, etc.)
- **Bulk SMS**: Send SMS to multiple recipients
- **Rate Limiting**: Duplicate message prevention via Redis
- **Internal Auth**: Secure service-to-service authentication

## SMS Commands

| Command | Format | Description |
|---------|--------|-------------|
| Order | `REZ ORDER <item> [qty] [notes]` | Place a new order |
| Status | `REZ STATUS <orderId>` | Check order status |
| Cancel | `REZ CANCEL <orderId> [reason]` | Cancel an order |
| Feedback | `REZ FEEDBACK <orderId> <1-5> [comment]` | Submit order feedback |
| Track | `REZ TRACK <orderId>` | Track order in real-time |
| Menu | `REZ MENU [category]` | View menu items |
| Help | `REZ HELP` | Get help information |
| Account | `REZ ACCOUNT [info/orders/address]` | View account details |

### Example Commands

```
REZ ORDER BIRYANI 2 no spice
REZ STATUS ORD123456
REZ CANCEL ORD123456 changed my mind
REZ FEEDBACK ORD123456 5 Great food!
REZ HELP
```

## Setup

### Prerequisites

- Node.js 18+
- Redis (for rate limiting)
- MongoDB (optional, for audit logging)
- Twilio account
- MSG91 account (optional, as backup)

### Installation

```bash
cd REZ-Intelligence/rez-sms-bridge
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=4085
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
MSG91_API_KEY=your_msg91_api_key
ORCHESTRATOR_URL=http://localhost:4006
INTERNAL_SERVICE_TOKENS_JSON={"orchestrator":"your-token"}
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/rez_sms_bridge
```

### Twilio Webhook Setup

1. Log into your Twilio Console
2. Navigate to Phone Numbers > Manage Numbers
3. Select your phone number
4. Scroll to "Messaging Configuration"
5. Set "A MESSAGE COMES IN" webhook to: `https://your-domain.com/webhook/sms`

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/webhook/sms` | Twilio Signature | Receive incoming SMS |
| POST | `/api/sms/send` | X-Internal-Token | Send plain SMS |
| POST | `/api/sms/send-template` | X-Internal-Token | Send templated SMS |
| POST | `/api/sms/send-bulk` | X-Internal-Token | Send bulk SMS |

## Internal API Authentication

All internal endpoints require the `X-Internal-Token` header with a valid service token configured in `INTERNAL_SERVICE_TOKENS_JSON`.

```bash
curl -X POST http://localhost:4085/api/sms/send \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{"to": "+919876543210", "message": "Your order is confirmed!"}'
```

## Architecture

```
                    ┌─────────────────┐
                    │                 │
    SMS ────────────>│     Twilio      │
                    │                 │
                    └────────┬────────┘
                             │ Webhook
                             ▼
                    ┌─────────────────┐
                    │                 │
                    │  REZ SMS Bridge │
                    │    (Port 4085)  │
                    │                 │
                    └────────┬────────┘
                             │ Internal API
                             ▼
                    ┌─────────────────┐
                    │                 │
                    │   Orchestrator  │
                    │   (Port 4006)   │
                    │                 │
                    └─────────────────┘
```

## SMS Flow

1. User sends SMS to REZ phone number
2. Twilio forwards to `/webhook/sms`
3. Service parses command (e.g., `REZ ORDER BIRYANI`)
4. Command forwarded to Orchestrator
5. Orchestrator processes and returns response
6. Confirmation SMS sent to user (if needed)

## Error Handling

- Invalid commands return help message
- Orchestrator failures return error message to user
- Duplicate messages within 60 seconds are ignored
- All errors are logged with context

## Monitoring

Logs are output in JSON format for easy parsing by log aggregators:

```json
{
  "level": "info",
  "message": "SMS sent successfully",
  "timestamp": "2026-05-13T10:30:00.000Z",
  "to": "+919876543210",
  "messageLength": 45
}
```

## License

Proprietary - REZ Commerce Platform
