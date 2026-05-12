# REZ Sales Agent

A purpose-built sales agent for the REZ commerce platform, providing intelligent product recommendations, dynamic pricing, and personalized sales interactions.

## Features

- **Intelligent Product Recommendations**: ML-powered recommendations based on customer behavior, preferences, and purchase history
- **Dynamic Pricing Engine**: Real-time pricing adjustments based on demand, inventory, customer segment, and market conditions
- **Lead Management**: Automated lead scoring, tracking, and nurturing
- **Conversational Sales**: Natural language processing for customer interactions
- **Personalized Discounts**: Segment-based and loyalty-based discount eligibility

## Architecture

```
rez-sales-agent/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── services/
│   │   ├── salesAgent.ts     # Core sales logic and conversation handling
│   │   ├── productRecommendation.ts  # Recommendation engine
│   │   └── pricingService.ts # Dynamic pricing calculations
│   └── routes/
│       └── sales.routes.ts   # API endpoints
├── package.json
└── tsconfig.json
```

## API Endpoints

### Chat
```
POST /api/v1/sales/chat
```
Process customer messages and return intelligent responses.

### Lead Management
```
POST   /api/v1/sales/leads        # Create a new lead
GET    /api/v1/sales/leads        # List all leads
GET    /api/v1/sales/leads/:id    # Get lead by ID
PATCH  /api/v1/sales/leads/:id/score  # Update lead score
```

### Recommendations
```
POST   /api/v1/sales/recommendations           # Get personalized recommendations
GET    /api/v1/sales/recommendations/trending  # Get trending products
GET    /api/v1/sales/recommendations/complementary/:productId  # Get complementary products
POST   /api/v1/sales/recommendations/personalized-deals  # Get personalized deals
```

### Pricing
```
POST /api/v1/sales/pricing/calculate        # Calculate dynamic price
POST /api/v1/sales/pricing/discount-eligibility  # Check discount eligibility
POST /api/v1/sales/pricing/bundle          # Calculate bundle pricing
POST /api/v1/sales/pricing/promo            # Apply promo code
POST /api/v1/sales/pricing/taxes            # Calculate taxes and fees
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode
npm run dev
```

## Example Usage

### Send a chat message
```bash
curl -X POST http://localhost:3001/api/v1/sales/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to book a hotel room with ocean view",
    "context": {
      "customer": {
        "id": "cust_123",
        "email": "customer@example.com",
        "name": "John Doe",
        "segment": "returning",
        "lifetimeValue": 2500,
        "totalOrders": 5,
        "averageOrderValue": 500
      }
    }
  }'
```

### Get recommendations
```bash
curl -X POST http://localhost:3001/api/v1/sales/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "id": "cust_123",
      "email": "customer@example.com",
      "name": "John Doe",
      "segment": "vip",
      "lifetimeValue": 5000,
      "totalOrders": 10,
      "averageOrderValue": 500
    },
    "recentProducts": ["prod_001"],
    "browsingHistory": ["prod_002", "prod_003"]
  }'
```

### Calculate dynamic price
```bash
curl -X POST http://localhost:3001/api/v1/sales/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 299.99,
    "segment": "vip",
    "quantity": 1,
    "timeToTravel": 14,
    "inventoryLevel": 15,
    "demandScore": 0.6
  }'
```

## Dynamic Pricing Factors

The pricing engine considers the following factors:

1. **Seasonal Multipliers**: Peak, high, normal, low, and off-season adjustments
2. **Demand Score**: Based on product popularity and inventory levels
3. **Customer Segment**: VIP and Enterprise customers receive loyalty discounts
4. **Volume Discounts**: Tiered discounts for bulk orders
5. **Early Bird Discounts**: Incentives for bookings made 30+ days in advance
6. **Last-Minute Premiums**: Higher prices for short-notice bookings
7. **Inventory Pressure**: Price adjustments based on stock levels

## Customer Segments

| Segment | Discount |
|---------|----------|
| New Customer | 0% |
| Returning Customer | 5% |
| VIP | 15% |
| Enterprise | 20% |

## License

Proprietary - REZ Commerce Platform
