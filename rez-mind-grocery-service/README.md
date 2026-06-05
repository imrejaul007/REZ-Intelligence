# ReZ Mind Grocery Service

AI-powered intelligence service for grocery industry operations, helping merchants optimize inventory, reduce waste, and improve customer experience.

## Features

- **Product Recommendations**: Personalized recommendations based on purchase history and preferences
- **Expiry Prediction**: AI-powered expiry date prediction and waste reduction strategies
- **Demand Forecasting**: Accurate demand predictions per product per store
- **Supplier Optimization**: Intelligent supplier selection based on prices, reliability, and performance
- **Basket Analysis**: Cross-sell and upsell opportunities based on shopping cart
- **Freshness Scoring**: Real-time freshness scoring and alerts for perishable goods

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
PORT=4057
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez_mind_grocery
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
- `POST /api/consult` - Process grocery AI consultation
- `GET /api/consult/:sessionId` - Retrieve consultation session

### Expiry Management
- `GET /api/expiry/predictions/:merchantId` - Get expiry predictions
- `GET /api/expiry/predictions/:merchantId/product/:productId` - Get specific product expiry
- `POST /api/expiry/predictions/:merchantId/simulate` - Simulate discount impact

### Demand Forecasting
- `GET /api/demand/forecast/:merchantId` - Get demand forecasts
- `GET /api/demand/forecast/:merchantId/product/:productId` - Get specific product forecast
- `POST /api/demand/adjust` - Adjust forecast for events/promotions

### Supplier Optimization
- `GET /api/supplier/optimize/:merchantId` - Get supplier recommendations
- `GET /api/supplier/performance/:merchantId` - Get supplier performance scores

## Architecture

```
src/
├── index.ts                 # Application entry point
├── config/
│   ├── index.ts            # Environment configuration
│   ├── knowledge.ts         # Grocery industry knowledge base
│   └── systemPrompt.ts      # AI training prompts
├── types/
│   └── index.ts            # TypeScript interfaces
├── models/
│   ├── index.ts             # Model exports
│   ├── GroceryMindSession.ts
│   ├── ExpiryPrediction.ts
│   └── DemandForecast.ts
├── routes/
│   ├── consult.routes.ts
│   ├── expiry.routes.ts
│   ├── demand.routes.ts
│   └── supplier.routes.ts
├── services/
│   ├── groceryIntelligence.ts
│   ├── basketAnalyzer.ts
│   └── expiryOptimizer.ts
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
| Grocery | 4057 |

## License

Proprietary - ReZ Technologies