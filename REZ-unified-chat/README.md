# REZ AGENT OS v3.0 - FULLY CONNECTED

**ALL SYSTEMS CONNECTED.**

---

## CONNECTED SYSTEMS

| System | Integration |
|---------|--------------|
| **Voice** | STT, TTS, Twilio, Daily.co |
| **Credit** | Credit scoring, BNPL, Lending |
| **POS** | Inventory, Orders, Analytics |
| **Intelligence** | All ML services |
| **Support** | All apps |
| **Wallet** | Balance, Transactions |

---

## VOICE CONNECTIONS

```
┌─────────────────────────────────────┐
│ VOICE INPUT                          │
│                                      │
│ Speech Recognition ──► STT            │
│ AI Processing ────────► Agent OS      │
│                                             │
│ Voice Output ────────► TTS            │
│ Phone Calls ─────────► Twilio       │
│ Video Calls ───────► Daily.co      │
└─────────────────────────────────────┘
```

### Voice Features
- Speech-to-Text (STT)
- Text-to-Speech (TTS)
- Phone integration (Twilio)
- Video integration (Daily.co)

---

## CREDIT CONNECTIONS

```
┌─────────────────────────────────────┐
│ CREDIT & FINANCIAL                    │
│                                      │
│ User Score ───────► Credit Engine    │
│ Payment History ──► Risk Assessment │
│ BNPL ───────────► Installment Calc  │
│ Lending ────────► Approval Engine  │
└─────────────────────────────────────┘
```

### Credit Features
- Credit scoring (0-1000)
- BNPL calculations
- Risk assessment
- Lending recommendations

---

## POS CONNECTIONS

```
┌─────────────────────────────────────┐
│ MERCHANT POS                          │
│                                      │
│ Inventory ──────► Real-time sync    │
│ Orders ────────► Processing       │
│ Analytics ─────► Dashboard         │
│ Employees ────► Scheduling       │
└─────────────────────────────────────┘
```

### POS Features
- Inventory management
- Order processing
- Merchant analytics
- Employee management

---

## INTELLIGENCE CONNECTIONS

```
┌─────────────────────────────────────┐
│ INTELLIGENCE LAYER                    │
│                                      │
│ Intent Graph ───────► Understanding │
│ Memory Engine ────► Context        │
│ Identity Graph ──► User ID          │
│ Taste Profile ────► Preferences    │
│ Reorder Engine ──► Predictions      │
│ Demand Forecast ──► Trends         │
│ Event Platform ──► Logging         │
│ CDP ───────────► Segmentation    │
└─────────────────────────────────────┘
```

---

## SUPPORT COPILOT CONNECTIONS

```
┌─────────────────────────────────────┐
│ SUPPORT COPILOT (Child)              │
│                                      │
│ Refunds ──────────► Resolution     │
│ Complaints ──────► Tracking        │
│ Technical Issues ► Escalation      │
│ Billing ────────► Resolution     │
└─────────────────────────────────────┘
```

---

## API ENDPOINTS

### Voice
```bash
POST /api/voice/transcribe  # Speech to text
POST /api/voice/synthesize  # Text to speech
```

### Credit
```bash
POST /api/credit/score      # Get credit score
POST /api/credit/lending   # Lending eligibility
POST /api/credit/bnpl     # BNPL calculation
```

### POS
```bash
POST /api/pos/order       # Process order
GET  /api/pos/inventory/:id  # Get inventory
GET  /api/pos/analytics/:id # Get analytics
```

### Message
```bash
POST /api/message  # Unified chat
```

---

## QUICK START

```bash
cd REZ-unified-chat
npm install
cp .env.example .env
npm start
```

---

## ENVIRONMENT VARIABLES

```bash
# Voice
OPENAI_API_KEY=sk-...
ELEVEN_LABS_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Credit
CREDIT_ENGINE_URL=http://localhost:4070

# POS
MERCHANT_OS_URL=http://localhost:4073
INVENTORY_URL=http://localhost:4071

# Intelligence
REZ_INTENT_URL=http://localhost:4050
REZ_MEMORY_URL=http://localhost:4051
REZ_IDENTITY_URL=http://localhost:4050
```

---

## WEBSOCKET

```javascript
const ws = new WebSocket('ws://localhost:4100/ws?userId=user123&namespace=chat');
ws.send(JSON.stringify({ message: 'Hello' }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## COMPLETE STACK

| Layer | Technology |
|-------|-------------|
| Voice | OpenAI Whisper, ElevenLabs, Twilio |
| Credit | ML scoring, Risk engine |
| POS | Real-time inventory |
| Intelligence | 9 ML services |
| Support | 25+ intents |
| Events | 50+ event types |

---

*Agent OS connects everything.*
