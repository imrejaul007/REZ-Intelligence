# ReZ Mind Retail Service

AI brain for the retail industry - provides intelligent product recommendations, inventory intelligence, customer behavior analysis, pricing optimization, merchandising insights, and demand forecasting.

## Features

- **Product Recommendations**: AI-powered personalized product suggestions based on customer behavior and preferences
- **Inventory Intelligence**: Demand forecasting and reorder recommendations
- **Customer Behavior Analysis**: Customer segmentation and lifetime value prediction
- **Pricing Optimization**: Dynamic pricing strategies and competitive analysis
- **Merchandising Insights**: Bundle opportunities and cross-sell recommendations
- **Demand Forecasting**: Trend detection and seasonal pattern analysis

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/ready` - Readiness check for load balancers

### Consult
- `POST /api/consult` - AI retail consultation
- `GET /api/consult/:sessionId` - Retrieve session analysis

### Recommendations
- `GET /api/recommendations/product/:productId` - Similar products
- `GET /api/recommendations/bundle/:merchantId` - Bundle opportunities
- `GET /api/recommendations/upsell/:merchantId` - Upsell by category
- `POST /api/recommendations/personalized` - Personalized recommendations

### Pricing
- `POST /api/pricing/optimize` - Pricing optimization
- `GET /api/pricing/strategies/:merchantId` - List active strategies
- `POST /api/pricing/strategies` - Create pricing strategy

### Inventory
- `GET /api/inventory/forecast/:merchantId` - Demand forecast
- `GET /api/inventory/reorder/:merchantId` - Reorder recommendations
- `GET /api/inventory/trending/:merchantId` - Trending products

## Authentication

Internal services use `X-Internal-Token` header with the `INTERNAL_SERVICE_TOKEN` from environment.

## Rate Limits

- AI consultation endpoints: 30 requests/minute
- Read endpoints: 100 requests/minute

## License

Proprietary - ReZ Technologies