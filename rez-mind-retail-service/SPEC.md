# ReZ Mind Retail Service - Technical Specification

## Overview

The ReZ Mind Retail Service is an AI-powered intelligence service that provides retail businesses with product recommendations, inventory management insights, customer behavior analysis, and pricing optimization capabilities.

## Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose ODM)
- **Validation**: Zod
- **Logging**: Winston

### Port Configuration
- **Default Port**: 4056
- **Environment Variable**: `PORT`

## Configuration

### Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| PORT | number | Yes | 4056 | Server port |
| NODE_ENV | string | Yes | development | Environment mode |
| MONGODB_URI | string | Yes | - | MongoDB connection URI |
| INTERNAL_SERVICE_TOKEN | string | Yes | - | Internal service authentication token |
| AUTH_SERVICE_URL | string | No | - | Authentication service URL |
| LOG_LEVEL | string | No | info | Logging level |

## Data Models

### RetailMindSession

Stores AI consultation sessions with customer analysis.

```typescript
{
  sessionId: string;          // UUID, unique
  merchantId: string;         // Merchant identifier
  customerId?: string;        // Customer identifier
  customerProfile: {
    segment: CustomerSegment; // customer segment type
    preferences: string[];    // preference tags
    avgOrderValue: number;    // average order value
    purchaseFrequency: string; // frequency category
  };
  cartItems?: CartItem[];     // Current cart items
  analysis: {
    recommendedProducts: ProductRecommendation[];
    upsellOpportunities: UpsellOpportunity[];
    pricingSuggestions: PricingSuggestion[];
    inventoryAlerts: InventoryAlert[];
  };
  sentimentScore?: number;    // -1 to 1
  nextBestAction?: string;   // Recommended next action
  createdAt: Date;
  updatedAt: Date;            // TTL index (90 days)
}
```

**Indexes**:
- `sessionId`: unique
- `merchantId`: standard
- `customerId`: standard
- `[merchantId, createdAt]`: compound with TTL (90 days)

### ProductInsight

Stores AI-generated insights about products.

```typescript
{
  insightId: string;          // UUID, unique
  merchantId: string;         // Merchant identifier
  productId: string;          // Product identifier
  type: InsightType;          // trending/slow_moving/seasonal/bundle/opportunity
  score: number;              // 0-100 confidence score
  confidence: number;         // 0-1 probability
  description: string;         // Insight description
  recommendations: string[];  // Action recommendations
  isActive: boolean;          // Active status
  expiresAt?: Date;           // Expiration (TTL)
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `[merchantId, type, isActive]`: compound
- `productId`: standard

### PricingStrategy

Stores pricing optimization strategies.

```typescript
{
  strategyId: string;         // UUID, unique
  merchantId: string;         // Merchant identifier
  productId?: string;         // Product identifier (optional for category-level)
  categoryId?: string;        // Category identifier
  strategyType: StrategyType; // competitive/margin/psychological/seasonal/bundle
  currentPrice: number;       // Current price
  suggestedPrice: number;     // AI suggested price
  minPrice: number;           // Floor price
  maxPrice: number;           // Ceiling price
  triggers: PricingTrigger[]; // Trigger conditions
  status: StrategyStatus;     // active/paused/archived
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `[merchantId, status]`: compound
- `productId`: standard

## API Endpoints

### Health Endpoints

#### GET /health
Basic health check. Returns 200 if service is running.

#### GET /health/detailed
Returns detailed health including MongoDB connection status and system metrics.

#### GET /health/ready
Readiness check for load balancers. Returns 200 only if all dependencies are available.

### Consult Routes

#### POST /api/consult
AI retail consultation endpoint.

**Request Body**:
```typescript
{
  merchantId: string;
  customerId?: string;
  cartItems?: CartItem[];
  preferences?: string[];
  browseHistory?: BrowseEvent[];
}
```

**Response**:
```typescript
{
  sessionId: string;
  recommendations: ProductRecommendation[];
  upsellOpportunities: UpsellOpportunity[];
  pricingSuggestions: PricingSuggestion[];
  inventoryAlerts: InventoryAlert[];
  customerSegment: CustomerSegment;
  nextBestAction: string;
  confidence: number;
}
```

#### GET /api/consult/:sessionId
Retrieves a previous consultation session.

### Recommendation Routes

#### GET /api/recommendations/product/:productId
Returns similar products based on product attributes.

#### GET /api/recommendations/bundle/:merchantId
Returns bundle opportunity recommendations.

#### GET /api/recommendations/upsell/:merchantId
Returns upsell recommendations by category.

#### POST /api/recommendations/personalized
Returns personalized recommendations for a customer.

### Pricing Routes

#### POST /api/pricing/optimize
Optimizes pricing for a product.

**Request Body**:
```typescript
{
  merchantId: string;
  productId: string;
  competitorPrices?: CompetitorPrice[];
  demandSignals?: DemandSignal[];
  inventoryLevel?: number;
}
```

**Response**:
```typescript
{
  suggestedPrice: number;
  strategy: StrategyType;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  reasoning: string;
}
```

#### GET /api/pricing/strategies/:merchantId
Returns active pricing strategies for a merchant.

#### POST /api/pricing/strategies
Creates a new pricing strategy.

### Inventory Routes

#### GET /api/inventory/forecast/:merchantId
Returns demand forecast for a merchant's products.

#### GET /api/inventory/reorder/:merchantId
Returns reorder recommendations.

#### GET /api/inventory/trending/:merchantId
Returns trending products.

## Types

### Enums

```typescript
CustomerSegment: 'bargain_hunter' | 'premium_buyer' | 'occasional' | 'routine' | 'first_timer'
InsightType: 'trending' | 'slow_moving' | 'seasonal' | 'bundle' | 'opportunity'
StrategyType: 'competitive' | 'margin' | 'psychological' | 'seasonal' | 'bundle'
StrategyStatus: 'active' | 'paused' | 'archived'
ProductCategory: 'electronics' | 'fashion' | 'grocery' | 'home' | 'furniture' | 'beauty' | 'sports' | 'toys' | 'books'
```

## Services

### RetailIntelligence Service
Core AI logic for retail operations.

Functions:
- `analyzeCart(cartItems)` → CartAnalysis
- `segmentCustomer(purchaseHistory)` → CustomerSegment
- `predictLifetimeValue(customerHistory)` → CLV
- `recommendProducts(category, preferences)` → ProductRecommendation[]
- `detectTrends(merchantId)` → TrendingProduct[]

### Recommendation Engine
Product recommendation logic.

Functions:
- `personalizedRecommendations(customerId, limit)` → ProductRecommendation[]
- `bundleRecommendations(merchantId)` → BundleRecommendation[]
- `upsellRecommendations(merchantId, currentCart)` → UpsellRecommendation[]
- `similarProducts(productId, limit)` → SimilarProduct[]

### Pricing Engine
Pricing optimization logic.

Functions:
- `optimizePrice(productId, context)` → PriceOptimization
- `generateBundlePricing(bundleProducts)` → BundlePricing
- `competitiveAnalysis(merchantId)` → CompetitiveAnalysis
- `psychologicalPricing(suggestedPrice)` → number

## Middleware

### Authentication
- JWT token validation
- X-Internal-Token header for internal services
- Rate limiting per client

### Error Handler
- Structured error responses
- Request ID tracking
- Detailed error logging

### Rate Limiter
- AI consultation: 30 req/min
- Read endpoints: 100 req/min

## Knowledge Base

### Product Categories
- electronics, fashion, grocery, home, furniture, beauty, sports, toys, books

### Seasonal Patterns
- Predefined seasonal adjustments for each category
- Holiday-specific recommendations

### Customer Segments
- bargain_hunter: Price-sensitive, deal-focused
- premium_buyer: Quality-focused, higher spend
- occasional: Random purchases, low frequency
- routine: Regular purchases, predictable
- first_timer: New customers, exploratory

### Pricing Tiers
- Economy: 0-20% markup
- Standard: 20-40% markup
- Premium: 40-80% markup
- Luxury: 80%+ markup

## Integration

### REZ Intelligence Hub
- Connection to central AI intelligence platform
- Model sharing and updates

### RABTUL Platform
- External platform integration
- Data synchronization

## Deployment

### Docker
- Multi-stage build
- Node.js 18 Alpine base
- Health checks included
- Non-root user for security

### Environment
- All secrets via environment variables
- No hardcoded credentials
- Separate .env for dev/staging/prod