# ReZ Mind Grocery Service - Technical Specification

## Overview

The ReZ Mind Grocery Service is an AI-powered intelligence service designed for grocery merchants to optimize inventory, reduce waste, and enhance customer experience through intelligent product recommendations, expiry predictions, and demand forecasting.

## Service Architecture

### Core Components

1. **GroceryIntelligence Service**
   - Predicts product expiry dates based on batch information and storage conditions
   - Recommends personalized products based on customer history
   - Forecasts demand for products at store level
   - Scores and ranks suppliers based on performance metrics

2. **BasketAnalyzer Service**
   - Analyzes shopping cart contents
   - Identifies cross-sell and upsell opportunities
   - Suggests product bundles
   - Identifies category gaps in basket

3. **ExpiryOptimizer Service**
   - Calculates optimal discount levels for products approaching expiry
   - Generates alerts for items requiring action
   - Determines donation thresholds for items near expiry

## Data Models

### GroceryMindSession
- **Purpose**: Stores AI consultation sessions
- **Retention**: 60 days TTL
- **Indexes**: 
  - sessionId (unique)
  - merchantId

### ExpiryPrediction
- **Purpose**: Tracks predicted expiry dates for products
- **Indexes**:
  - merchantId + daysRemaining (compound)

### DemandForecast
- **Purpose**: Stores demand predictions with accuracy tracking
- **Indexes**:
  - merchantId + productId + dateRange

## API Specification

### POST /api/consult

**Request:**
```json
{
  "merchantId": "string (required)",
  "customerId": "string (optional)",
  "basketItems": [
    {
      "productId": "string",
      "productName": "string",
      "category": "produce|dairy|bakery|frozen|beverages|snacks|essentials",
      "quantity": "number",
      "unitPrice": "number"
    }
  ],
  "preferences": ["string"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "recommendations": [...],
    "expiryAlerts": [...],
    "demandSignals": [...],
    "supplierSuggestions": [...],
    "savingsOpportunities": [...]
  }
}
```

### GET /api/expiry/predictions/:merchantId

**Response:**
```json
{
  "success": true,
  "data": {
    "predictions": [
      {
        "predictionId": "uuid",
        "productId": "string",
        "productName": "string",
        "predictedExpiryDate": "ISO date",
        "daysRemaining": "number",
        "confidence": "0-1",
        "suggestedAction": "discount|donate|remove"
      }
    ]
  }
}
```

### GET /api/demand/forecast/:merchantId

**Response:**
```json
{
  "success": true,
  "data": {
    "forecasts": [
      {
        "forecastId": "uuid",
        "productId": "string",
        "productName": "string",
        "predictedQuantity": "number",
        "confidence": "0-1",
        "dateRange": {
          "from": "ISO date",
          "to": "ISO date"
        }
      }
    ]
  }
}
```

## Industry Knowledge Base

### Product Categories
1. **Produce**: Fruits, vegetables, herbs
2. **Dairy**: Milk, cheese, yogurt, eggs
3. **Bakery**: Bread, pastries, cakes
4. **Frozen**: Frozen meals, ice cream, frozen vegetables
5. **Beverages**: Soft drinks, juices, water, coffee, tea
6. **Snacks**: Chips, cookies, candy, nuts
7. **Essentials**: Rice, pasta, oil, sugar, flour

### Expiry Patterns

| Category | Base Shelf Life | Refrigeration | Freezing |
|----------|----------------|---------------|----------|
| Produce | 3-7 days | 5-10 days | 8-12 months |
| Dairy | 7-14 days | 14-21 days | 1-3 months |
| Bakery | 2-5 days | 5-7 days | 3-6 months |
| Frozen | N/A | N/A | 6-12 months |
| Beverages | 30-180 days | 14-30 days | 6-12 months |
| Snacks | 30-90 days | N/A | 6-12 months |
| Essentials | 180-365 days | N/A | 12+ months |

### Seasonal Produce Patterns

| Season | Peak Categories | High-Demand Items |
|--------|----------------|-------------------|
| Spring | Produce | Asparagus, strawberries, leafy greens |
| Summer | Produce, Beverages | Watermelon, corn, ice cream, juices |
| Fall | Produce, Essentials | Apples, pumpkins, baking supplies |
| Winter | Produce, Beverages | Citrus, root vegetables, holiday treats |

## Rate Limiting

- **AI Consultation**: 30 requests per minute
- **Read Operations**: 100 requests per minute
- **Pricing Operations**: 50 requests per minute

## Authentication

- Internal service authentication via `X-Internal-Token` header
- JWT Bearer token support for external services
- Rate limiting per service token

## Dependencies

- MongoDB: Primary data store
- RABTUL Platform: Intent routing and notifications
- ReZ Intelligence Hub: AI model orchestration

## Performance Targets

- Response time: < 500ms for AI consultations
- Throughput: 100 concurrent requests
- Availability: 99.9% uptime

## Monitoring

- Health endpoints for load balancer integration
- Detailed metrics in `/health/detailed`
- Request tracing via correlation IDs

## Error Handling

- Structured error responses with error codes
- Graceful degradation on service failures
- Automatic retry for transient failures

## Security

- Helmet.js for HTTP headers
- CORS configuration for allowed origins
- Rate limiting to prevent abuse
- Input validation with Zod schemas

## Future Enhancements

1. Integration with IoT sensors for real-time freshness monitoring
2. Machine learning models for personalized recommendations
3. Automated supplier negotiation through AI agents
4. Real-time inventory optimization across multiple stores