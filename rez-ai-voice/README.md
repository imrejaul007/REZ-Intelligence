# REZ AI Voice Agent Service

A production-ready voice AI agent service integrating Twilio Voice, OpenAI Whisper (STT), ElevenLabs (TTS), and Anthropic Claude (LLM) for intelligent voice conversations.

## Overview

The REZ AI Voice Agent Service provides:

- **Inbound Voice Calls** - Handle customer calls with intelligent IVR routing
- **Three Voice Agents** - Sales, Support, and Info agents for different use cases
- **Speech Recognition** - OpenAI Whisper for accurate transcription
- **Natural Responses** - ElevenLabs TTS with custom voices
- **AI Conversations** - Claude-powered multi-turn conversations
- **Call Analytics** - Usage tracking and cost monitoring

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         Twilio Voice Network            │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │    Twilio Voice Webhook Handler         │
                    │         /webhook/voice                 │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │                                         │
              ┌─────▼─────┐    ┌─────────────┐    ┌─────────┐│
              │   IVR    │    │  Conversation │   │  Audio  ││
              │  Service │    │    Service    │   │  Cache  ││
              └─────┬─────┘    └───────┬───────┘   └────┬────┘│
                    │                  │                  │     │
                    └──────────────────┼──────────────────┘     │
                                       │                        │
                    ┌──────────────────┴──────────────────┐     │
                    │                                         │     │
              ┌─────▼─────┐    ┌─────────────┐    ┌────────▼────┐│
              │   Sales   │    │  Support    │    │    Info      ││
              │   Agent   │    │   Agent     │    │   Agent      ││
              └───────────┘    └─────────────┘    └──────────────┘│
                                       │                        │
                    ┌──────────────────┴─────────────────────────┐
                    │                                         │
                    │              AI Services                 │
                    │  ┌────────────┐  ┌──────────────────┐   │
                    │  │  OpenAI   │  │    ElevenLabs     │   │
                    │  │  Whisper  │  │       TTS         │   │
                    │  └───────────┘  └──────────────────┘   │
                    │           ┌─────────────────┐           │
                    │           │   Anthropic     │           │
                    │           │    Claude       │           │
                    │           └─────────────────┘           │
                    └─────────────────────────────────────────┘
```

## Features

### Voice Agents

| Agent | Use Case | Capabilities |
|-------|----------|--------------|
| **Sales** | Product inquiries, bookings | Lead qualification, product info, pricing |
| **Support** | Customer service | Order status, refunds, technical help |
| **Info** | General inquiries | Hours, locations, policies, products |

### IVR Menu System

- Configurable menu prompts
- DTMF digit collection
- Timeout handling
- Retry logic
- Sub-menu navigation

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/voice` | Twilio voice webhook |
| GET | `/api/calls` | List active/recent calls |
| POST | `/api/calls/outbound` | Initiate outbound call |
| GET | `/api/calls/:callSid` | Get call details |
| POST | `/api/calls/:callSid/message` | Send message to call |
| GET | `/api/calls/:callSid/transcript` | Get call transcript |
| GET | `/api/usage` | Usage metrics |
| GET | `/api/usage/history` | Usage history |
| GET | `/api/usage/cost` | Cost estimates |
| GET | `/health` | Health check |

## Quick Start

### Prerequisites

- Node.js 18+
- Twilio account with voice capability
- OpenAI API key
- ElevenLabs API key
- Anthropic API key

### Installation

```bash
# Clone and install dependencies
cd REZ-Intelligence/rez-ai-voice
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
nano .env

# Build TypeScript
npm run build

# Start server
npm start
```

### Development

```bash
# Start with hot reload
npm run dev

# Run tests
npm test
```

## Configuration

### Required Environment Variables

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx...
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_BASE_URL=https://your-domain.com

# OpenAI (Whisper)
OPENAI_API_KEY=sk-xxxx...

# ElevenLabs
ELEVENLABS_API_KEY=xxxx...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxxx...
```

### Voice Configuration

```bash
# Voice IDs for different agents
ELEVENLABS_VOICE_SALES=EXAVITQu4vr4xnSDxMaL
ELEVENLABS_VOICE_SUPPORT=VR6AewLTigWG4xSOukaG
ELEVENLABS_VOICE_INFO=pFZP5JQG7iRYjFPEnMMb
```

## Usage Examples

### Inbound Call Flow

1. Customer calls your Twilio number
2. Twilio sends webhook to `/webhook/voice`
3. IVR presents menu (Sales, Support, Info)
4. Customer presses digit
5. Appropriate agent handles conversation
6. Agent generates response with TTS
7. Conversation continues until hangup

### Initiate Outbound Call

```bash
curl -X POST http://localhost:3000/api/calls/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "agentType": "sales",
    "greetingMessage": "Hello! Thanks for your interest in ReZ."
  }'
```

### Send Message to Active Call

```bash
curl -X POST http://localhost:3000/api/calls/{callSid}/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Thank you for your interest! A representative will contact you shortly."
  }'
```

### Get Call Transcript

```bash
curl http://localhost:3000/api/calls/{callSid}/transcript
```

## Twilio Setup

### 1. Create TwiML App

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Develop > Phone Numbers > Manage > Active numbers
3. Select your number
4. Set Voice Configuration:
   - Accept incoming: Voice calls
   - Configure URL: `https://your-domain.com/webhook/voice`
   - HTTP Method: POST

### 2. Configure Webhook

The webhook URL must be publicly accessible. For local development, use ngrok:

```bash
ngrok http 3000
# Use the https URL in Twilio configuration
```

## Project Structure

```
src/
├── index.ts              # Main entry point
├── config/
│   ├── twilio.config.ts  # Twilio configuration
│   └── ai.config.ts      # AI services configuration
├── services/
│   ├── sttService.ts     # Speech-to-text (Whisper)
│   ├── ttsService.ts     # Text-to-speech (ElevenLabs)
│   ├── ivrService.ts     # IVR menu system
│   └── conversationService.ts  # Conversation management
├── agents/
│   ├── voiceSalesAgent.ts    # Sales agent
│   ├── voiceSupportAgent.ts   # Support agent
│   └── voiceInfoAgent.ts      # Info agent
├── webhooks/
│   └── twilioVoiceWebhook.ts  # Twilio webhook handler
├── routes/
│   ├── call.routes.ts    # Call management API
│   └── usage.routes.ts   # Usage tracking API
├── types/
│   └── index.ts          # TypeScript interfaces
└── utils/
    └── logger.ts          # Winston logger
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Render

The service includes `render.yaml` for Render deployment:

```bash
# Set environment variables in Render dashboard
# Connect GitHub repository
# Deploy
```

### Production Checklist

- [ ] Configure HTTPS webhook URL
- [ ] Set up monitoring/alerting
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Configure backup for audio files
- [ ] Set up CDN for audio serving

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Usage Metrics

```bash
# Today's metrics
curl http://localhost:3000/api/usage

# Cost estimates
curl http://localhost:3000/api/usage/cost

# Real-time stats
curl http://localhost:3000/api/usage/realtime
```

## Troubleshooting

### Webhook Not Receiving Calls

1. Verify webhook URL is public
2. Check Twilio console for webhook delivery failures
3. Verify signature validation is working

### STT Not Transcribing

1. Check OpenAI API key is valid
2. Verify audio format is supported (MP3, WAV, etc.)
3. Check Whisper API quotas

### TTS Not Generating Audio

1. Check ElevenLabs API key is valid
2. Verify voice ID exists
3. Check audio output directory permissions

### Agent Responses Slow

1. Check Anthropic API latency
2. Verify ElevenLabs latency settings
3. Consider caching common responses

## License

MIT
