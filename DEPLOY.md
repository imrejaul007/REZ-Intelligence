# REZ AGENT OS v3.0 - COMPLETE DEPLOYMENT

---

## WHAT WAS BUILT

| System | Status | Location |
|--------|--------|----------|
| **Agent OS v3.0** | DONE | REZ-unified-chat |
| **Universal User Graph** | DONE | REZ-universal-user-graph |
| **Voice Integration** | DONE | Agent OS |
| **Credit Engine** | DONE | Agent OS |
| **POS Integration** | DONE | Agent OS |
| **ML Models** | EXISTS | rez-ml-models |
| **Data Warehouse** | DONE | REZ-data-warehouse |
| **A/B Testing** | DONE | REZ-ab-testing |
| **ML Feature Store** | EXISTS | rez-ml-feature-store |
| **ML Model Registry** | EXISTS | rez-ml-model-registry |

---

## SERVICES TO DEPLOY

### Priority 1: Core Agent OS
```bash
cd REZ-Intelligence/REZ-unified-chat
npm install
cp .env.example .env
npm start
# Port: 4100
```

### Priority 2: Universal User Graph
```bash
cd REZ-Intelligence/REZ-universal-user-graph
npm install
cp .env.example .env
npm start
# Port: 4101
```

### Priority 3: Data Warehouse
```bash
cd REZ-Intelligence/REZ-data-warehouse
npm install
cp .env.example .env
npm start
# Port: 4105
```

### Priority 4: A/B Testing
```bash
cd REZ-Intelligence/REZ-ab-testing
npm install
cp .env.example .env
npm start
# Port: 4110
```

---

## EXISTING SERVICES

### ML Services (Already Built)
```bash
cd REZ-Intelligence/rez-ml-models/reorder_predictor
pip install -r requirements.txt
python api.py
# Port: 4040

cd REZ-Intelligence/rez-ml-models/taste_profiler
pip install -r requirements.txt
python api.py
# Port: 4041
```

### Intelligence Services (Already Built)
```bash
cd REZ-Intelligence/REZ-autonomous-agents
npm install && npm start
# Port: 4062

cd REZ-Intelligence/REZ-support-copilot
npm install && npm start
# Port: 4033
```

---

## ENVIRONMENT VARIABLES

Create `.env` for each service:

### Agent OS
```bash
PORT=4100

# Intelligence
REZ_INTENT_URL=http://localhost:4050
REZ_MEMORY_URL=http://localhost:4051
REZ_IDENTITY_URL=http://localhost:4050
REZ_TASTE_URL=http://localhost:4041
REZ_REORDER_URL=http://localhost:4040
REZ_DEMAND_URL=http://localhost:4042
REZ_AGENTS_URL=http://localhost:4062
REZ_EVENTS_URL=http://localhost:4008
REZ_CDP_URL=http://localhost:3005

# Business
ORDER_URL=https://rez-order.onrender.com
BOOKING_URL=https://rez-booking.onrender.com
WALLET_URL=https://rez-wallet.onrender.com
SUPPORT_URL=http://localhost:4033

# Voice
OPENAI_API_KEY=sk-...
ELEVEN_LABS_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

### Universal User Graph
```bash
PORT=4101
MONGODB_URI=mongodb://localhost:27017/rez-user-graph

# Connected services
INTENT_GRAPH_URL=http://localhost:4050
CDP_URL=http://localhost:3005
```

### Data Warehouse
```bash
PORT=4105
MONGODB_URI=mongodb://localhost:27017/rez-warehouse
EVENTS_URL=http://localhost:4008
```

### A/B Testing
```bash
PORT=4110
MONGODB_URI=mongodb://localhost:27017/rez-ab-testing
```

---

## CONNECTIONS DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ REZ AGENT OS v3.0 (Port 4100) │
├─────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ VOICE │ │ CREDIT │ │ POS │ │
│ │ Integration│ │ Engine │ │ Integration│ │
│ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ │
│ └─────────────┴─────────────┴─────────────┘ │
│ │
│ ┌─────────────────────────────────────────────┐ │
│ │ INTELLIGENCE LAYER │ │
│ │ │ │
│ │ Intent Graph ──── Memory Engine ─── Identity │
│ │ Taste Profile ─── Reorder Engine ─── Demand │
│ │ Event Platform ── CDP ──── Agents │ │
│ └─────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────┐ │
│ │ SUPPORT COPILOT (Child) │ │
│ │ Refunds, Complaints, Issues, Technical │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐     ┌─────────────────────┐
│ UNIVERSAL USER GRAPH │     │ DATA WAREHOUSE │     │
│ (Port 4101) │     │ (Port 4105) │     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ A/B TESTING │     │ ML MODELS │
│ (Port 4110) │     │ (Ports 4040-4042)│
└─────────────────────┘     └─────────────────────┘
```

---

## API ENDPOINTS

### Agent OS (Port 4100)
```bash
# Chat
POST /api/message

# Voice
POST /api/voice/transcribe
POST /api/voice/synthesize

# Credit
POST /api/credit/score
POST /api/credit/lending
POST /api/credit/bnpl

# POS
POST /api/pos/order
GET  /api/pos/inventory/:merchantId
GET  /api/pos/analytics/:merchantId
```

### Universal User Graph (Port 4101)
```bash
GET  /api/v1/users/:userId
POST /api/v1/users
PUT  /api/v1/users/:userId
POST /api/v1/users/:userId/link
POST /api/v1/identity/resolve
```

### Data Warehouse (Port 4105)
```bash
GET  /api/metrics/daily
GET  /api/users/:userId/aggregations
GET  /api/merchants/:merchantId/aggregations
POST /api/etl/run
```

### A/B Testing (Port 4110)
```bash
POST /api/experiments
GET  /api/experiments
GET  /api/experiments/:id
POST /api/experiments/:id/start
POST /api/experiments/:id/stop
GET  /api/experiments/:id/variant?userId=xxx
POST /api/conversions
```

---

## WEBSOCKET

```javascript
// Connect to Agent OS
const ws = new WebSocket('ws://localhost:4100/ws?userId=user123&namespace=chat');

// Send message
ws.send(JSON.stringify({ message: 'Book a table for 2' }));

// Receive
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log(data.message);
};
```

---

## SUPPORT COPILOT CONNECTIONS

### Already Connected
- Order Service
- Booking Service
- Search Service
- Knowledge Base
- Wallet Service
- Event Platform

### Need Connection
- do-app
- Hotel OTA
- AdBazaar
- Rendez
- Merchant Dashboard
- POS Systems

---

## QUICK START

```bash
# 1. Deploy Agent OS
cd REZ-Intelligence/REZ-unified-chat
npm install && npm start

# 2. Deploy Universal User Graph
cd ../REZ-universal-user-graph
npm install && npm start

# 3. Deploy Data Warehouse
cd ../REZ-data-warehouse
npm install && npm start

# 4. Deploy A/B Testing
cd ../REZ-ab-testing
npm install && npm start
```

---

## RENDER DEPLOYMENT

Create `render.yaml` for each service:

```yaml
services:
  - type: web
    name: rez-agent-os
    env: node
    region: singapore
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: 4100
      - key: MONGODB_URI
        sync: false
      - key: REZ_INTENT_URL
        sync: false
```

---

## TEST

```bash
# Test Agent OS
curl -X POST http://localhost:4100/api/message \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","message":"Book a table for 2 at 8pm"}'

# Test Credit Score
curl -X POST http://localhost:4100/api/credit/score \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123"}'

# Test Voice
curl -X POST http://localhost:4100/api/voice/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio":"base64audio","provider":"openai"}'
```

---

## MONITORING

### Health Checks
```bash
curl http://localhost:4100/health
curl http://localhost:4101/health
curl http://localhost:4105/health
curl http://localhost:4110/health
```

### Logs
```bash
# View logs
tail -f /var/log/rez-agent-os.log

# Metrics
curl http://localhost:4100/metrics
```

---

## WHAT'S COMPLETE

| Layer | Status |
|-------|--------|
| Agent OS | DONE |
| Voice | DONE |
| Credit Engine | DONE |
| POS Integration | DONE |
| Universal User Graph | DONE |
| Data Warehouse | DONE |
| A/B Testing | DONE |
| ML Models | EXISTS |
| Support Copilot | EXISTS |

---

## WHAT'S NEXT

1. Deploy all services
2. Connect Support Copilot to all apps
3. Connect POS to merchants
4. Train ML models
5. Set up monitoring
6. Production testing

---

*REZ Agent OS - Complete.*
