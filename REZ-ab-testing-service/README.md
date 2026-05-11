# ReZ A/B Testing Service

Experimentation and feature flag management service for ReZ platform.

## Features

- Create and manage A/B experiments
- Feature flag support
- Deterministic user assignment
- Targeting rules
- Real-time experiment results

## Quick Start

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4002 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/rez_ab_testing |
| ALLOWED_ORIGINS | CORS allowed origins | https://rez.money |

## API Endpoints

### Experiments

- `GET /api/experiments` - List all experiments
- `GET /api/experiments/:id` - Get experiment by ID
- `POST /api/experiments` - Create new experiment
- `PUT /api/experiments/:id` - Update experiment
- `DELETE /api/experiments/:id` - Delete experiment

### Assignments

- `GET /api/experiments/:id/assign?userId=xxx` - Get variant assignment for user
- `GET /api/experiments/:id/results` - Get experiment results

### Health

- `GET /health` - Service health check

## Development

```bash
# Type check
npm run typecheck

# Run tests
npm test
```
