# REZ Agent OS - Integration SDK

**Connect ALL apps to Agent OS in minutes.**

---

## SUPPORTED APPS

| App | Client | Purpose |
|-----|--------|---------|
| do-app | DOAppClient | DO services booking |
| Hotel OTA | HotelOTAClient | Hotel bookings |
| AdBazaar | AdBazaarClient | Ad tracking |
| Rendez | RendezClient | Dating app |
| Merchant | MerchantClient | Merchant app |

---

## INSTALLATION

```bash
npm install
npm run build
```

---

## USAGE

### 1. DO App

```javascript
import { DOAppClient } from '@rez/agent-os-sdk';

const doApp = new DOAppClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

// Track booking
await doApp.trackBooking({
  bookingId: 'BK123',
  serviceType: 'salon',
  provider: 'provider_456',
  amount: 500
});

// Get recommendations
const recs = await doApp.getDORecommendations({
  location: { lat: 12.97, lng: 77.59 }
});

// Chat
const response = await doApp.chat('Book a massage near me');
```

### 2. Hotel OTA

```javascript
import { HotelOTAClient } from '@rez/agent-os-sdk';

const hotel = new HotelOTAClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

// Track booking
await hotel.trackBooking({
  hotelId: 'HTL456',
  checkIn: '2024-06-01',
  checkOut: '2024-06-05',
  rooms: 2,
  amount: 15000
});

// Get recommendations
const recs = await hotel.getHotelRecommendations(
  { lat: 12.97, lng: 77.59 },
  { checkIn: '2024-06-01', checkOut: '2024-06-05' }
);

// Track search
await hotel.trackSearch({
  location: 'Bangalore',
  guests: 2,
  checkIn: '2024-06-01'
});
```

### 3. AdBazaar

```javascript
import { AdBazaarClient } from '@rez/agent-os-sdk';

const ads = new AdBazaarClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

// Track impression
await ads.trackImpression('AD123', 'CAMP456');

// Track click
await ads.trackClick('AD123', 'CAMP456');

// Track conversion
await ads.trackConversion('AD123', 'ORDER789', 1000);

// Get targeting data
const targeting = await ads.getTargetingData('user123');
// Returns: { interests, location, segment }
```

### 4. Rendez

```javascript
import { RendezClient } from '@rez/agent-os-sdk';

const rendez = new RendezClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

// Track profile view
await rendez.trackProfileView('profile_456');

// Track match
await rendez.trackMatch('match_789', 'profile_456');

// Track message
await rendez.trackMessage('conv_101');

// Get recommendations
const recs = await rendez.getDatingRecommendations();
```

### 5. Merchant App

```javascript
import { MerchantClient } from '@rez/agent-os-sdk';

const merchant = new MerchantClient({
  userId: 'merchant_123',
  baseUrl: 'http://localhost:4100'
});

// Track sale
await merchant.trackSale({
  orderId: 'ORD123',
  amount: 2500,
  items: ['item1', 'item2']
});

// Get insights
const insights = await merchant.getInsights('merchant_123');

// Get inventory alerts
const alerts = await merchant.getInventoryAlerts('merchant_123');
```

---

## REACT NATIVE HOOKS

```javascript
import { AgentOSProvider, useAgentOS, useHotelOTA, useDOApp } from '@rez/agent-os-sdk';

// Wrap app
<AgentOSProvider config={{ userId: 'user123' }}>
  <App />
</AgentOSProvider>

// Use in component
const { chat, messages, isTyping } = useAgentOS({ userId: 'user123' });

// Chat
await chat('Book a table for 2');
```

---

## CHAT WIDGET

```javascript
import { AgentOSChatWidget } from '@rez/agent-os-sdk';

<AgentOSChatWidget
  messages={messages}
  onSend={chat}
  isTyping={isTyping}
  theme="dark"
/>
```

---

## API ENDPOINTS

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/message | Send message |
| POST | /api/track | Track event |
| GET | /api/recommend | Get recommendations |
| GET | /api/context/:userId | Get user context |
| POST | /api/credit/score | Credit score |
| POST | /api/credit/bnpl | BNPL calculation |

---

## WEBSOCKET

```javascript
// Connect
const client = new AgentOSClient({ userId: 'user123' });
await client.connect('user123');

// Send message
client.sendMessage('Hello');

// Receive
client.onMessage = (msg) => {
  console.log('Message:', msg);
};
```

---

## ENVIRONMENT VARIABLES

```bash
AGENT_OS_URL=http://localhost:4100
AGENT_OS_API_KEY=your-api-key
```

---

## BUILD

```bash
npm install
npm run build
```

---

## FILES

```
REZ-integration-sdk/
├── src/
│ ├── agentOSClient.js      # Main client
│ ├── ReactHooks.js         # React hooks
│ ├── integrations/         # App-specific
│ │ ├── do-app.js
│ │ ├── hotel-ota.js
│ │ ├── adbazaar.js
│ │ ├── rendez.js
│ │ └── merchant.js
│ └── examples/
│     ├── do-app-example.js
│     ├── hotel-example.js
│     └── merchant-example.js
├── package.json
└── README.md
```
