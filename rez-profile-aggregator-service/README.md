# REZ Profile Aggregator Service

Unified user profile microservice aggregating data from all ReZ services.

## Features

- Unified user profile from multiple sources
- Real-time profile updates
- AI-powered insights via ReZ Mind
- Merchant profile aggregation
- Loyalty ecosystem integration (streak, cross-merchant, karma-bridge)
- Event-driven architecture

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| REDIS_URL | Redis connection string | Yes |
| PORT | Service port (default: 4025) | No |
| WALLET_SERVICE_URL | Wallet service URL | No |
| LOYALTY_SERVICE_URL | Loyalty service URL | No |
| KARMA_SERVICE_URL | Karma service URL | No |
| GAMIFICATION_SERVICE_URL | Gamification service URL | No |
| SCORE_SERVICE_URL | Score service URL | No |
| STREAK_SERVICE_URL | Streak service URL | No |
| CROSS_MERCHANT_SERVICE_URL | Cross-merchant service URL | No |
| KARMA_LOYALTY_BRIDGE_URL | Karma-loyalty bridge URL | No |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
npm test         # Run tests
```

## API Endpoints

### Profile Endpoints
- `GET /api/v1/profile/:userId` - Get unified profile
- `GET /api/v1/profile/:userId/summary` - Get profile summary
- `GET /api/v1/profile/:userId/behavior` - Get behavior data
- `GET /api/v1/profile/:userId/score` - Get ReZ Score
- `POST /api/v1/profile/:userId/recalculate` - Recalculate score

### Loyalty Ecosystem Endpoints
- `GET /api/v1/profile/:userId/streak` - Get streak data
- `GET /api/v1/profile/:userId/cross-merchant` - Get cross-merchant progress
- `GET /api/v1/profile/:userId/karma-bridge` - Get karma-to-loyalty stats
- `GET /api/v1/profile/:userId/loyalty-summary` - Get full loyalty summary

### Other Endpoints
- `GET /api/v1/mind/:userId` - Get AI insights
- `GET /api/v1/merchant/:merchantId` - Get merchant profile

## Inter-Service Connections

The Profile Aggregator connects to the following services:

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Wallet | localhost:4014 | User wallet balances |
| Loyalty | localhost:4005 | Loyalty points |
| Karma | localhost:4002 | Karma score/level |
| Gamification | localhost:4006 | XP and achievements |
| Score | localhost:4028 | ReZ Score |
| Streak | localhost:3003 | Visit streaks |
| Cross-Merchant | localhost:4027 | City-wide badges |
| Karma-Loyalty Bridge | localhost:4029 | Karma to loyalty conversion |

## License

MIT
