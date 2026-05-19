# REZ-karma-loyalty-bridge

## Overview

TODO: Add service description

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test
```

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Service port | Yes |
| MONGODB_URI | MongoDB connection string | Yes |
| REDIS_URL | Redis connection string | No |
| INTERNAL_SERVICE_TOKEN | Service-to-service auth token | Yes |

## API Endpoints

- `GET /health` - Health check

## License

Proprietary - RTNM Group
