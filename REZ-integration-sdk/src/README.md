# REZ Integration SDK - App Connector Templates

This directory contains connector templates for each app to integrate with REZ Intelligence.

## Quick Start

### 1. Install the SDK

```bash
npm install @rez/integration-sdk
```

### 2. Initialize

```javascript
const { REZIntegration } = require('@rez/integration-sdk');

const rez = new REZIntegration({
  appId: 'your-app-name',
  apiKey: process.env.REZ_API_KEY,
  baseUrl: process.env.REZ_API_URL || 'https://api.rez.money'
});

await rez.init({
  userId: currentUser.id,
  phone: currentUser.phone
});
```

### 3. Track Events

```javascript
// Track order
await rez.events.orderCompleted({
  orderId: order.id,
  merchantId: order.merchantId,
  amount: order.total
});

// Track QR scan
await rez.events.qrScan({
  merchantId: qr.merchantId
});

// Track page view
await rez.events.pageView({
  page: '/restaurant/123',
  category: 'restaurant'
});
```

### 4. Get Recommendations

```javascript
const recommendations = await rez.recommendations.get('user_123', {
  types: ['reorder', 'cross_sell'],
  limit: 5
});
```

### 5. Send Feedback

```javascript
await rez.feedback.conversion(nudgeId, {
  converted: true,
  orderId: order.id,
  amount: order.total
});
```

## App-Specific Connectors

### Hotel-OTA
Copy `connectors/hotel-ota.js` to your Hotel-OTA app:
```javascript
// Replace existing intentCaptureService
const REZConnector = require('./connectors/hotel-ota');
const rezConnector = new REZConnector(app);
```

### Rendez
Copy `connectors/rendez.js` to your Rendez app.

### AdBazaar
Copy `connectors/adbazaar.js` to your AdBazaar app.

### do-app
Copy `connectors/do-app.js` to your do-app.

## Environment Variables

```bash
REZ_API_URL=https://api.rez.money
REZ_API_KEY=your-api-key
```

## What Gets Connected

| Module | What It Does |
|--------|--------------|
| `events` | Tracks all user events |
| `identity` | Resolves cross-app user identity |
| `recommendations` | Gets AI-powered recommendations |
| `feedback` | Sends conversion attribution |

## Support

For questions, contact the REZ Intelligence team.
