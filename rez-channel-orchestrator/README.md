# REZ Channel Orchestrator

**Port:** 4070

Unified entry point for all channels. Routes messages from any channel to the REZ Orchestrator.

## Channels Supported

| Channel | Endpoint | Description |
|---------|----------|-------------|
| WhatsApp | POST `/api/v1/whatsapp/webhook` | WhatsApp Business API |
| Instagram | POST `/api/v1/instagram/webhook` | Instagram Direct Messages |
| SMS | POST `/api/v1/sms/webhook` | SMS (Twilio) |
| Email | POST `/api/v1/email/inbound` | Email |
| RCS | POST `/api/v1/rcs/webhook` | Rich Communication Services |
| Voice | POST `/api/v1/voice/webhook` | Voice calls |
| Web | POST `/api/v1/web/message` | Website widget |
| App | POST `/api/v1/app/message` | Mobile app |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REZ CHANNEL ORCHESTRATOR (4070) │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ WhatsApp ──┐ │
│ Instagram ─┤ │
│ SMS ───────┤ │
│ Email ─────┤ ├────► Orchestrator (4006) ──► Expert Agents │
│ RCS ───────┤ │
│ Voice ─────┤ │
│ Web ───────┤ │
│ App ───────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd rez-channel-orchestrator
npm install
cp .env.example .env
npm run dev
```

## API Endpoints

### Receive WhatsApp Message
```bash
POST /api/v1/whatsapp/webhook
```

### Receive Instagram Message
```bash
POST /api/v1/instagram/webhook
```

### Send SMS
```bash
POST /api/v1/sms/webhook
```

### Send Web Widget Message
```bash
POST /api/v1/web/message
{
  "sessionId": "abc123",
  "message": "Hello",
  "userId": "user123"
}
```

### Get Queued Response
```bash
GET /api/v1/response/:userId
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4070 |
| ORCHESTRATOR_URL | REZ Orchestrator URL | http://localhost:4006 |
| INTERNAL_SERVICE_TOKEN | Auth token | core-brain-token-123 |

## Testing

```bash
# Test web widget
curl -X POST http://localhost:4070/api/v1/web/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","message":"hello","userId":"user1"}'
```
