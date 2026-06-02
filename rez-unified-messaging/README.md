# REZ UNIFIED MESSAGING PLATFORM

**Version:** 2.0
**Date:** May 6, 2026
**GitHub:** [imrejaul007/rez-unified-messaging](https://github.com/imrejaul007/rez-unified-messaging)

---

## WHAT IT IS

```
One platform for ALL messaging across ReZ ecosystem
```

### Merchant WhatsApp OS

Each merchant gets:
- Dedicated WhatsApp Business number
- AI-powered responses (via ReZ Mind)
- Campaign integration
- Analytics dashboard

### Channels Supported

| Channel | Purpose |
|---------|---------|
| **WhatsApp** | Chat commerce, support, offers |
| **SMS** | OTPs, alerts, reminders |
| **Email** | Receipts, newsletters |
| **Push** | Notifications, re-engagement |
| **In-App** | Real-time messaging |

---

## QUICK START

### 1. Deploy to Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New → Blueprint**
3. Connect GitHub repo: `imrejaul007/rez-unified-messaging`
4. Add environment variables
5. Click **Apply**

### 2. Environment Variables

```bash
# ReZ Mind (Required)
REZMIND_URL=https://your-rez-mind-url.onrender.com

# WhatsApp Business API
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_BUSINESS_ID=your_business_id
WHATSAPP_WEBHOOK_TOKEN=your_verify_token

# SMS (optional)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
SMS_SENDER_ID=REZAPP

# Email (optional)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_key
EMAIL_FROM=noreply@rez.com

# Push (optional)
FIREBASE_SERVER_KEY=your_key
FIREBASE_PROJECT_ID=your_project
```

### 3. Set Up WhatsApp Webhook

1. Go to Meta Business Console
2. Select your WhatsApp Business app
3. Go to **Webhooks**
4. Set callback URL: `https://your-service.onrender.com/webhook/whatsapp`
5. Set verify token: `your_verify_token`

---

## API ENDPOINTS

### Messaging

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/messaging` | GET/POST | List/send messages |
| `/api/messaging/:id` | GET | Get message |
| `/api/messaging/:id/status` | PATCH | Update status |

### Merchant WhatsApp

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/merchant/whatsapp/numbers` | GET/POST | Manage numbers |
| `/api/merchant/whatsapp/webhook` | POST | Receive messages |
| `/api/merchant/whatsapp/conversations` | GET | List conversations |
| `/api/merchant/whatsapp/send` | POST | Send message |
| `/api/merchant/whatsapp/analytics` | GET | View analytics |

### Send

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/send/whatsapp` | POST | Send WhatsApp |
| `/api/send/sms` | POST | Send SMS |
| `/api/send/email` | POST | Send Email |
| `/api/send/push` | POST | Send Push |

### AI

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/route` | POST | Auto-route message |
| `/api/ai/generate` | POST | AI response |
| `/api/capture` | POST | Capture for learning |

### Templates

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/messaging/templates` | GET/POST | List/create templates |
| `/api/messaging/analytics` | GET | View analytics |

---

## MERCHANT WHATSAPP OS FLOW

```
Customer sends WhatsApp
        ↓
Webhook receives
        ↓
ReZ Mind detects intent
        ↓
AI generates response
        ↓
Send from merchant's number
        ↓
Conversation tracked
        ↓
ReZ Mind learns
```

---

## CHANNEL ROUTING (AI-Powered)

```
Lead Temperature → Best Channel → Message

Hot (≥75) → WhatsApp → "Your cart is waiting! 30 min left"
Warm (40-74) → Push → "Still thinking about that biryani?"
Cold (<40) → Email/SMS → "Discover something new today"
```

---

## REZ MIND INTEGRATION

All messages flow to ReZ Mind for:
- Intent detection
- AI response generation
- Learning from interactions
- Personalization
- Lead scoring

---

## FILES

```
rez-unified-messaging/
├── src/
│   ├── index.ts (Main server)
│   ├── routes/
│   │   ├── messaging.ts
│   │   ├── merchantWhatsApp.ts
│   │   ├── channels.ts
│   │   ├── analytics.ts
│   │   └── templates.ts
│   ├── services/
│   │   ├── whatsappService.ts (WhatsApp API)
│   │   ├── smsService.ts (SMS)
│   │   ├── emailService.ts (Email)
│   │   ├── pushService.ts (Push)
│   │   ├── channelRouter.ts (AI routing)
│   │   └── rezMindService.ts (ReZ Mind)
│   └── types/
│       └── index.ts
├── Dockerfile
├── docker-compose.yml
├── render.yaml
└── .env.example
```

---

## DEPLOYMENT

### Render (Recommended)

```bash
# Just connect GitHub and deploy
# render.yaml handles the rest
```

### Docker

```bash
docker-compose up -d
```

### Manual

```bash
npm install
npm run build
npm start
```

---

## STATUS

| Component | Status |
|-----------|--------|
| WhatsApp API | ✅ Built |
| SMS Service | ✅ Built |
| Email Service | ✅ Built |
| Push Service | ✅ Built |
| Channel Router | ✅ Built |
| ReZ Mind | ✅ Connected |
| Deployment | ✅ Ready |

---

**Built for scale, designed for growth.**
