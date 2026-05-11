# ReZ Intelligence Hub

Unified user and merchant intelligence hub with Voice AI and autonomous agents.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **AI/ML:** Anthropic API, OpenAI API
- **Voice:** Speech-to-Text, Text-to-Speech
- **Validation:** Zod
- **Monitoring:** Sentry
- **Cache:** Redis (optional)

## Environment Variables

```env
# Server
NODE_ENV=development
PORT=4020

# MongoDB
MONGODB_URI=mongodb+srv://work_db_user:<PASSWORD>@rez-intent-graph.a8ilqgi.mongodb.net/rez-intelligence

# Redis (optional)
REDIS_URL=redis://localhost:6379

# AI APIs
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Authentication
INTERNAL_SERVICE_TOKEN=change-me-to-a-secure-random-string

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info

# External Services
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
MONOLITH_URL=https://rez-backend.onrender.com
ORDER_SERVICE_URL=https://rez-order-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
ANALYTICS_SERVICE_URL=https://analytics-events.onrender.com
FINANCE_SERVICE_URL=http://localhost:4006

# Monitoring
SENTRY_DSN=
```

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/voice` | Voice AI health status |

### User Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/profile/user` | Create/update user profile from event |
| GET | `/profile/user/:userId` | Get user profile |
| GET | `/profiles` | List all profiles (paginated) |

### Finance Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/*` | Finance data endpoints |

### User Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/intelligence/*` | User intelligence data |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/*` | Dashboard metrics and analytics |

### Voice AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/process` | Process voice/text input |
| POST | `/api/voice/text` | Process text input with optional TTS |
| GET | `/api/agents/status` | Get agent status |

### Voice Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/voice` | Twilio voice webhook |

## Local Setup

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- Redis (optional)
- Anthropic API key
- OpenAI API key

### Installation

```bash
cd rez-intelligence-hub

npm install

cp .env.example .env

# Configure your API keys and database connection
```

### Running Locally

```bash
# Development with hot reload
npm run dev

# Production
npm run build
npm start
```

## Features

### User Profiles
- Derived signals from user events
- Preference tracking (cuisines, price range, time patterns)
- Intent signals with confidence scores
- Behavior analysis (frequency, avg order value, engagement)
- Customer segmentation

### Merchant Profiles
- Demand pattern analysis
- Customer type tracking
- Pricing behavior insights
- Merchant segmentation

### Voice AI
- Speech-to-text transcription
- Text-to-speech synthesis
- Autonomous agents for:
  - Order management
  - Booking assistance
  - Customer support
  - Natural language understanding

### Finance Intelligence
- Transaction analysis
- Revenue tracking
- Financial reporting

## Project Structure

```
src/
  index.ts              # Main entry point
  schemas/              # Zod validation schemas
  routes/
    financeRoutes.ts    # Finance intelligence
    userRoutes.ts       # User intelligence
    dashboardRoutes.ts  # Dashboard data
  voice/
    agents/             # Autonomous agents
    services/           # STT/TTS services
    webhooks/           # Voice webhooks (Twilio)
  jobs/                 # Background jobs
  services/             # Business logic services
```

## License

MIT
