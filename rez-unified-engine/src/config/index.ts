import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  server: {
    port: number;
    nodeEnv: string;
    logLevel: string;
  };
  mongodb: {
    uri: string;
    options: {
      maxPoolSize: number;
      minPoolSize: number;
      serverSelectionTimeoutMS: number;
      socketTimeoutMS: number;
    };
  };
  redis: {
    url: string;
    password?: string;
    keyPrefix: string;
  };
  security: {
    jwtSecret: string;
    internalServiceTokens: Record<string, string>;
  };
  channels: {
    whatsapp: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
      webhookSecret: string;
    };
    voice: {
      fromNumber: string;
      webhookSecret: string;
    };
    copilot: {
      webhookSecret: string;
    };
  };
  services: {
    agentOs: {
      url: string;
      timeout: number;
    };
    intentGraph: {
      url: string;
      timeout: number;
    };
    cdp: {
      url: string;
      timeout: number;
    };
    merchantOs: {
      url: string;
      timeout: number;
    };
    commerce: {
      url: string;
      timeout: number;
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  session: {
    ttl: {
      WHATSAPP: number;
      VOICE: number;
      COPILOT: number;
      WEBSITE: number;
    };
  };
  performance: {
    maxConcurrentSessions: number;
    messageProcessingTimeoutMs: number;
    contextAggregationTimeoutMs: number;
  };
}

function parseInternalTokens(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3005', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_unified_engine',
    options: {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
    keyPrefix: 'rez:unified:',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET!,
    internalServiceTokens: parseInternalTokens(
      process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'
    ),
  },
  channels: {
    whatsapp: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_WHATSAPP_FROM || '',
      webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET || '',
    },
    voice: {
      fromNumber: process.env.TWILIO_VOICE_FROM || '',
      webhookSecret: process.env.VOICE_WEBHOOK_SECRET || '',
    },
    copilot: {
      webhookSecret: process.env.COPILOT_WEBHOOK_SECRET || '',
    },
  },
  services: {
    agentOs: {
      url: process.env.REZ_AGENT_OS_URL || 'http://localhost:3001',
      timeout: 5000,
    },
    intentGraph: {
      url: process.env.REZ_INTENT_GRAPH_URL || 'http://localhost:3006',
      timeout: 2000,
    },
    cdp: {
      url: process.env.REZ_CDP_URL || 'http://localhost:3003',
      timeout: 2000,
    },
    merchantOs: {
      url: process.env.REZ_MERCHANT_OS_URL || 'http://localhost:3007',
      timeout: 2000,
    },
    commerce: {
      url: process.env.REZ_COMMERCE_URL || 'http://localhost:3008',
      timeout: 2000,
    },
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  session: {
    ttl: {
      WHATSAPP: parseInt(process.env.SESSION_TTL_WHATSAPP || '86400000', 10),
      VOICE: parseInt(process.env.SESSION_TTL_VOICE || '1800000', 10),
      COPILOT: parseInt(process.env.SESSION_TTL_COPILOT || '1800000', 10),
      WEBSITE: parseInt(process.env.SESSION_TTL_WEBSITE || '7200000', 10),
    },
  },
  performance: {
    maxConcurrentSessions: parseInt(
      process.env.MAX_CONCURRENT_SESSIONS || '100000',
      10
    ),
    messageProcessingTimeoutMs: parseInt(
      process.env.MESSAGE_PROCESSING_TIMEOUT_MS || '500',
      10
    ),
    contextAggregationTimeoutMs: parseInt(
      process.env.CONTEXT_AGGREGATION_TIMEOUT_MS || '100',
      10
    ),
  },
};

export default config;
