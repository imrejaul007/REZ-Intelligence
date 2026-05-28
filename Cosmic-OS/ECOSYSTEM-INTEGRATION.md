# Cosmic OS - Ecosystem Integration Guide

**Connecting Cosmic OS to the REZ Ecosystem**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COSMIC OS MOBILE APP                               │
│                         (Expo/React Native)                                 │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COSMIC OS BACKEND (Port 4163)                     │
│              AI Council | Mood Tracking | Cosmic Context                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Built ON: RABTUL Platform                                                 │
│  ├── Auth Service (OTP/JWT)                                                │
│  ├── Wallet Service (Coins)                                                │
│  ├── Notification Service (Push)                                            │
│  ├── Gamification (Streaks)                                               │
│  └── Prive (Premium Loyalty)                                              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ Internal
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ HUMAN CONTEXT GRAPH (Port 4162)                       │
│              Unified 15-Layer Context Aggregation                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer Sources:                                                           │
│  ├── RisaCare (Health)                                                    │
│  ├── REZ Consumer (Commerce)                                              │
│  ├── CorpPerks (Career)                                                   │
│  ├── ReZ Ride (Mobility)                                                  │
│  └── More...                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   REZ           │   │   REZ           │   │   REZ           │
│   Emotional     │   │   Life          │   │   Signal        │
│   Intelligence  │   │   Patterns      │   │   Aggregator    │
│   (Port 4160)  │   │   (Port 4161)  │   │   (Port 4142)  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Integration with Life Layers

### 1. Health Layer (RisaCare)

```typescript
// Connect wellness data from RisaCare
interface RisaCareSignals {
  sleepQuality: number;
  stressLevel: number;
  fitnessActivity: string;
  wellnessGoals: string[];
}

// Integration: Update cosmic context with wellness signals
await collectLayerSignal({
  userId: 'user_123',
  layer: 'health',
  signal: 'wellness_score',
  value: risacareData.wellnessScore,
  source: 'risacare',
  confidence: 0.9
});
```

### 2. Commerce Layer (REZ Consumer)

```typescript
// Connect shopping behavior
interface CommerceSignals {
  spendingLevel: number;
  categoryAffinities: Record<string, number>;
  diningPreferences: string[];
  purchaseFrequency: number;
}

// Integration: Track consumption patterns
await collectLayerSignal({
  userId: 'user_123',
  layer: 'commerce',
  signal: 'spending_pattern',
  value: consumerData.spendingLevel,
  source: 'rez-consumer',
  confidence: 0.8
});
```

### 3. Career Layer (CorpPerks)

```typescript
// Connect career signals
interface CareerSignals {
  burnoutRisk: number;
  productivity: number;
  workSatisfaction: number;
  careerStage: string;
}

// Integration: Track career health
await collectLayerSignal({
  userId: 'user_123',
  layer: 'career',
  signal: 'burnout_risk',
  value: corpperksData.burnoutRisk,
  source: 'corpperks',
  confidence: 0.75
});
```

### 4. Mobility Layer (ReZ Ride)

```typescript
// Connect movement patterns
interface MobilitySignals {
  travelFrequency: number;
  commutePattern: string;
  explorationLevel: number;
  frequentDestinations: string[];
}

// Integration: Track exploration energy
await collectLayerSignal({
  userId: 'user_123',
  layer: 'mobility',
  signal: 'travel_frequency',
  value: rideData.travelFrequency,
  source: 'rez-ride',
  confidence: 0.85
});
```

### 5. Karma Layer (REZ Media)

```typescript
// Connect social impact
interface KarmaSignals {
  karmaScore: number;
  generosityLevel: number;
  communityEngagement: number;
}

// Integration: Track giving behavior
await collectLayerSignal({
  userId: 'user_123',
  layer: 'karma',
  signal: 'karma_score',
  value: karmaData.karmaScore,
  source: 'rez-media',
  confidence: 0.9
});
```

---

## API Integration Examples

### Frontend (Mobile App)

```typescript
// Using the Cosmic OS SDK
import { CosmicOS } from '@cosmic/sdk';

const cosmic = new CosmicOS({
  apiKey: 'your-api-key',
  baseUrl: 'https://cosmic-api.rez.money'
});

// Check in mood
const result = await cosmic.mood.checkIn({
  mood: 'peaceful',
  energy: 4
});

// Get cosmic context
const context = await cosmic.context.get();

// Consult AI Council
const council = await cosmic.council.consult(['mystic', 'healer']);
```

### Backend (Service Integration)

```typescript
// Node.js service integration
import axios from 'axios';

const COSMIC_API = 'https://cosmic-api.rez.money';
const INTERNAL_TOKEN = process.env.COSMIC_OS_TOKEN;

// Emit wellness signal
async function emitWellnessSignal(userId: string, data: any) {
  await axios.post(`${COSMIC_API}/api/signals`, {
    userId,
    layer: 'health',
    signal: 'wellness_update',
    value: data,
    source: 'risacare'
  }, {
    headers: { 'X-Internal-Token': INTERNAL_TOKEN }
  });
}
```

---

## Privacy & Trust Layer

Cosmic OS NEVER surfaces raw data:

| Instead of... | We say... |
|--------------|-----------|
| "You traveled 4 times" | "Fresh environments may inspire" |
| "You spent ₹50,000" | "Abundance flows when aligned" |
| "You slept 5 hours" | "Rest supports your energy" |
| "You argued with partner" | "Relationships need nurturing" |

---

## Event Flow

```
1. User opens Cosmic OS app
   ↓
2. App requests cosmic context (with RABTUL auth)
   ↓
3. Cosmic OS fetches from:
   ├── Human Context Graph (15 layers)
   ├── Emotional Intelligence (mood)
   ├── Life Patterns (routines)
   └── RABTUL (wallet, streak, profile)
   ↓
4. Cosmic OS generates:
   ├── AI Council insights
   ├── Daily reading
   ├── Symbolic interpretations
   └── Privacy-safe abstractions
   ↓
5. App displays cosmic UI with rewards
   ↓
6. User mood check-in → RABTUL wallet coins
```

---

## Environment Variables for Production

```bash
# Cosmic OS Service
COSMIC_OS_URL=https://cosmic-api.rez.money
COSMIC_OS_TOKEN=xxx-xxx-xxx

# RABTUL Services
RABTUL_AUTH_URL=https://rez-auth-service.onrender.com
RABTUL_WALLET_URL=https://rez-wallet-service-36vo.onrender.com
RABTUL_NOTIFICATION_URL=https://rez-notifications-service.onrender.com

# REZ Intelligence
EMOTIONAL_SERVICE_URL=http://emotional-intelligence:4160
HUMAN_CONTEXT_URL=http://human-context-graph:4162

# MongoDB
MONGODB_URI=mongodb://cosmic-mongo:27017/cosmic_os
```

---

## Service URLs (Production)

| Service | URL |
|---------|-----|
| Cosmic OS API | `https://cosmic-api.rez.money` |
| RABTUL Auth | `https://rez-auth-service.onrender.com` |
| RABTUL Wallet | `https://rez-wallet-service-36vo.onrender.com` |
| RABTUL Notifications | `https://rez-notifications-service.onrender.com` |

---

## License

Proprietary - RTNM Group
