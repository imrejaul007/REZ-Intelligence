# Supplier Marketplace

**Port:** 4063
**Purpose:** B2B supplier directory and marketplace

---

## Overview

The Supplier Marketplace provides a comprehensive B2B platform for connecting businesses with suppliers. It handles:

- Supplier registration and verification
- Product catalog management
- Order processing
- Review and rating system
- Supplier analytics

## Features

### Supplier Management
- Supplier registration with business verification
- Business type classification
- Certification tracking
- Rating and review system
- Performance metrics

### Product Catalog
- Product listing and management
- Category organization
- Pricing with MOQ support
- Stock availability tracking
- Search and filtering

### Order Management
- Multi-product orders
- Order status tracking
- Payment status management
- Delivery tracking
- Order timeline

### Reviews & Ratings
- Verified purchase reviews
- Rating breakdown
- Supplier responses
- Helpful votes
- Review moderation

## API Endpoints

### Supplier Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/suppliers` | Register supplier |
| GET | `/api/suppliers` | List suppliers |
| GET | `/api/suppliers/:supplierId` | Get supplier details |
| PATCH | `/api/suppliers/:supplierId` | Update supplier |
| PATCH | `/api/suppliers/:supplierId/status` | Update status |
| GET | `/api/suppliers/search/query` | Search suppliers |
| GET | `/api/suppliers/:supplierId/products` | Get supplier products |
| GET | `/api/suppliers/:supplierId/stats` | Get statistics |

### Product Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/products` | Create product |
| GET | `/api/products` | List products |
| GET | `/api/products/:productId` | Get product details |
| PATCH | `/api/products/:productId` | Update product |
| PATCH | `/api/products/:productId/status` | Update status |
| GET | `/api/products/search/query` | Search products |
| GET | `/api/products/meta/categories` | Get categories |
| DELETE | `/api/products/:productId` | Discontinue product |

### Order Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/:orderId` | Get order details |
| PATCH | `/api/orders/:orderId/status` | Update status |
| PATCH | `/api/orders/:orderId/payment` | Update payment |
| GET | `/api/orders/buyer/:buyerId` | Buyer orders |
| GET | `/api/orders/supplier/:supplierId` | Supplier orders |

### Review Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reviews` | Create review |
| GET | `/api/reviews` | List reviews |
| GET | `/api/reviews/:reviewId` | Get review details |
| PATCH | `/api/reviews/:reviewId/status` | Update status |
| POST | `/api/reviews/:reviewId/respond` | Supplier response |
| GET | `/api/reviews/supplier/:supplierId/summary` | Review summary |
| POST | `/api/reviews/:reviewId/helpful` | Mark helpful |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suppliers/health` | Service health status |

## Data Models

### Supplier

```javascript
{
  supplierId: "SUP-12345678",
  businessName: "Fresh Produce Co.",
  ownerName: "Rajesh Sharma",
  email: "contact@freshproduce.in",
  phone: "+919876543210",
  businessType: "wholesaler",
  categories: ["vegetables", "fruits", "organic"],
  address: {
    city: "Bangalore",
    state: "Karnataka"
  },
  certifications: ["FSSAI", "ISO 22000"],
  minimumOrder: 5000,
  paymentTerms: "net15",
  deliveryCapabilities: {
    localDelivery: true,
    regionalDelivery: true,
    nationalDelivery: false,
    minDeliveryDays: 1,
    maxDeliveryDays: 3
  },
  rating: {
    average: 4.5,
    totalReviews: 128
  },
  status: "active"
}
```

### Product

```javascript
{
  productId: "PRD-ABCDEF12",
  supplierId: "SUP-12345678",
  name: "Organic Tomatoes",
  description: "Farm fresh organic tomatoes",
  category: "vegetables",
  sku: "TOM-ORG-500",
  unit: "kg",
  moq: 10,
  price: {
    minPrice: 45,
    maxPrice: 60,
    currency: "INR"
  },
  availability: {
    inStock: true,
    stockQuantity: 500,
    leadTimeDays: 1
  },
  rating: {
    average: 4.2,
    totalReviews: 45
  },
  status: "active"
}
```

### Order

```javascript
{
  orderId: "ORD-XYZ12345",
  buyerId: "buyer_001",
  supplierId: "SUP-12345678",
  products: [
    {
      productId: "PRD-ABCDEF12",
      name: "Organic Tomatoes",
      quantity: 50,
      unitPrice: 45,
      totalPrice: 2250
    }
  ],
  subtotal: 2250,
  tax: 405,
  deliveryFee: 50,
  totalAmount: 2705,
  status: "delivered",
  paymentStatus: "paid",
  timeline: [...]
}
```

## Usage Examples

### Register a Supplier

```bash
curl -X POST http://localhost:4063/api/suppliers \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Fresh Produce Co.",
    "ownerName": "Rajesh Sharma",
    "email": "contact@freshproduce.in",
    "phone": "+919876543210",
    "businessType": "wholesaler",
    "categories": ["vegetables", "fruits"],
    "minimumOrder": 5000
  }'
```

### Add a Product

```bash
curl -X POST http://localhost:4063/api/products \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUP-12345678",
    "name": "Organic Tomatoes",
    "category": "vegetables",
    "moq": 10,
    "price": { "minPrice": 45 },
    "availability": { "inStock": true, "stockQuantity": 500 }
  }'
```

### Create an Order

```bash
curl -X POST http://localhost:4063/api/orders \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "buyer_001",
    "supplierId": "SUP-12345678",
    "products": [
      { "productId": "PRD-ABCDEF12", "quantity": 50 }
    ],
    "deliveryAddress": {
      "city": "Bangalore",
      "state": "Karnataka"
    }
  }'
```

### Add a Review

```bash
curl -X POST http://localhost:4063/api/reviews \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-XYZ12345",
    "supplierId": "SUP-12345678",
    "buyerId": "buyer_001",
    "rating": 5,
    "title": "Excellent quality!",
    "comment": "Fresh produce delivered on time.",
    "pros": ["Fresh", "On time", "Good packaging"],
    "cons": []
  }'
```

## Environment Variables

```bash
# Service
PORT=4063
MONGODB_URI=mongodb://localhost:27017/rez-supplier-marketplace
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Marketplace Settings
COMMISSION_RATE=5
MIN_ORDER_VALUE=1000
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-supplier-marketplace
npm install
cp .env.example .env
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  Order Service  │────▶│   Supplier           │
└─────────────────┘     │   Marketplace        │
                        └──────────┬───────────┘
                                   │
┌─────────────────┐     ┌──────────▼───────────┐
│  Payment Service│────▶│   Order Management   │
└─────────────────┘     └──────────────────────┘
```

## Integration Points

| Service | Integration |
|---------|-------------|
| `rez-payment-service` | Payment processing |
| `REZ-inventory-sync` | Inventory sync |
| `REZ-notifications-service` | Order notifications |
| `REZ-engagement-platform` | Supplier offers |

## Related Services

- [Multi-location Service](./REZ-multi-location-service/) - Multi-store management
- [Inventory Alerts Service](./REZ-inventory-alerts-service/) - Stock notifications
- [Reservation Service](./REZ-reservation-service/) - Restaurant reservations
