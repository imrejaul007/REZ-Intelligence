import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  reconciliation: {
    cronSchedule: process.env.RECONCILIATION_CRON_SCHEDULE || '0 2 * * *',
    batchSize: parseInt(process.env.BATCH_SIZE || '1000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  },

  externalServices: {
    transactionServiceUrl: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3001',
    paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
