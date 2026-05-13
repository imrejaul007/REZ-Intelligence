"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Server
    port: parseInt(process.env.PORT || '3005', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    // MongoDB
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-context-engine',
        options: {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        },
    },
    // Redis
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'rez:context:',
    },
    // Service tokens for internal communication
    internalServiceTokens: JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'),
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
    },
    // CORS
    cors: {
        origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    },
    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
};
//# sourceMappingURL=index.js.map