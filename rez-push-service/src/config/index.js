require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4013,
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodb: {
    uri: process.env.MONGODB_URI || '',  // REQUIRED: Set MONGODB_URI env var
    db: process.env.MONGODB_DB || 'rez_push_service',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL,
  },

  fcm: {
    projectId: process.env.FCM_PROJECT_ID,
    privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FCM_CLIENT_EMAIL,
  },

  apns: {
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    bundleId: process.env.APNS_BUNDLE_ID,
    keyPath: process.env.APNS_KEY_PATH,
    useSandbox: process.env.APNS_USE_SANDBOX === 'true',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@rezapp.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'ReZ App',
  },

  whatsapp: {
    from: process.env.WHATSAPP_FROM,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    perUserMax: parseInt(process.env.RATE_LIMIT_PER_USER_MAX, 10) || 10,
    perChannelMax: parseInt(process.env.RATE_LIMIT_PER_CHANNEL_MAX, 10) || 50,
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY, 10) || 5000,
    dedupWindowMs: parseInt(process.env.QUEUE_DEDUP_WINDOW_MS, 10) || 300000,
  },

  quietHours: {
    defaultStart: parseInt(process.env.DEFAULT_QUIET_HOURS_START, 10) || 22,
    defaultEnd: parseInt(process.env.DEFAULT_QUIET_HOURS_END, 10) || 8,
  },
};
