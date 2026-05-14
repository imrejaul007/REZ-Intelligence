# Multi-location Service

**Port:** 4062
**Purpose:** Franchise and multi-store management

---

## Overview

The Multi-location Service provides comprehensive management for franchises and multiple store locations. It handles:

- Franchise creation and management
- Location management with operating hours
- Location inventory tracking
- Inventory transfers between locations
- Analytics and reporting
- Nearest location search

## Features

### Franchise Management
- Create and manage franchises
- Owner association
- Branding configuration
- Business type classification
- Suspend/close operations

### Location Management
- Create locations within franchises
- Operating hours configuration
- Address and contact management
- Capacity settings
- Nearby location search
- Real-time open/closed status

### Inventory Management
- Per-location inventory tracking
- Stock level monitoring
- Low stock alerts
- Sale recording
- Restock management
- Movement history

### Inventory Transfers
- Transfer between locations
- Approval workflow
- Status tracking (pending, approved, in_transit, delivered)
- Automatic inventory updates

## API Endpoints

### Franchise Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/franchises` | Create franchise |
| GET | `/api/franchises` | List franchises |
| GET | `/api/franchises/:franchiseId` | Get franchise details |
| PATCH | `/api/franchises/:franchiseId` | Update franchise |
| PATCH | `/api/franchises/:franchiseId/status` | Update status |
| DELETE | `/api/franchises/:franchiseId` | Close franchise |

### Location Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/locations` | Create location |
| GET | `/api/locations` | List locations |
| GET | `/api/locations/:locationId` | Get location details |
| PATCH | `/api/locations/:locationId` | Update location |
| PATCH | `/api/locations/:locationId/status` | Update status |
| GET | `/api/locations/search/nearby` | Find nearby locations |
| GET | `/api/locations/:locationId/operating-hours` | Get operating hours |
| PATCH | `/api/locations/:locationId/operating-hours` | Update hours |

### Inventory Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/inventory` | Add inventory |
| GET | `/api/inventory` | List inventory |
| GET | `/api/inventory/:inventoryId` | Get inventory details |
| PATCH | `/api/inventory/:inventoryId` | Update inventory |
| POST | `/api/inventory/:inventoryId/sale` | Record sale |
| POST | `/api/inventory/:inventoryId/restock` | Restock |
| GET | `/api/inventory/reports/low-stock` | Low stock items |
| POST | `/api/inventory/transfer` | Create transfer |
| PATCH | `/api/inventory/transfer/:transferId` | Update transfer |
| GET | `/api/inventory/transfer/:transferId` | Get transfer |

### Analytics Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/franchise/:franchiseId` | Franchise analytics |
| GET | `/api/analytics/location/:locationId` | Location analytics |
| GET | `/api/analytics/inventory-summary` | Inventory summary |
| GET | `/api/analytics/top-locations` | Top locations |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations/health` | Service health status |

## Data Models

### Franchise

```javascript
{
  franchiseId: "FRN-12345678",
  name: "Pizza Palace Franchises",
  ownerId: "owner_001",
  businessType: "restaurant",
  branding: {
    logo: "https://example.com/logo.png",
    primaryColor: "#FF5733",
    tagline: "Taste the Difference"
  },
  contact: {
    email: "franchise@pizzapalace.com",
    phone: "+919876543210"
  },
  settings: {
    timezone: "Asia/Kolkata",
    currency: "INR"
  },
  status: "active"
}
```

### Location

```javascript
{
  locationId: "LOC-ABCDEF12",
  franchiseId: "FRN-12345678",
  name: "Pizza Palace - Downtown",
  code: "PP-DTN",
  type: "store",
  address: {
    street: "123 Main Street",
    city: "Bangalore",
    state: "Karnataka",
    postalCode: "560001",
    coordinates: {
      latitude: 12.9716,
      longitude: 77.5946
    }
  },
  contact: {
    managerName: "Ravi Kumar",
    phone: "+919876543211"
  },
  operatingHours: {
    monday: { open: "09:00", close: "21:00", closed: false },
    tuesday: { open: "09:00", close: "21:00", closed: false },
    // ...
  },
  status: "active",
  stats: {
    totalOrders: 15420,
    totalRevenue: 2450000,
    averageRating: 4.5,
    totalReviews: 892
  }
}
```

### LocationInventory

```javascript
{
  inventoryId: "INV-XYZ12345",
  locationId: "LOC-ABCDEF12",
  productId: "prod_001",
  franchiseId: "FRN-12345678",
  quantity: 150,
  minQuantity: 50,
  reorderPoint: 75,
  reorderQuantity: 100,
  status: "in_stock",
  movementHistory: [...]
}
```

## Usage Examples

### Create a Franchise

```bash
curl -X POST http://localhost:4062/api/franchises \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza Palace Franchises",
    "ownerId": "owner_001",
    "businessType": "restaurant",
    "branding": {
      "primaryColor": "#FF5733",
      "tagline": "Taste the Difference"
    }
  }'
```

### Create a Location

```bash
curl -X POST http://localhost:4062/api/locations \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "franchiseId": "FRN-12345678",
    "name": "Pizza Palace - Downtown",
    "code": "PP-DTN",
    "address": {
      "street": "123 Main Street",
      "city": "Bangalore",
      "coordinates": {
        "latitude": 12.9716,
        "longitude": 77.5946
      }
    }
  }'
```

### Add Inventory

```bash
curl -X POST http://localhost:4062/api/inventory \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "LOC-ABCDEF12",
    "productId": "prod_001",
    "productName": "Large Pizza Base",
    "quantity": 200,
    "minQuantity": 50,
    "reorderPoint": 75
  }'
```

### Create Inventory Transfer

```bash
curl -X POST http://localhost:4062/api/inventory/transfer \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "fromLocationId": "LOC-ABCDEF12",
    "toLocationId": "LOC-GHIJKL34",
    "items": [
      { "productId": "prod_001", "productName": "Large Pizza Base", "quantity": 50 }
    ],
    "initiatedBy": "manager_001",
    "expectedDelivery": "2026-05-15"
  }'
```

### Find Nearby Locations

```bash
curl "http://localhost:4062/api/locations/search/nearby?latitude=12.9716&longitude=77.5946&radiusKm=10" \
  -H "X-Internal-Token: your-token"
```

## Environment Variables

```bash
# Service
PORT=4062
MONGODB_URI=mongodb://localhost:27017/rez-multi-location
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Multi-location Settings
DEFAULT_TIMEZONE=Asia/Kolkata
MAX_LOCATIONS_PER_FRANCHISE=100
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-multi-location-service
npm install
cp .env.example .env
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  Order Service  │────▶│  Multi-location      │
└─────────────────┘     │     Service          │
                        └──────────┬───────────┘
                                   │
┌─────────────────┐     ┌──────────▼───────────┐
│  Inventory      │◀───▶│    Location DB       │
│  Management     │     └──────────────────────┘
└─────────────────┘
```

## Integration Points

| Service | Integration |
|---------|-------------|
| `rez-order-service` | Order routing |
| `REZ-inventory-sync` | Inventory sync |
| `REZ-notifications-service` | Low stock alerts |
| `REZ-engagement-platform` | Location-based offers |

## Related Services

- [Gift Card Service](./REZ-gift-card-service/) - Gift card management
- [Delivery Tracking Service](./REZ-delivery-tracking-service/) - Delivery management
- [Inventory Alerts Service](./REZ-inventory-alerts-service/) - Stock notifications
