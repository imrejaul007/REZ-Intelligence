# REZ Intelligence - Integration Guide

## Quick Start

### 1. Install Connector

Copy the connector file to your app:

```bash
# Hotel-OTA
cp REZ-Intelligence/app-connectors/hotel-ota.js Hotel-OTA/services/REZConnector.js

# Rendez
cp REZ-Intelligence/app-connectors/rendez.js Rendez/services/REZConnector.js

# AdBazaar
cp REZ-Intelligence/app-connectors/adbazaar.js AdBazaar/services/REZConnector.js
```

### 2. Initialize

```javascript
const { REZHotelConnector } = require('./services/REZConnector');

// Initialize with user
const rez = new REZHotelConnector({
  baseUrl: process.env.REZ_API_URL,
  apiKey: process.env.REZ_API_KEY
});

await rez.init({ id: user.id, phone: user.phone, email: user.email });
```

### 3. Track Events

```javascript
// Track booking
await rez.trackBookingConfirmed({
  id: booking.id,
  hotelId: hotel.id,
  paymentMethod: 'card',
  total: 5000
});

// Track search
await rez.trackSearch({
  query: 'Mumbai hotels',
  location: 'Mumbai',
  resultCount: 25
});
```

### 4. Get Recommendations

```javascript
const recs = await rez.getRecommendations({ types: 'personalized', limit: 5 });
// Returns: [{ itemId, name, score, reason }, ...]
```

### 5. Track Conversions

```javascript
// When user converts from a nudge
await rez.trackConversion(nudgeId, orderId, orderAmount);
```

---

## App Connectors

### Hotel-OTA

```javascript
const { REZHotelConnector } = require('./services/REZConnector');

const rez = new REZHotelConnector();

// Track events
await rez.trackBookingStarted(booking);
await rez.trackBookingConfirmed(booking);
await rez.trackCheckin(booking);
await rez.trackCheckout(booking);
await rez.trackRoomService(order);
await rez.trackSearch(search);
await rez.trackHotelView(hotel);

// Get recommendations
const recs = await rez.getRecommendations({ types: 'personalized,trending' });

// Track conversion
await rez.trackConversion(nudgeId, orderId, amount);
```

### Rendez

```javascript
const { REZRendezConnector } = require('./services/REZConnector');

const rez = new REZRendezConnector();

await rez.trackMatch(match);
await rez.trackMessage(message);
await rez.trackMeetupScheduled(meetup);
await rez.trackMeetupCompleted(meetup);
await rez.trackGiftSent(gift);
await rez.trackSearch(search);

const recs = await rez.getRecommendations();
```

### AdBazaar

```javascript
const { REZAdBazaarConnector } = require('./services/REZConnector');

const rez = new REZAdBazaarConnector();

await rez.trackCampaignCreated(campaign);
await rez.trackAdImpression(impression);
await rez.trackAdClick(click);
await rez.trackAdConversion(conversion);
await rez.trackCreatorSignup(creator);
await rez.trackContentPosted(content);

const targeting = await rez.getTargetingRecommendations({ limit: 20 });
```

---

## Events Tracked

### Discovery Events
- `qr_scan` - User scanned QR code
- `page_view` - User viewed a page
- `search` - User searched

### Transaction Events
- `order_completed` - Order placed
- `payment_completed` - Payment successful
- `booking_confirmed` - Booking confirmed

### Engagement Events
- `item_view` - User viewed item
- `add_to_cart` - Item added to cart

### Notification Events
- `nudge_sent` - Reorder notification sent
- `nudge_clicked` - User clicked notification
- `nudge_converted` - User ordered after notification

---

## API Endpoints

### Event Tracking
```
POST /api/events/track
{
  eventType: "order_completed",
  userId: "user_123",
  appId: "hotel-ota",
  properties: { orderId: "ord_456", amount: 5000 },
  timestamp: "2024-01-15T10:30:00Z"
}
```

### Identity Resolution
```
POST /resolve
{
  phone: "+919876543210",
  sourceApp: "hotel-ota",
  sourceUserId: "hotel_user_123"
}

Response:
{
  unifiedId: "uid_abc123",
  confidence: 0.95,
  linkedAccounts: [
    { appId: "consumer", userId: "consumer_user_456" },
    { appId: "hotel-ota", userId: "hotel_user_123" }
  ]
}
```

### Recommendations
```
GET /api/recommendations/:userId?types=reorder,personalized&limit=10

Response:
{
  recommendations: [
    {
      type: "reorder",
      items: [
        { itemId: "item_1", name: "Biryani", score: 0.92, reason: "Ordered 5 times" }
      ]
    }
  ]
}
```

### Conversion Feedback
```
POST /api/feedback/conversion
{
  nudgeId: "nudge_123",
  userId: "user_456",
  appId: "hotel-ota",
  converted: true,
  orderId: "ord_789",
  amount: 5000
}
```

---

## Configuration

### Environment Variables

```bash
# API URL (defaults to localhost for dev)
REZ_API_URL=http://localhost:4091

# API Key (get from admin)
REZ_API_KEY=your-api-key

# Service Token (for internal services)
INTERNAL_SERVICE_TOKEN=your-internal-token
```

### Express Middleware

```javascript
const { rezMiddleware } = require('./services/REZConnector');

// Apply to all routes
app.use(rezMiddleware);

// Or specific routes
app.post('/booking', rezMiddleware, bookingController);
```

---

## Error Handling

```javascript
try {
  await rez.trackBookingConfirmed(booking);
} catch (err) {
  // Log but don't break the flow
  console.error('REZ tracking failed:', err.message);
}
```

All methods are fire-and-forget. Failures are logged but don't throw.

---

## Testing

```javascript
// Test locally
const rez = new REZHotelConnector({
  baseUrl: 'http://localhost:4091',
  debug: true
});

// Check if service is running
curl http://localhost:4091/health
```

---

## Troubleshooting

### "Connection refused"
- Make sure REZ services are running: `./start.sh`
- Check health: `curl http://localhost:4095/health/all`

### "Unauthorized"
- Set `REZ_API_KEY` environment variable
- Get key from admin panel

### "Identity not found"
- User needs to have phone or email
- Check if `init()` was called with user data

---

## Support

For issues, contact the REZ Intelligence team.
