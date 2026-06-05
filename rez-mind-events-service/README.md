# ReZ Mind Events Service

AI-powered intelligence service for events industry, helping organizers optimize attendance, pricing, vendor selection, and guest satisfaction.

## Features

- **Attendance Prediction**: AI-powered predictions for event attendance
- **Pricing Optimization**: Dynamic pricing based on demand and market conditions
- **Vendor Matching**: Intelligent vendor recommendations based on event requirements
- **Guest Satisfaction Prediction**: Predict guest satisfaction based on event factors
- **Budget Optimization**: AI-driven budget allocation recommendations
- **Timeline Recommendations**: Optimal event planning timeline
- **Marketing Campaign Suggestions**: Data-driven marketing recommendations

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

```env
PORT=4059
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez_mind_events
INTERNAL_SERVICE_TOKEN=your-32-char-minimum-secret-token
AUTH_SERVICE_URL=https://auth.rez.com
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_AI=30
RATE_LIMIT_MAX_READ=100
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with dependencies
- `GET /health/detailed` - Detailed health status

### AI Consultation
- `POST /api/consult` - Process events AI consultation
- `GET /api/consult/:sessionId` - Retrieve consultation session

### Pricing Management
- `GET /api/pricing/:eventId` - Get pricing optimization
- `POST /api/pricing/:eventId/optimize` - Optimize event pricing
- `GET /api/pricing/:eventId/demand` - Get demand forecast

### Vendor Management
- `GET /api/vendor/:eventId/matches` - Get vendor matches
- `GET /api/vendor/:eventId/performance` - Get vendor performance
- `POST /api/vendor/recommend` - Get vendor recommendations

### Marketing
- `POST /api/marketing/:eventId/campaign` - Generate campaign suggestions
- `GET /api/marketing/:eventId/insights` - Get marketing insights

## Architecture

```
src/
├── index.ts                 # Application entry point
├── config/
│   ├── index.ts            # Environment configuration
│   ├── knowledge.ts         # Events industry knowledge base
│   └── systemPrompt.ts      # AI training prompts
├── types/
│   └── index.ts            # TypeScript interfaces
├── models/
│   ├── index.ts             # Model exports
│   ├── EventsMindSession.ts
│   ├── AttendancePrediction.ts
│   ├── PricingOptimization.ts
│   └── VendorMatch.ts
├── routes/
│   ├── consult.routes.ts
│   ├── pricing.routes.ts
│   ├── vendor.routes.ts
│   └── marketing.routes.ts
├── services/
│   ├── eventsIntelligence.ts
│   ├── attendancePredictor.ts
│   ├── pricingOptimizer.ts
│   └── vendorMatcher.ts
├── middleware/
│   ├── auth.ts
│   ├── errorHandler.ts
│   ├── rateLimit.ts
│   └── validation.ts
├── integrations/
│   └── rabtul.ts
└── utils/
    └── logger.ts
```

## Port Configuration

| Service | Port |
|---------|------|
| Events | 4059 |

## License

Proprietary - ReZ Technologies