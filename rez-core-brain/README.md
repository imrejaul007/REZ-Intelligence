# REZ Core Brain Service

The global intelligence layer that powers all agents in the ReZ commerce platform.

## Overview

The REZ Core Brain Service provides centralized intelligence capabilities for all agents:

- **Memory Management**: Short-term and long-term memory storage with automatic consolidation
- **Session Management**: Multi-agent session tracking with context persistence
- **User Personalization**: Preferences, loyalty programs, and communication style
- **Global Intelligence**: Behavioral analysis, recommendations, and intent prediction

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ Core Brain                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Memory    │  │   Session   │  │    Personalization       │ │
│  │   Service  │  │   Service   │  │       Service            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ Intelligence│  │  Context    │                               │
│  │   Service   │  │   Service   │                               │
│  └─────────────┘  └─────────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│                     MongoDB  │  Redis                           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────┴────┐           ┌────┴────┐           ┌────┴────┐
   │ Hotel   │           │ AdBazaar│           │ Rendez  │
   │ Agent   │           │ Agent   │           │ Agent   │
   └─────────┘           └─────────┘           └─────────┘
```

## Features

### Memory Management
- **Short-term Memory**: Temporary context storage with automatic TTL
- **Long-term Memory**: Persistent storage for important information
- **Semantic Memory**: Conceptual knowledge storage
- **Episodic Memory**: Event and experience storage
- Automatic memory consolidation (important short-term -> long-term)
- Semantic search capabilities

### Session Management
- Multi-agent concurrent session support
- Session state tracking (active, paused, ended)
- Context persistence across sessions
- Redis caching for performance
- Automatic stale session cleanup

### User Personalization
- **Preferences**: Tone, language, timezone, notification settings
- **Loyalty Program**: Points, tiers (Bronze to Diamond), benefits
- **Communication Style**: Adaptive based on user profile and loyalty tier

### Intelligence
- **Engagement Scoring**: User engagement level calculation
- **Behavior Analysis**: Pattern detection and prediction
- **Recommendations**: Personalized content and actions
- **Intent Prediction**: Anticipate user needs based on context

## API Endpoints

### Memory API (`/api/memory`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a memory |
| GET | `/` | Get all memories for user |
| GET | `/:id` | Get a specific memory |
| PATCH | `/:id` | Update a memory |
| DELETE | `/:id` | Delete a memory |
| DELETE | `/` | Delete all memories |
| POST | `/search` | Semantic search |
| POST | `/batch` | Batch create memories |
| GET | `/stats` | Get memory statistics |

### Session API (`/api/session`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create a session |
| GET | `/` | Get or create active session |
| GET | `/:id` | Get a specific session |
| PATCH | `/:id` | Update session |
| POST | `/:id/context` | Add context to session |
| DELETE | `/:id/context/:key` | Remove context |
| POST | `/:id/pause` | Pause session |
| POST | `/:id/resume` | Resume session |
| POST | `/:id/end` | End session |
| POST | `/end-all` | End all user sessions |
| GET | `/stats` | Get session statistics |

### Personalization API (`/api/personalization`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/preferences` | Get user preferences |
| PATCH | `/preferences` | Update preferences |
| POST | `/preferences/reset` | Reset to defaults |
| GET | `/loyalty` | Get loyalty profile |
| PATCH | `/loyalty` | Update loyalty profile |
| GET | `/loyalty/benefits` | Get tier benefits |
| POST | `/loyalty/purchase` | Record purchase |
| GET | `/context` | Get contextual data |
| PATCH | `/context` | Update contextual data |
| POST | `/context/activity` | Update recent activity |
| GET | `/intelligence` | Get intelligence data |
| POST | `/recommendations` | Get recommendations |
| GET | `/engagement` | Get engagement score |
| GET | `/behavior` | Analyze behavior patterns |
| POST | `/greeting` | Get personalized greeting |

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0

### Installation

```bash
# Clone the repository
cd REZ-Intelligence/rez-core-brain

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Configuration

```bash
# .env
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-core-brain

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-at-least-32-chars

# Internal Services
INTERNAL_SERVICE_TOKENS_JSON={"payment-service":"token","order-service":"token"}
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Authentication

### User Authentication (JWT)
```bash
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/api/memory
```

### Internal Service Authentication
```bash
curl -H "X-Internal-Token: <service_token>" \
  -H "X-Service-Name: <service_name>" \
  http://localhost:4000/internal/memory
```

## Memory Types

| Type | TTL | Description |
|------|-----|-------------|
| `short_term` | 1 hour (configurable) | Temporary working memory |
| `long_term` | Permanent | Persistent important memories |
| `episodic` | Permanent | Event and experience memories |
| `semantic` | Permanent | Conceptual knowledge |

## Loyalty Tiers

| Tier | Points Required | Benefits |
|------|----------------|----------|
| Bronze | 0 | Basic rewards, Email support |
| Silver | 1,000 | 5% discount, Priority support, Early access |
| Gold | 5,000 | 10% discount, Free shipping, Exclusive deals |
| Platinum | 15,000 | 15% discount, Personal shopper, VIP events |
| Diamond | 50,000 | 20% discount, Concierge service, Luxury gifts |

## Error Handling

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-05-12T10:00:00.000Z",
    "requestId": "req_xxx"
  }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

## Rate Limiting

Default: 1000 requests per 15 minutes per IP.

## Health Checks

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (includes DB connectivity)

## Project Structure

```
rez-core-brain/
├── src/
│   ├── config/          # Configuration and environment
│   ├── models/          # Mongoose models
│   ├── services/        # Business logic
│   ├── routes/          # Express routes
│   ├── middleware/      # Express middleware
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities (logger, etc.)
│   └── index.ts         # Entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
