# REZ Score Service

Credit scoring microservice for calculating and managing ReZ Scores.

## Features

- Real-time score calculation
- Multiple scoring algorithms
- Score history tracking
- Risk assessment
- Score factors analysis

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
| PORT | Service port (default: 4028) | No |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
npm test         # Run tests
```

## API Endpoints

- `GET /api/v1/score/:userId` - Get user score
- `POST /api/v1/score/calculate` - Calculate new score
- `GET /api/v1/score/:userId/history` - Get score history

## License

MIT
