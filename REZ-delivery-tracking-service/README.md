# Delivery Tracking Service

**Port:** 4060
**Purpose:** Real-time delivery tracking, GPS location, and ETA estimation

---

## Overview

The Delivery Tracking Service provides real-time tracking for deliveries and drivers. It handles:
- Driver registration and management
- Delivery creation and assignment
- GPS location tracking
- ETA calculation
- Delivery status management
- Location history and analytics

## Features

### Driver Management
- Driver registration with vehicle information
- Real-time GPS location updates
- Location history tracking
- Status management (available, busy, offline, on_break)
- Driver statistics and performance metrics

### Delivery Management
- Create deliveries with pickup and dropoff locations
- Automatic ETA calculation using Haversine formula
- Status transitions with validation
- Driver assignment
- Timeline tracking for all delivery events
- Nearby delivery search

### Real-time Tracking
- Live GPS coordinate updates
- Redis pub/sub for location broadcasts
- Distance-based calculations
- Proof of delivery tracking

## API Endpoints

### Delivery Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/delivery` | Create new delivery |
| GET | `/api/delivery` | List deliveries (filterable) |
| GET | `/api/delivery/:deliveryId` | Get delivery details |
| PATCH | `/api/delivery/:deliveryId/status` | Update status |
| PATCH | `/api/delivery/:deliveryId/assign` | Assign driver |
| PATCH | `/api/delivery/:deliveryId/eta` | Update ETA |
| GET | `/api/delivery/search/nearby` | Find nearby deliveries |
| GET | `/api/delivery/:deliveryId/timeline` | Get delivery timeline |
| DELETE | `/api/delivery/:deliveryId` | Cancel delivery |

### Driver Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/drivers` | Register new driver |
| GET | `/api/drivers` | List all drivers |
| GET | `/api/drivers/:driverId` | Get driver details |
| PATCH | `/api/drivers/:driverId/status` | Update driver status |
| POST | `/api/drivers/:driverId/location` | Update GPS location |
| GET | `/api/drivers/:driverId/location` | Get current location |
| GET | `/api/drivers/:driverId/location/history` | Location history |
| GET | `/api/drivers/:driverId/deliveries` | Driver's deliveries |
| GET | `/api/drivers/search/nearby` | Find nearby drivers |
| GET | `/api/drivers/:driverId/stats` | Driver statistics |
| DELETE | `/api/drivers/:driverId` | Remove driver |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery/health` | Service health status |

## Delivery Status Flow

```
pending -> assigned -> picked_up -> in_transit -> delivered
    |          |            |            |
    v          v            v            v
cancelled   cancelled    cancelled     failed
```

## Data Models

### Delivery

```javascript
{
  deliveryId: "DEL-12345678",
  orderId: "order_123",
  driverId: "DRV-ABCDEF12",
  status: "in_transit",
  pickup: {
    address: "123 Restaurant St",
    latitude: 12.9716,
    longitude: 77.5946
  },
  dropoff: {
    address: "456 Customer Ave",
    latitude: 12.9352,
    longitude: 77.6245,
    customerName: "John Doe",
    customerPhone: "+919876543210"
  },
  eta: {
    estimatedMinutes: 25,
    distanceMeters: 4500,
    calculatedAt: "2026-05-14T10:30:00Z"
  },
  currentLocation: {
    latitude: 12.9500,
    longitude: 77.6100,
    heading: 180,
    speed: 35
  },
  timeline: [...],
  metadata: {
    estimatedDeliveryTime: "2026-05-14T11:00:00Z",
    actualDeliveryTime: null
  }
}
```

### Driver

```javascript
{
  driverId: "DRV-ABCDEF12",
  name: "Rajesh Kumar",
  phone: "+919876543210",
  email: "rajesh@example.com",
  vehicle: {
    type: "bike",
    plateNumber: "KA-01-AB-1234",
    capacity: 5
  },
  status: "available",
  currentLocation: {
    latitude: 12.9716,
    longitude: 77.5946,
    heading: 90,
    speed: 0
  },
  stats: {
    totalDeliveries: 1542,
    completedToday: 12,
    averageRating: 4.8,
    totalDistanceKm: 8750
  }
}
```

## Usage Examples

### Create a Delivery

```bash
curl -X POST http://localhost:4060/api/delivery \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "pickup": {
      "address": "123 Restaurant St, Bangalore",
      "latitude": 12.9716,
      "longitude": 77.5946
    },
    "dropoff": {
      "address": "456 Customer Ave, Bangalore",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "customerName": "John Doe",
      "customerPhone": "+919876543210"
    }
  }'
```

### Update Driver Location

```bash
curl -X POST http://localhost:4060/api/drivers/DRV-ABCDEF12/location \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 12.9500,
    "longitude": 77.6100,
    "heading": 180,
    "speed": 35
  }'
```

### Find Nearby Drivers

```bash
curl "http://localhost:4060/api/drivers/search/nearby?latitude=12.9716&longitude=77.5946&radiusKm=5" \
  -H "X-Internal-Token: your-token"
```

### Assign Driver to Delivery

```bash
curl -X PATCH http://localhost:4060/api/delivery/DEL-12345678/assign \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV-ABCDEF12"}'
```

### Update Delivery Status

```bash
curl -X PATCH http://localhost:4060/api/delivery/DEL-12345678/status \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"status": "picked_up"}'
```

## Environment Variables

```bash
# Service
PORT=4060
MONGODB_URI=mongodb://localhost:27017/rez-delivery-tracking
REDIS_URL=redis://localhost:6379
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=your-internal-token

# Geo Settings
DEFAULT_ETA_MINUTES=30
MAX_GPS_HISTORY_HOURS=24
DISTANCE_THRESHOLD_METERS=50
```

## Quick Start

```bash
cd REZ-Intelligence/REZ-delivery-tracking-service
npm install
cp .env.example .env
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Order Service  │────▶│  Delivery Track │
└─────────────────┘     └────────┬────────┘
                                 │
┌─────────────────┐     ┌────────▼────────┐
│  Driver App     │────▶│  Redis Pub/Sub  │
└─────────────────┘     └─────────────────┘
```

## Integration Points

| Service | Integration |
|---------|-------------|
| `rez-order-service` | Order information |
| `REZ-notifications-service` | Status updates |
| `REZ-engagement-platform` | Customer notifications |
| `REZ-journey-service` | Delivery journeys |

## Related Services

- [Gift Card Service](./REZ-gift-card-service/) - Gift card management
- [Multi-location Service](./REZ-multi-location-service/) - Multi-store management
- [Inventory Alerts Service](./REZ-inventory-alerts-service/) - Stock notifications
