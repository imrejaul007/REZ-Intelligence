# REZ Care Service

> **Unified Customer Support Intelligence Platform**

A comprehensive customer support system that provides AI-powered assistance, proactive issue detection, and self-service tools.

---

## Features

- **Customer 360 View** - Unified customer data from all services
- **CSAT + Sentiment Analysis** - Track and improve customer satisfaction
- **Proactive Issue Detection** - Catch problems before customers complain
- **Self-Service Recovery** - Let customers fix issues themselves
- **Auto-Ticket Generation** - Automatically create tickets for technical issues
- **Real-time WebSocket** - Live updates for agents
- **AI Agent Summary** - Instant context for support agents

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis (optional, for caching)

### Installation

```bash
# Clone and install
cd REZ-Intelligence/REZ-care-service
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your service URLs
nano .env

# Start development server
npm run dev
```

### Production Deployment

```bash
# Build
npm run build

# Start
npm start
```

Or deploy via Render using `render.yaml`.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4055 |
| `MONGODB_URI` | MongoDB connection string | localhost |
| `REDIS_URL` | Redis URL | localhost |
| `INTERNAL_SERVICE_TOKEN` | Service authentication token | - |

### Service URLs

Configure URLs for connected services:

```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
ORDER_SERVICE_URL=https://rez-order-service.onrender.com
BOOKING_SERVICE_URL=https://rez-booking-service.onrender.com
NOTIFICATIONS_SERVICE_URL=https://rez-notifications-service.onrender.com
PROFILE_SERVICE_URL=https://rez-profile-service.onrender.com
GAMIFICATION_SERVICE_URL=https://rez-gamification-service.onrender.com
SUPPORT_DASHBOARD_URL=https://rez-support-dashboard.onrender.com
```

---

## API Endpoints

### Customer 360

```
POST /api/customers/360
GET  /api/customers/:id/timeline
GET  /api/customers/:id/summary
```

### CSAT

```
POST /api/csat/respond
GET  /api/csat/metrics
POST /api/csat/send
```

### Sentiment

```
POST /api/sentiment/analyze
GET  /api/customers/:id/sentiment
```

### Proactive Alerts

```
GET  /api/alerts/active
POST /api/alerts
POST /api/alerts/:id/resolve
```

### Self-Service

```
GET  /api/self-service/:id/actions
POST /api/self-service/execute
POST /api/self-service/cashback-retry
POST /api/self-service/payment-retry
POST /api/self-service/wallet-sync
```

### Auto-Tickets

```
GET  /api/auto-tickets
POST /api/auto-tickets
POST /api/auto-tickets/:id/resolve
```

### Metrics

```
GET  /api/metrics/dashboard
GET  /api/metrics/agents
```

### WebSocket

```
GET  /api/websocket/status
WS   /socket.io (Socket.IO for real-time updates)
```

---

## WebSocket Events

### Client → Server

```javascript
// Subscribe to alerts
socket.emit('subscribe', { room: 'alerts', id: alertId });

// Identify as agent
socket.emit('identify', { userId: 'agent123', name: 'Agent', role: 'support' });
```

### Server → Client

```javascript
// New alert
socket.on('alert:new', (alert) => { ... });

// Alert resolved
socket.on('alert:resolved', (alert) => { ... });

// Ticket update
socket.on('ticket:update', (ticket) => { ... });

// Metrics update (every 30s)
socket.on('metrics:update', (metrics) => { ... });
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ CARE SERVICE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API LAYER                            │   │
│  │  Customer 360 │ CSAT │ Sentiment │ Alerts │ Tickets │   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   SERVICE LAYER                          │   │
│  │  Customer360 │ CSAT │ Sentiment │ Proactive │ Self │   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              INTEGRATION LAYER                           │   │
│  │  Auth │ Payment │ Wallet │ Order │ Profile │ Karma │      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 WEBSOCKET LAYER                          │   │
│  │  Real-time alerts, tickets, metrics for agents         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Documentation

- [Command Center Architecture](../docs/REZ-CARE-COMMAND-CENTER.md)
- [Intelligence Roadmap](../docs/REZ-CARE-INTELLIGENCE-ROADMAP.md)
- [Agent Training Manual](../docs/REZ-CARE-AGENT-TRAINING.md)

---

## Service Dependencies

| Service | Required | Purpose |
|---------|----------|---------|
| MongoDB | Yes | Data storage |
| Redis | No | Caching |
| Auth Service | Yes | Customer identity |
| Payment Service | Yes | Transaction data |
| Wallet Service | Yes | Balance, cashback |
| Order Service | Yes | Order history |
| Notifications | Yes | Send surveys |

---

## Monitoring

### Health Check

```bash
curl http://localhost:4055/health
```

### WebSocket Status

```bash
curl http://localhost:4055/api/websocket/status
```

---

## License

Internal use only - RABTUL Technologies
