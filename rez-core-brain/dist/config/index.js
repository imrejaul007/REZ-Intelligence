"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paths = exports.isTest = exports.isDevelopment = exports.isProduction = exports.config = void 0;
exports.getMongoUri = getMongoUri;
exports.getRedisConfig = getRedisConfig;
exports.getInternalServiceTokens = getInternalServiceTokens;
exports.getCorsOrigins = getCorsOrigins;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
// Environment configuration schema
const envSchema = zod_1.z.object({
    // Service configuration
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('4000').transform(Number),
    SERVICE_NAME: zod_1.z.string().default('@rez/core-brain'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    // MongoDB configuration
    MONGODB_URI: zod_1.z.string().default('mongodb://localhost:27017/rez-core-brain'),
    MONGODB_USER: zod_1.z.string().optional(),
    MONGODB_PASSWORD: zod_1.z.string().optional(),
    // Redis configuration
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    REDIS_DB: zod_1.z.string().default('0').transform(Number),
    // JWT configuration
    JWT_SECRET: zod_1.z.string().min(32).default('dev-secret-change-in-production'),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    // Memory configuration
    SHORT_TERM_MEMORY_TTL: zod_1.z.string().default('3600').transform(Number), // 1 hour in seconds
    LONG_TERM_MEMORY_RETENTION: zod_1.z.string().default('365').transform(Number), // days
    MAX_SHORT_TERM_MEMORIES: zod_1.z.string().default('100').transform(Number),
    EMBEDDING_MODEL: zod_1.z.string().default('text-embedding-ada-002'),
    // Session configuration
    SESSION_TTL: zod_1.z.string().default('1800').transform(Number), // 30 minutes
    MAX_CONCURRENT_SESSIONS: zod_1.z.string().default('10').transform(Number),
    // Rate limiting
    RATE_LIMIT_WINDOW: zod_1.z.string().default('900000').transform(Number), // 15 minutes
    RATE_LIMIT_MAX: zod_1.z.string().default('1000').transform(Number),
    // Internal service communication
    INTERNAL_SERVICE_TOKENS_JSON: zod_1.z.string().default('{}'),
    // CORS
    CORS_ORIGINS: zod_1.z.string().default('*'),
    // Optional external services
    OPENAI_API_KEY: zod_1.z.string().optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
});
// Parse and validate environment variables
function parseEnvConfig() {
    try {
        return envSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
            throw new Error(`Environment configuration error: ${issues}`);
        }
        throw error;
    }
}
exports.config = parseEnvConfig();
// Derived configurations
exports.isProduction = exports.config.NODE_ENV === 'production';
exports.isDevelopment = exports.config.NODE_ENV === 'development';
exports.isTest = exports.config.NODE_ENV === 'test';
// MongoDB connection string with authentication
function getMongoUri() {
    if (exports.config.MONGODB_USER && exports.config.MONGODB_PASSWORD) {
        const uri = new URL(exports.config.MONGODB_URI);
        uri.username = exports.config.MONGODB_USER;
        uri.password = exports.config.MONGODB_PASSWORD;
        return uri.toString();
    }
    return exports.config.MONGODB_URI;
}
// Redis configuration
function getRedisConfig() {
    return {
        url: exports.config.REDIS_URL,
        password: exports.config.REDIS_PASSWORD,
        db: exports.config.REDIS_DB,
    };
}
// Internal service tokens
function getInternalServiceTokens() {
    try {
        return JSON.parse(exports.config.INTERNAL_SERVICE_TOKENS_JSON);
    }
    catch {
        return {};
    }
}
// CORS origins
function getCorsOrigins() {
    if (exports.config.CORS_ORIGINS === '*')
        return ['*'];
    return exports.config.CORS_ORIGINS.split(',').map((o) => o.trim());
}
// Paths
exports.paths = {
    root: path_1.default.resolve(__dirname, '../..'),
    dist: path_1.default.resolve(__dirname, '../../dist'),
    src: path_1.default.resolve(__dirname, '..'),
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map