# REZ Unified Conversation Engine

A multi-channel conversation routing and processing engine that connects WhatsApp, Voice, Microsoft Copilot, and Web channels to the REZ Agent OS and Intent Graph.

## Features

- **Multi-Channel Support**: WhatsApp, Voice (Twilio), Microsoft Copilot, and Web
- **Unified Context**: Aggregates conversation context from multiple sources
- **Intent Detection**: Integrates with REZ Intent Graph for intelligent intent recognition
- **Smart Routing**: Routes conversations to appropriate agents based on intent and skills
- **Real-time Communication**: Socket.IO support for live chat
- **Session Management**: Robust session handling with Redis caching
- **Comprehensive Logging**: Full conversation logging to MongoDB

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REZ Unified Engine                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ WhatsApp    │  │ Voice       │  │ Copilot     │  │ Web      │
│  │ Adapter     │  │ Adapter     │  │ Adapter     │  │ Adapter  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬───┘
│         │                │                │                │       │
│  ┌──────▼──────────────────────────────────────────────────────▼─┐
│  │                   Channel Router                              │
│  └──────┬──────────────────────────────────────────────────────┬─┘
│         │                                                       │
│  ┌──────▼──────────────────┐  ┌──────────────────────────────▼┐
│  │   Context Manager        │  │   Intent Processor             │
│  │   - Load context         │  │   - Intent detection          │
│  │   - Redis caching        │  │   - Entity extraction          │
│  │   - CDP integration      │  │   - Fallback handling          │
│  └─────────────────────────┘  └───────────────────────────────┘
│                                                                  │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐
│  │   Agent Router          │  │   Response Generator           │
│  │   - Route to bot/human │  │   - Generate responses         │
│  │   - Skill matching      │  │   - Channel formatting         │
│  │   - Queue management    │  │   - Quick replies              │
│  └─────────────────────────┘  └───────────────────────────────┘
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐
│  │                 Conversation Logger                           │
│  │                 MongoDB + Redis Storage                       │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│ REZ Agent OS    │      │ REZ Intent      │
│                 │      │ Graph           │
│ - Bot responses │      │ - Intent        │
│ - Human routing │      │   detection     │
│ - AI assist     │      │ - Entity        │
└─────────────────┘      └─────────────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3005` |
| `NODE_ENV` | Environment | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rez_unified_engine` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | - |
| `INTERNAL_SERVICE_TOKENS_JSON` | Service authentication tokens | - |

### Channel Configuration

Each channel requires specific environment variables:

- **WhatsApp**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- **Voice**: `TWILIO_VOICE_FROM`
- **Copilot**: Webhook secret configuration

## Running the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Testing
npm test
```

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check (DB + Redis) |

### Messages

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | GET | List messages |
| `/api/messages/:id` | GET | Get message |
| `/api/messages` | POST | Send message |
| `/api/messages/search` | GET | Search messages |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List sessions |
| `/api/sessions/:id` | GET | Get session |
| `/api/sessions` | POST | Create session |
| `/api/sessions/:id` | PATCH | Update session |
| `/api/sessions/:id/end` | POST | End session |
| `/api/sessions/:id/context` | GET | Get context |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/whatsapp` | POST | WhatsApp webhook |
| `/webhooks/voice` | POST | Voice webhook |
| `/webhooks/copilot` | POST | Copilot webhook |
| `/webhooks/web` | POST | Web webhook |
| `/webhooks/register` | POST | Register webhook |
| `/webhooks/events` | GET | List events |

## Data Models

### Conversation

Represents a multi-session conversation for a user.

```typescript
{
  conversationId: string;
  userId: string;
  primaryChannel: ChannelType;
  currentChannel: ChannelType;
  status: 'active' | 'archived' | 'closed';
  context: {
    recentIntents: IntentData[];
    userPreferences: Record<string, unknown>;
  };
  metrics: {
    totalMessages: number;
    totalSessions: number;
    averageResponseTimeMs: number;
  };
}
```

### Session

Represents a single session within a conversation.

```typescript
{
  sessionId: string;
  conversationId: string;
  userId: string;
  channel: ChannelType;
  status: 'active' | 'idle' | 'ended' | 'expired';
  expiresAt: Date;
  context: {
    variables: Record<string, unknown>;
    recentMessages: string[];
  };
}
```

### Message

Represents an individual message.

```typescript
{
  messageId: string;
  conversationId: string;
  sessionId: string;
  sender: { role: 'user' | 'agent' | 'system' };
  content: { text?: string; attachments?: Attachment[] };
  channel: ChannelType;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}
```

## Services

### Channel Router

Routes incoming messages to the appropriate channel adapter and manages multi-channel communication.

### Context Manager

Loads and manages conversation context from MongoDB, Redis, and external services (CDP).

### Intent Processor

Detects user intent using REZ Intent Graph with LLM and rule-based fallbacks.

### Agent Router

Routes conversations to appropriate agents (bot, human, AI-assist) based on intent and availability.

### Response Generator

Generates responses through Agent OS or fallback mechanisms.

### Conversation Logger

Logs all conversations to MongoDB with real-time updates and analytics.

## Webhook Integration

### WhatsApp (Twilio)

```bash
# Register webhook with Twilio
twilio api:core:webhooks:create \
  --url=https://your-domain.com/webhooks/whatsapp \
  --signing-keySid=SKxxxxxx
```

### Voice

```bash
# Set voice webhook in Twilio
twilio phone-numbers:update +1234567890 \
  --voice-url=https://your-domain.com/webhooks/voice \
  --status-callback-url=https://your-domain.com/webhooks/voice/status
```

### Copilot

Configure the webhook URL in your Azure Bot Service to point to `/webhooks/copilot`.

## Authentication

### JWT Authentication

Include a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Internal Service Tokens

For service-to-service communication, include the service token:

```
X-Internal-Token: <service_token>
```

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-session` | Client -> Server | Join a session room |
| `leave-session` | Client -> Server | Leave a session room |
| `typing` | Bidirectional | Typing indicator |
| `web-message` | Client -> Server | Send web message |
| `web-message-response` | Server -> Client | Message response |
| `agent-response` | Server -> Client | Agent response |

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3005/health

# Detailed readiness
curl http://localhost:3005/ready
```

### Metrics

Access session and message statistics via API:

```bash
curl http://localhost:3005/api/sessions/stats
curl http://localhost:3005/api/messages/stats/overview
```

## License

MIT
