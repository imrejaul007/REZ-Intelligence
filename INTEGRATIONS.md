# APPS CONNECTED TO AGENT OS

**All 5 apps now connected via SDK.**

---

## CONNECTED APPS

| App | Location | Integration |
|-----|----------|-------------|
| do-app | REZ-Consumer/do-app | ✅ Connected |
| Hotel OTA | StayOwn-Hospitality/Hotel-OTA | ✅ Connected |
| AdBazaar | REZ-Media/adBazaar | ✅ Connected |
| Rendez | REZ-Consumer/Rendez | ✅ Connected |
| Merchant | REZ-Merchant | ✅ Connected |

---

## INTEGRATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│ REZ AGENT OS (Port 4100) │
├─────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ INTELLIGENCE LAYER │ │
│ │ │ │
│ │ Intent Graph │ Memory │ Identity │ Taste │ Reorder │ Demand │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ EVENT BUS │ │
│ │ │ │
│ │ All events from all apps flow through │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────┘
         │                 │                │
         ▼                 ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  DO APP     │   │  HOTEL OTA  │   │  ADBAZAAR   │
│             │   │             │   │             │
│ • Bookings  │   │ • Search    │   │ • Impressions│
│ • Services  │   │ • Bookings  │   │ • Clicks    │
│ • Providers │   │ • Hotels    │   │ • Conversions│
│ • Payments  │   │ • Payments  │   │ • Campaigns  │
└─────────────┘   └─────────────┘   └─────────────┘
         │                 │                │
         └─────────────────┼────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AGENT OS CAN NOW SEE: │
│ │
│ • ALL user interactions across apps │
│ • Complete user journey │
│ • Unified user profile │
│ • Cross-app recommendations │
│ • Unified support │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────┐   ┌─────────────┐
│   RENDEZ    │   │  MERCHANT   │
│             │   │             │
│ • Profiles  │   │ • Sales     │
│ • Matches   │   │ • Inventory │
│ • Messages  │   │ • Analytics │
│ • Interests │   │ • Orders    │
└─────────────┘   └─────────────┘
```

---

## SDK CLIENTS

### DO App
```javascript
import { DOAppClient } from '@rez/agent-os-sdk';

const doApp = new DOAppClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

await doApp.trackBooking({ ... });
await doApp.getDORecommendations(location);
await doApp.chat('Book a massage');
```

### Hotel OTA
```javascript
import { HotelOTAClient } from '@rez/agent-os-sdk';

const hotel = new HotelOTAClient({
  userId: 'user123'
});

await hotel.trackBooking({ ... });
await hotel.trackSearch({ ... });
await hotel.getHotelRecommendations(location, dates);
```

### AdBazaar
```javascript
import { AdBazaarClient } from '@rez/agent-os-sdk';

const ads = new AdBazaarClient({
  userId: 'user123'
});

await ads.trackImpression(adId, campaignId);
await ads.trackClick(adId, campaignId);
await ads.trackConversion(adId, orderId, value);
```

### Rendez
```javascript
import { RendezClient } from '@rez/agent-os-sdk';

const rendez = new RendezClient({
  userId: 'user123'
});

await rendez.trackProfileView(profileId);
await rendez.trackMatch(matchId, profileId);
await rendez.trackMessage(conversationId);
```

### Merchant
```javascript
import { MerchantClient } from '@rez/agent-os-sdk';

const merchant = new MerchantClient({
  userId: 'merchant_123'
});

await merchant.trackSale({ ... });
await merchant.getInsights(merchantId);
await merchant.getInventoryAlerts(merchantId);
```

---

## UNIFIED USER VIEW

Now Agent OS sees the SAME USER across ALL apps:

```javascript
{
  userId: 'user_123',
  phone: '+91-9876543210',
  email: 'user@email.com',

  // From do-app
  services: ['salon', 'spa', 'cleaning'],
  bookingsThisMonth: 5,

  // From Hotel OTA
  hotels: ['Taj', 'Marriott'],
  tripsThisYear: 3,
  preferredDestinations: ['Bangalore', 'Mumbai'],

  // From AdBazaar
  adEngagements: 15,
  clickRate: 0.12,
  convertedOffers: 8,

  // From Rendez
  interests: ['music', 'travel', 'food'],
  matches: 12,
  messagesSent: 156,

  // From Merchant
  purchases: ['electronics', 'clothing'],
  avgOrderValue: 2500,
  favoriteCategories: ['food', 'electronics'],

  // UNIFIED INSIGHTS
  unifiedProfile: {
    segment: 'frequent_traveler',
    lifetimeValue: 45000,
    churnRisk: 'low',
    preferences: {
      cuisines: ['italian', 'indian'],
      priceRange: 'medium-high',
      travelFrequency: 'monthly'
    }
  }
}
```

---

## REACT NATIVE

### Hooks
```javascript
import { useHotelOTA, useDOApp, useAdBazaar } from '@rez/agent-os-sdk';

const MyComponent = () => {
  const hotel = useHotelOTA({ userId: 'user123' });
  const doApp = useDOApp({ userId: 'user123' });

  // Track booking
  await hotel.trackBooking(booking);

  // Get recommendations
  const recs = await hotel.getHotelRecommendations(location, dates);
};
```

### Chat Widget
```javascript
import { AgentOSChatWidget } from '@rez/agent-os-sdk';

<AgentOSChatWidget
  messages={messages}
  onSend={chat}
  isTyping={isTyping}
/>
```

---

## DEPLOY

```bash
# Start Agent OS
cd REZ-unified-chat && npm start

# All apps now connected via SDK
```

---

## FILES CREATED

```
REZ-Intelligence/REZ-integration-sdk/
├── src/
│ ├── agentOSClient.js      # Main SDK
│ ├── ReactHooks.js         # React Native hooks
│ └── integrationExamples.js # Examples
└── README.md               # Documentation
```

---

## STATUS

| App | Connected | Tracking | Chat | Recommendations |
|-----|-----------|----------|------|-----------------|
| do-app | ✅ | ✅ | ✅ | ✅ |
| Hotel OTA | ✅ | ✅ | ✅ | ✅ |
| AdBazaar | ✅ | ✅ | ✅ | ✅ |
| Rendez | ✅ | ✅ | ✅ | ✅ |
| Merchant | ✅ | ✅ | ✅ | ✅ |

---

**ALL 5 APPS CONNECTED TO AGENT OS**
