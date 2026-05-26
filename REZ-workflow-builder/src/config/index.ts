export const config = {
  server: {
    port: parseInt(process.env.PORT || '4199', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_workflow_builder',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  auth: {
    apiKeys: (process.env.API_KEYS || '').split(',').filter(Boolean),
    internalTokens: (process.env.INTERNAL_TOKENS || '').split(',').filter(Boolean),
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rez.money').split(','),
};
