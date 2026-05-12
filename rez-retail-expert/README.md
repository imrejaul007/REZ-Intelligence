# REZ Retail Expert

A purpose-built retail expert agent for the REZ commerce platform, providing intelligent product search, recommendations, sizing guidance, and shopping assistance.

## Features

- **Product Search**: Natural language search across categories, brands, and descriptions
- **Smart Recommendations**: Personalized suggestions based on preferences and browsing history
- **Product Comparisons**: Side-by-side analysis of similar items
- **Size Guides**: Detailed measurement charts for clothing, shoes, and accessories
- **Availability Tracking**: Real-time stock status and restock notifications
- **Wishlist Management**: Save and manage favorite items
- **Deal Discovery**: Find products with discounts and promotions

## Architecture

```
rez-retail-expert/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── config/
│   │   ├── systemPrompt.ts         # Agent personality and behavior
│   │   └── knowledge.ts           # Categories, size guides, products
│   ├── services/
│   │   └── retailExpert.ts        # Core retail expertise logic
│   ├── intents/
│   │   └── retailIntents.ts       # Intent recognition and entity extraction
│   └── routes/
│       └── retail.routes.ts        # API endpoints
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### Chat
```
POST /api/v1/retail/chat
```
Process retail-related messages and return intelligent responses.

### Products
```
GET    /api/v1/retail/products              # Search products
GET    /api/v1/retail/products/:id         # Get product details
POST   /api/v1/retail/products/search        # Advanced search with filters
```

### Categories
```
GET /api/v1/retail/categories               # List all categories
GET /api/v1/retail/categories/:id          # Get category with products
```

### Size Guides
```
GET  /api/v1/retail/size-guides             # List all size guides
POST /api/v1/retail/size-guides/recommend   # Get size recommendation
```

### Recommendations & Discovery
```
GET /api/v1/retail/recommendations          # Get product recommendations
GET /api/v1/retail/deals                    # Find products with discounts
GET /api/v1/retail/new-arrivals             # Get newest products
```

### Comparison
```
POST /api/v1/retail/compare                 # Compare multiple products
```

## Product Categories

| Category | Subcategories |
|----------|---------------|
| Women's Clothing | Dresses, Tops, Pants, Jeans, Jackets |
| Men's Clothing | T-Shirts, Shirts, Pants, Suits |
| Shoes | Sneakers, Boots, Sandals, Dress Shoes |
| Accessories | Bags, Watches, Sunglasses, Jewelry |
| Electronics | Headphones, Speakers, Tablets, Laptops |
| Home & Living | Furniture, Bedding, Kitchen, Decor |
| Beauty | Skincare, Makeup, Haircare, Fragrances |
| Sports | Athletic Apparel, Equipment, Outdoor |

## Sort Options

| Option | Description |
|--------|-------------|
| `relevance` | Default relevance ranking |
| `price_low_to_high` | Price ascending |
| `price_high_to_low` | Price descending |
| `rating` | Highest rated first |
| `newest` | Most recently added |
| `best_selling` | Best selling items |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3004 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |
| INVENTORY_SERVICE_URL | Inventory service URL | localhost:4006 |
| ORDER_SERVICE_URL | Order service URL | localhost:4007 |

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

### Send a shopping message
```bash
curl -X POST http://localhost:3004/api/v1/retail/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I am looking for a comfortable denim jacket under $100",
    "context": {
      "shopper": {
        "id": "user_123",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "preferences": ["casual", "denim"],
        "tier": "premium"
      }
    }
  }'
```

### Search products
```bash
curl -X GET "http://localhost:3004/api/v1/retail/products?query=sneakers&category=shoes&sort=rating"
```

### Get size recommendation
```bash
curl -X POST http://localhost:3004/api/v1/retail/size-guides/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "category": "womens-tops",
    "measurements": {
      "Bust": "36",
      "Waist": "28",
      "Shoulder": "15"
    }
  }'
```

### Compare products
```bash
curl -X POST http://localhost:3004/api/v1/retail/compare \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["prod-001", "prod-002"]
  }'
```

### Get deals
```bash
curl -X GET http://localhost:3004/api/v1/retail/deals
```

## Sizing Categories

| Category | Key Measurements |
|----------|------------------|
| Women's Tops | Bust, Waist, Shoulder, Arm Length |
| Men's Tops | Chest, Waist, Shoulder, Arm Length |
| Women's Bottoms | Waist, Hips, Inseam |
| Men's Bottoms | Waist, Hips, Inseam |
| Women's Shoes | Foot Length, Foot Width |
| Men's Shoes | Foot Length, Foot Width |

## License

Proprietary - REZ Commerce Platform
