# REZ Consumer Copilot

AI-powered copilot dashboard for consumer app users.

## Overview

The REZ Consumer Copilot provides personalized AI assistance for consumers on the REZ platform, including:
- Chat-based support
- Order assistance
- Product recommendations
- Personalized nudges

## Features

- **Conversational AI**: Natural language understanding for user queries
- **Order Management**: Help with order tracking, modifications, and cancellations
- **Recommendations**: Contextual product suggestions
- **Proactive Notifications**: Timely alerts based on user behavior

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message |
| GET | `/api/chat/history` | Get chat history |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List user orders |
| GET | `/api/orders/:id` | Get order details |

### Recommendations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations` | Get personalized recommendations |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4021 | Service port |
| NODE_ENV | development | Environment |
| MONGODB_URI | - | MongoDB connection string |

## Deploy to Render

The service is configured for Render deployment via `render.yaml`.

## License

MIT
