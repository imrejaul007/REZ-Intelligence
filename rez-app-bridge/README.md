# REZ App Bridge

Connect REZ Consumer App to Orchestrator. Handles real-time messaging, push notifications via Firebase Cloud Messaging, and service-to-service communication.

## Features

- Real-time messaging via Socket.IO
- Firebase Cloud Messaging (FCM) push notifications
- App-to-orchestrator message routing
- In-app notifications
- Device token management
- Topic-based push subscriptions
- Service-to-service authentication

## Prerequisites

- Node.js >= 18.0.0
- Redis (for Socket.IO adapter and caching)
- MongoDB (optional, for message history)
- Firebase project (for push notifications)

## Setup

### 1. Clone and Install

```bash
cd REZ-Intelligence/rez-app-bridge
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=4089
ORCHESTRATOR_URL=http://localhost:4006
APP_API_KEY=your-secure-api-key
INTERNAL_SERVICE_TOKENS_JSON={"app-bridge":"your-internal-token"}
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/rez-app-bridge
LOG_LEVEL=info
```

### 3. Firebase Setup

#### 3.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the wizard
3. Name your project (e.g., "rez-app")

#### 3.2 Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** > **Cloud Messaging**
2. Scroll to **Web configuration**
3. Click **Generate key pair** under **Web push certificates**
4. Note your **Sender ID** (visible in project settings)

#### 3.3 Generate Service Account Key

1. Go to **Project Settings** > **Service Accounts**
2. Click **Generate new private key**
3. Save the JSON file securely

#### 3.4 Configure Environment Variables

Add these to your `.env` file:

```env
FCM_PROJECT_ID=your-project-id
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

**Important:** Replace actual newlines in the private key with `\n`:

```bash
# Example: Convert JSON private key to single-line env var
export FCM_PRIVATE_KEY="$(cat service-account.json | jq -r '.private_key' | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')"
```

#### 3.5 iOS Setup (Optional)

1. In Firebase Console, add an iOS app
2. Download `GoogleService-Info.plist`
3. Follow [Firebase iOS setup guide](https://firebase.google.com/docs/ios/setup)

#### 3.6 Android Setup (Optional)

1. In Firebase Console, add an Android app
2. Download `google-services.json`
3. Follow [Firebase Android setup guide](https://firebase.google.com/docs/android/setup)

### 4. Start the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Reference

### Authentication

All API endpoints require authentication via one of:

**API Key (for mobile app):**
```
X-API-Key: your-app-api-key
```

**Internal Token (for service-to-service):**
```
X-Internal-Token: your-internal-token
X-Service-Name: calling-service-name
```

### Endpoints

#### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "rez-app-bridge",
  "timestamp": "2026-05-13T10:00:00.000Z"
}
```

#### Send Message

```
POST /api/message
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user123",
  "message": "Show me my orders",
  "sessionId": "optional-session-id",
  "metadata": {}
}
```

Response:
```json
{
  "success": true,
  "responseId": "uuid",
  "message": "Here are your recent orders...",
  "data": {
    "actions": [],
    "context": {},
    "confidence": 0.95
  }
}
```

#### Send Push Notification

```
POST /api/push
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user123",
  "title": "New Order",
  "body": "Your order #12345 has been shipped!",
  "data": {
    "orderId": "12345",
    "link": "rez://orders/12345"
  }
}
```

#### Register Device Token

```
POST /api/device/register
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user123",
  "token": "fcm-device-token",
  "platform": "ios"
}
```

#### Send In-App Notification

```
POST /api/notification
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user123",
  "title": "Welcome!",
  "body": "Thanks for joining REZ",
  "type": "success",
  "priority": "normal"
}
```

#### Subscribe to Topic

```
POST /api/topic/subscribe
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user123",
  "topic": "promotions"
}
```

### WebSocket Events

Connect to `/socket.io` with authentication:

```javascript
const socket = io('http://localhost:4089', {
  auth: {
    userId: 'user123'
  }
});
```

#### Client Events (send)

- `chat:message` - Send message
  ```javascript
  socket.emit('chat:message', {
    recipientId: 'user456',
    content: 'Hello!',
    type: 'text'
  });
  ```

- `chat:read` - Mark messages as read
  ```javascript
  socket.emit('chat:read', {
    messageIds: ['id1', 'id2'],
    chatPartnerId: 'user456'
  });
  ```

- `typing:start` / `typing:stop` - Typing indicators
  ```javascript
  socket.emit('typing:start', { recipientId: 'user456' });
  ```

#### Server Events (receive)

- `connected` - Connection acknowledged
- `chat:message` - New message received
- `chat:message:sent` - Message delivery confirmed
- `chat:read` - Messages read confirmation
- `typing:indicator` - Typing status update
- `notification` - In-app notification
- `user:status` - User online/offline status
- `error` - Error occurred

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  REZ Consumer   │────▶│   App Bridge     │────▶│  Orchestrator │
│      App        │◀────│   (Port 4089)    │◀────│  (Port 4006)   │
└─────────────────┘     └──────────────────┘     └────────────────┘
      │                         │
      │ WebSocket               │ FCM Push
      │ + REST                  │
      ▼                         ▼
┌─────────────────┐     ┌──────────────────┐
│   Mobile App    │     │  Firebase Cloud  │
│   (Real-time)   │     │   Messaging      │
└─────────────────┘     └──────────────────┘
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Security

- All endpoints require authentication
- Rate limiting enabled (60-100 requests/minute depending on endpoint)
- API keys should be rotated periodically
- Internal tokens are scoped per calling service
- WebSocket connections require valid userId
- Input validation with Zod on all endpoints

## Monitoring

Logs are output in JSON format to stdout. Configure log shipping to your aggregation service.

Key log events:
- `Request completed` - HTTP requests with method, path, status, duration
- `Push notification sent` - Push delivery with success/failure counts
- `User connected via WebSocket` - Socket connections
- `Message received` - Incoming messages

## Troubleshooting

### Push notifications not working

1. Verify Firebase credentials in `.env`
2. Check Firebase Console for message delivery stats
3. Ensure device tokens are properly registered
4. Verify app has notification permissions

### WebSocket connection fails

1. Check CORS configuration
2. Verify network connectivity
3. Ensure valid userId in auth data

### Orchestrator unreachable

1. Verify `ORCHESTRATOR_URL` in `.env`
2. Check if orchestrator service is running
3. Verify internal service token

## License

Proprietary - REZ Commerce Platform
