# REZ Knowledge Service

**Unified User Knowledge Base Service** - Single source of truth for all REZ apps.

## Overview

The REZ Knowledge Service provides a centralized user profile and preference management system used by all REZ applications:

- **StayOwn** - Hotel booking and accommodation
- **Rendez** - Couple experiences and date planning
- **Corpspark** - Corporate travel and business services
- **Consumer Apps** - All other consumer-facing applications

## Features

- **Unified User Profiles** - Single profile structure across all apps
- **App-Specific Preferences** - Tailored settings for hotel, restaurant, rendez, and corporate
- **User History** - Tracking bookings, spending, ratings, and loyalty tiers
- **Signal System** - Capture user actions and behaviors for AI personalization
- **REZ Mind Integration** - Connect to AI service for advanced insights
- **Service-to-Service Auth** - Secure communication between microservices

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+

### Installation

```bash
cd rez-knowledge-service
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Development

```bash
npm run dev      # Start with hot reload
npm run build    # Build for production
npm start        # Run production build
```

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed health with dependencies |
| GET | `/ready` | Kubernetes readiness probe |
| GET | `/live` | Kubernetes liveness probe |

### Profile Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile/:userId` | Get user profile |
| POST | `/api/profile` | Create new profile |
| PUT | `/api/profile/:userId` | Update profile |
| DELETE | `/api/profile/:userId` | Delete profile |
| GET | `/api/profile/:userId/signals` | Get user signals |
| GET | `/api/profile/search` | Search profiles |

### Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences/:userId` | Get all preferences |
| PUT | `/api/preferences/:userId` | Update preferences |
| PATCH | `/api/preferences/:userId/:app` | Update specific app |

### Signals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signal` | Add a signal |
| POST | `/api/signal/batch` | Add multiple signals |
| GET | `/api/signal/:userId` | Get user signals |

### Personalization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personalization/:userId` | Get unified personalization |
| GET | `/api/personalization/:userId/:app` | Get app-specific personalization |
| POST | `/api/personalization/:userId/recommendations` | Get AI recommendations |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history/:userId` | Get user history |
| PUT | `/api/history/:userId` | Update history |
| POST | `/api/history/:userId/increment` | Increment booking stats |

## Data Models

### User Profile

```typescript
{
  userId: string;
  profile: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: Date;
    gender?: string;
  };
  preferences: {
    hotel?: HotelPreferences;
    restaurant?: RestaurantPreferences;
    rendez?: RendezPreferences;
    corporate?: CorporatePreferences;
  };
  history: {
    totalBookings: number;
    totalSpent: number;
    avgRating: number;
    loyaltyTier: string;
    joinedDate: Date;
    lastActive: Date;
  };
  signals: Signal[];
  connectedApps: ConnectedApp[];
}
```

## Authentication

### Service-to-Service

Include these headers in service requests:

```
X-Service-Secret: <your-service-secret>
X-Service-Id: <your-service-id>
X-Service-Name: <your-service-name>
```

### API Key

```
X-Service-Auth: <your-api-key>
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3003` |
| `MONGODB_URI` | MongoDB connection | `mongodb://localhost:27017/rez-knowledge` |
| `REZ_MIND_SERVICE_URL` | REZ Mind API URL | `http://localhost:3001` |
| `REZ_MIND_API_KEY` | REZ Mind API key | - |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `SERVICE_SECRET` | Service auth secret | `dev-service-secret` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      REZ Apps                                │
│  StayOwn  │  Rendez  │  Corpspark  │  Consumer Apps          │
└───────────┴─────────┴─────────────┴────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     REZ Knowledge Service     │
              │   (User Profile & Signals)    │
              └───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│        MongoDB          │   │       REZ Mind Service       │
│   (User Profiles)       │   │     (AI Personalization)     │
└─────────────────────────┘   └─────────────────────────────┘
```

## License

Proprietary - REZ Technologies
