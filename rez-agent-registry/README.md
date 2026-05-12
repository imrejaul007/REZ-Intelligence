# REZ Agent Registry

A production-ready service that tracks and monitors all expert agents in the REZ intelligence platform.

## Features

- **Agent Registration**: Register and unregister expert agents dynamically
- **Health Monitoring**: Continuous health checks with configurable intervals
- **Capability Matching**: Find best-suited expert for a given task
- **Metrics Tracking**: Track request counts, response times, success rates
- **Heartbeat System**: Detect stale or unresponsive agents
- **Cron/Interval Scheduling**: Flexible health check scheduling
- **Alerting**: Automatic alerts when agents fail health checks

## Architecture

```
┌─────────────────┐
│  Expert Agent   │
└────────┬────────┘
         │ Register/Heartbeat
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Agent Registry  │────▶│     Redis       │
│                 │     │  (State Store)  │
└────────┬────────┘     └─────────────────┘
         │
         │ Health Checks
         ▼
┌─────────────────┐
│ Health Monitor  │
│                 │
└─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis server

### Installation

```bash
cd rez-agent-registry
npm install
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=4011
NODE_ENV=development
LOG_LEVEL=info

# Redis
REDIS_URL=redis://localhost:6379

# Registry Settings
HEARTBEAT_INTERVAL_MS=30000
HEARTBEAT_TTL_SECONDS=300
STALE_THRESHOLD_MS=120000

# Health Monitor
HEALTH_CHECK_INTERVAL_SECONDS=60
HEALTH_CHECK_TIMEOUT_MS=5000
MAX_CONSECUTIVE_FAILURES=3
ENABLE_CRON_SCHEDULE=false
CRON_SCHEDULE=*/5 * * * *

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
| GET | `/health` | Health check |
| GET | `/ready` | Readiness probe |
| GET | `/registry/health` | Registry health with expert status |
| GET | `/registry/health/overall` | Overall health status |
| POST | `/registry/health/check` | Trigger full health check |

### Expert Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/registry/experts` | List all experts |
| GET | `/registry/experts/:id` | Get expert by ID |
| POST | `/registry/experts` | Register new expert |
| DELETE | `/registry/experts/:id` | Unregister expert |
| POST | `/registry/experts/:id/heartbeat` | Update heartbeat |
| PATCH | `/registry/experts/:id/status` | Update expert status |
| POST | `/registry/experts/:id/check` | Trigger health check |
| GET | `/registry/experts/:id/health` | Get health history |

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/registry/capabilities/:name/experts` | Get experts by capability |
| POST | `/registry/find` | Find best expert for task |
| GET | `/registry/stats` | Get registry statistics |

## Expert Registration

Register an expert by POSTing to `/registry/experts`:

```json
{
  "id": "rez-travel-expert-v1",
  "name": "REZ Travel Expert",
  "type": "industry",
  "description": "Handles travel bookings, destinations, and itineraries",
  "version": "1.0.0",
  "capabilities": [
    {
      "name": "hotel_booking",
      "description": "Book hotel rooms and resorts"
    },
    {
      "name": "flight_search",
      "description": "Search and book flights"
    }
  ],
  "endpoints": {
    "health": "http://localhost:3003/health",
    "process": "http://localhost:3003/api/process"
  },
  "metadata": {
    "author": "REZ Team",
    "tags": ["travel", "booking", "hospitality"],
    "category": "travel",
    "industries": ["hospitality", "tourism"]
  }
}
```

## Heartbeat Protocol

Experts should send heartbeats every 30 seconds to stay registered:

```bash
curl -X POST http://localhost:4011/registry/experts/{expertId}/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "requestsHandled": 150,
      "avgResponseTimeMs": 250,
      "successRate": 0.98
    }
  }'
```

## Finding the Best Expert

```bash
curl -X POST http://localhost:4011/registry/find \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "hotel_booking",
    "minSuccessRate": 0.9,
    "maxResponseTimeMs": 500
  }'
```

## Health Monitoring

The health monitor automatically checks registered experts at the configured interval. Configure via:

```env
HEALTH_CHECK_INTERVAL_SECONDS=60
HEALTH_CHECK_TIMEOUT_MS=5000
MAX_CONSECUTIVE_FAILURES=3
```

Or use cron scheduling:

```env
ENABLE_CRON_SCHEDULE=true
CRON_SCHEDULE=*/5 * * * *
```

## Testing

```bash
npm test
```

## License

MIT
