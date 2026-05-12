# REZ Salon Expert

A purpose-built salon expert agent for the REZ commerce platform, providing intelligent service recommendations, appointment booking, and beauty guidance.

## Features

- **Service Discovery**: Browse comprehensive menu of salon services by category
- **Appointment Booking**: Book appointments with preferred stylists and times
- **Service Information**: Detailed descriptions, pricing, duration, and what to expect
- **Skincare Recommendations**: Personalized advice based on skin type and concerns
- **Stylist Matching**: Find stylists specializing in your desired services
- **Availability Checking**: Real-time slot availability and scheduling
- **Preparation Guidance**: Expert tips for before and after your appointment
- **Allergy Management**: Track allergies and suggest allergen-free alternatives

## Architecture

```
rez-salon-expert/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── config/
│   │   ├── systemPrompt.ts         # Agent personality and behavior
│   │   └── knowledge.ts           # Services, skin types, treatments
│   ├── services/
│   │   └── salonExpert.ts         # Core salon expertise logic
│   ├── intents/
│   │   └── salonIntents.ts        # Intent recognition and entity extraction
│   └── routes/
│       └── salon.routes.ts         # API endpoints
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### Chat
```
POST /api/v1/salon/chat
```
Process salon-related messages and return intelligent responses.

### Services
```
GET  /api/v1/salon/services                    # List all services
GET  /api/v1/salon/services/:id               # Get service details
GET  /api/v1/salon/services/category/:cat    # Get services by category
```

### Categories
```
GET /api/v1/salon/categories                   # List all service categories
```

### Appointments
```
POST   /api/v1/salon/appointments             # Create appointment
GET    /api/v1/salon/appointments             # List appointments by client
GET    /api/v1/salon/appointments/:id        # Get appointment details
PATCH  /api/v1/salon/appointments/:id        # Update appointment
DELETE /api/v1/salon/appointments/:id        # Cancel appointment
```

### Stylists
```
GET /api/v1/salon/stylists                     # List all stylists
GET /api/v1/salon/stylists/:id               # Get stylist details
```

### Availability
```
GET /api/v1/salon/availability                # Check available time slots
```

### Recommendations
```
POST /api/v1/salon/recommend                  # Get service recommendations
```

### Reference Data
```
GET /api/v1/salon/skin-types                  # List skin types
```

## Service Categories

| Category | Description | Sample Services |
|----------|-------------|-----------------|
| Hair | Cuts, color, styling, treatments | Haircut, Balayage, Keratin Treatment |
| Nails | Manicures, pedicures, extensions | Gel Manicure, Acrylic Extensions, Nail Art |
| Skin Care | Facials, peels, treatments | HydraFacial, Chemical Peel, Microdermabrasion |
| Body & Spa | Massages, wraps, hair removal | Swedish Massage, Body Wrap, Brazilian Wax |
| Makeup | Application, lessons | Bridal Makeup, Special Occasion, Makeup Lesson |
| Brow & Lash | Shaping, tinting, extensions | Brow Shaping, Lash Lift, Eyelash Extensions |

## Skin Types

| Type | Characteristics | Common Concerns |
|------|-----------------|-----------------|
| Normal | Balanced, few imperfections | Maintaining balance |
| Dry | Tight, dull, flaky | Dehydration, sensitivity |
| Oily | Shiny, enlarged pores | Acne, excess shine |
| Combination | Oily T-zone, dry cheeks | Uneven texture |
| Sensitive | Easily irritated, redness | Redness, reactions |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3005 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |
| BOOKING_SERVICE_URL | Booking service URL | localhost:4008 |
| PAYMENT_SERVICE_URL | Payment service URL | localhost:4000 |

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

### Send a salon message
```bash
curl -X POST http://localhost:3005/api/v1/salon/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to book a facial for next week, something for acne-prone skin",
    "context": {
      "client": {
        "id": "client_123",
        "name": "Sarah Johnson",
        "email": "sarah@example.com",
        "skinType": "oily",
        "allergies": ["fragrance"],
        "tier": "premium"
      }
    }
  }'
```

### Get services by category
```bash
curl -X GET "http://localhost:3005/api/v1/salon/services?category=hair"
```

### Create an appointment
```bash
curl -X POST http://localhost:3005/api/v1/salon/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "classic-facial",
    "clientId": "client_123",
    "clientName": "Sarah Johnson",
    "dateTime": "2024-06-20T14:00:00Z"
  }'
```

### Check availability
```bash
curl -X GET "http://localhost:3005/api/v1/salon/availability?serviceId=classic-facial"
```

### Get recommendations
```bash
curl -X POST http://localhost:3005/api/v1/salon/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "skinType": "sensitive",
    "concern": "redness",
    "budget": 100
  }'
```

### List stylists
```bash
curl -X GET "http://localhost:3005/api/v1/salon/stylists?category=hair"
```

## Allergen Information

Common allergens in salon services:

| Service | Potential Allergens |
|---------|-------------------|
| Hair Color | Ammonia, PPD, Resorcinol |
| Keratin | Formaldehyde |
| Gel/Acrylic Nails | Methacrylate, HEMA |
| Facials | Various active ingredients |
| Waxing | Resin |
| Lash Extensions | Formaldehyde in glue |

Always inform your stylist of any allergies before treatment.

## License

Proprietary - REZ Commerce Platform
