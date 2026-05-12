# REZ WhatsApp → Orchestrator Bridge

A production-ready bridge service that routes WhatsApp messages to the REZ agent orchestrator and delivers responses back to users via WhatsApp.

## Features

- **WhatsApp Webhook Integration**: Receives incoming messages via WhatsApp Business API webhooks
- **Orchestrator Routing**: Routes messages to the appropriate agent via the orchestrator
- **Response Bridge**: Queues and delivers responses back to WhatsApp users
- **Session Management**: Maintains user sessions with Redis for context continuity
- **Health Monitoring**: Built-in health checks and queue status monitoring
- **Retry Logic**: Automatic retries with exponential backoff for failed operations
- **Signature Verification**: HMAC-SHA256 webhook signature verification

## Architecture

```
WhatsApp → Webhook → MessageBridge → Orchestrator → ResponseBridge → WhatsApp
              ↓                         ↓
           Redis                    Redis
        (Sessions)               (Queue)
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis server
- WhatsApp Business API access
- REZ Orchestrator running

### Installation

```bash
cd rez-whatsapp-orchestrator-bridge
npm install
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=4010
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379

# Orchestrator
ORCHESTRATOR_URL=http://localhost:4015
INTERNAL_SERVICE_TOKEN=your-internal-token

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret

# Bridge Settings
SESSION_TTL_SECONDS=86400
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://rez.money
```

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

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with queue status |
| GET | `/ready` | Readiness probe |
| GET | `/api/queue/status` | Queue processing status |

### Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook` | WhatsApp webhook verification |
| POST | `/webhook` | WhatsApp webhook events |
| POST | `/webhook/test` | Send test message (dev) |

### Internal API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send` | Send message to WhatsApp user |

## Webhook Setup

1. Use a tool like ngrok to expose your local server:
   ```bash
   ngrok http 4010
   ```

2. Configure your WhatsApp Business API webhook:
   - URL: `https://your-domain.com/webhook`
   - Verify Token: Set in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

3. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`
   - `message_reactions`

## Message Types Supported

| Type | Description | Content |
|------|-------------|---------|
| `text` | Text messages | Message body |
| `image` | Image messages | Image URL with caption |
| `audio` | Audio messages | Media ID/URL |
| `document` | Document/file | Media ID/URL with filename |
| `video` | Video messages | Media ID/URL |
| `sticker` | Stickers | Media ID |
| `location` | Shared locations | Lat/Long with name |
| `interactive` | Button/list replies | Button or list selection |

## Response Types

The orchestrator can return different response types:

| Type | Behavior |
|------|----------|
| `text` | Sends plain text message |
| `image` | Sends image with optional caption |
| `template` | Sends WhatsApp template (format: `template:name:params`) |
| `interactive` | Sends text with quick reply options |

## Session Management

Sessions are stored in Redis with configurable TTL (default: 24 hours). Each session includes:

- Session ID (UUID)
- User ID (derived from phone number)
- Message history
- Conversation context

## Error Handling

- All 4xx client errors from orchestrator are returned immediately
- All other errors trigger retry logic (configurable max retries)
- Failed messages after max retries are logged for manual review
- Circuit breaker pattern for orchestrator connectivity

## Testing

```bash
npm test
```

## License

MIT
