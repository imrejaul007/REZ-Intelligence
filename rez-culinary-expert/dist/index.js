"use strict";
/**
 * REZ Culinary Expert Agent
 * Main entry point for the Express server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const mongodb_1 = require("mongodb");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./utils/logger");
const culinary_routes_1 = __importDefault(require("./routes/culinary.routes"));
const expertise_1 = require("./services/expertise");
const menuService_1 = require("./services/menuService");
const dietaryService_1 = require("./services/dietaryService");
const recommendations_1 = require("./services/recommendations");
const orderFlow_1 = require("./intents/orderFlow");
const coreBrainIntegration_1 = require("./services/coreBrainIntegration");
function loadConfig() {
    const internalServiceTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    let internalServiceTokens = new Map();
    try {
        const parsed = JSON.parse(internalServiceTokensJson);
        internalServiceTokens = new Map(Object.entries(parsed));
    }
    catch {
        logger_1.logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    }
    return {
        port: parseInt(process.env.PORT || '3001', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        mongodbDbName: process.env.MONGODB_DB_NAME || 'rez_culinary',
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        internalServiceTokens,
    };
}
const config = loadConfig();
// ============================================================================
// DATABASE CONNECTIONS
// ============================================================================
let mongoClient = null;
let redis = null;
async function connectDatabases() {
    // Connect to MongoDB
    try {
        mongoClient = new mongodb_1.MongoClient(config.mongodbUri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
        });
        await mongoClient.connect();
        logger_1.logger.info('Connected to MongoDB', { uri: config.mongodbUri.replace(/\/\/.*@/, '//***@') });
        // Initialize collections and indexes
        const db = mongoClient.db(config.mongodbDbName);
        // Create collections if they don't exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        const requiredCollections = [
            'menu_items',
            'menus',
            'orders',
            'order_flow_states',
            'dietary_profiles',
            'recommendations',
        ];
        for (const name of requiredCollections) {
            if (!collectionNames.includes(name)) {
                await db.createCollection(name);
                logger_1.logger.info(`Created collection: ${name}`);
            }
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to MongoDB:', error);
        throw error;
    }
    // Connect to Redis
    try {
        redis = new ioredis_1.default(config.redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError(err) {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true;
                }
                return false;
            },
        });
        redis.on('error', (error) => {
            logger_1.logger.error('Redis connection error:', error);
        });
        redis.on('connect', () => {
            logger_1.logger.info('Connected to Redis', { url: config.redisUrl.replace(/\/\/.*@/, '//***@') });
        });
        // Wait for Redis to be ready
        await new Promise((resolve, reject) => {
            if (redis.status === 'ready') {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                reject(new Error('Redis connection timeout'));
            }, 10000);
            redis.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            redis.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to Redis:', error);
        throw error;
    }
}
// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
function createApp() {
    const app = (0, express_1.default)();
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    // CORS
    app.use((0, cors_1.default)({
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-ID'],
        credentials: true,
        maxAge: 86400,
    }));
    // Body parsing
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
    // Rate limiting
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitMaxRequests,
        message: {
            success: false,
            error: 'Too many requests, please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);
    // Request logging
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            (0, logger_1.logRequest)(req.method, req.path, res.statusCode, duration, {
                ip: req.ip,
                userAgent: req.get('user-agent'),
            });
        });
        next();
    });
    // Health check endpoint
    app.get('/health', async (req, res) => {
        const healthcheck = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                mongodb: mongoClient?.topology?.isConnected() ? 'connected' : 'disconnected',
                redis: redis?.status === 'ready' ? 'connected' : 'disconnected',
            },
        };
        const isHealthy = healthcheck.services.mongodb === 'connected' &&
            healthcheck.services.redis === 'connected';
        res.status(isHealthy ? 200 : 503).json(healthcheck);
    });
    // Detailed health check with dependencies
    app.get('/health/detailed', async (req, res) => {
        const memoryUsage = process.memoryUsage();
        const healthData = {
            status: 'healthy',
            service: 'rez-culinary-expert',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.nodeEnv,
            dependencies: {
                mongodb: mongoClient?.topology?.isConnected() ? 'connected' : 'disconnected',
                redis: redis?.status === 'ready' ? 'connected' : 'disconnected',
            },
            memory: {
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024),
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                platform: process.platform,
                nodeVersion: process.version,
            },
        };
        const isHealthy = healthData.dependencies.mongodb === 'connected' &&
            healthData.dependencies.redis === 'connected';
        res.status(isHealthy ? 200 : 503).json(healthData);
    });
    // Kubernetes readiness probe
    app.get('/health/ready', (req, res) => {
        const checks = {
            mongodb: mongoClient?.topology?.isConnected() ?? false,
            redis: redis?.status === 'ready' ?? false,
        };
        const isReady = checks.mongodb && checks.redis;
        res.status(isReady ? 200 : 503).json({
            ready: isReady,
            checks,
            timestamp: new Date().toISOString(),
        });
    });
    // Internal authentication middleware
    app.use('/api/internal', (req, res, next) => {
        const token = req.get('X-Internal-Token');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Missing X-Internal-Token header',
            });
        }
        const validToken = config.internalServiceTokens.get(token);
        if (!validToken) {
            (0, logger_1.logAudit)('AUTH_FAILURE', 'unknown', {
                reason: 'invalid_token',
                path: req.path,
                ip: req.ip,
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid X-Internal-Token',
            });
        }
        // Attach service name to request
        req.serviceName = validToken;
        next();
    });
    // Mount routes
    app.use('/api/culinary', culinary_routes_1.default);
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            path: req.path,
        });
    });
    // Error handler
    app.use((err, req, res, next) => {
        logger_1.logger.error('Unhandled error:', {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
        });
        res.status(500).json({
            success: false,
            error: config.nodeEnv === 'production'
                ? 'Internal server error'
                : err.message,
        });
    });
    return app;
}
// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================
async function initializeServices() {
    if (!mongoClient || !redis) {
        throw new Error('Databases not connected');
    }
    const db = mongoClient.db(config.mongodbDbName);
    // Initialize services
    const expertiseService = (0, expertise_1.getCulinaryExpertiseService)();
    await expertiseService.initialize(mongoClient, redis);
    logger_1.logger.info('CulinaryExpertiseService initialized');
    const menuService = (0, menuService_1.getMenuService)();
    await menuService.initialize(db, redis);
    logger_1.logger.info('MenuService initialized');
    const dietaryService = (0, dietaryService_1.getDietaryService)();
    await dietaryService.initialize(db, redis);
    logger_1.logger.info('DietaryService initialized');
    const recommendationsService = (0, recommendations_1.getRecommendationsService)();
    await recommendationsService.initialize(db, redis);
    logger_1.logger.info('RecommendationsService initialized');
    const orderFlowHandler = (0, orderFlow_1.getOrderFlowHandler)();
    await orderFlowHandler.initialize(mongoClient, redis);
    logger_1.logger.info('OrderFlowHandler initialized');
}
// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function shutdown(signal) {
    logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    // Stop accepting new connections
    if (server) {
        server.close(() => {
            logger_1.logger.info('HTTP server closed');
        });
    }
    // Close database connections
    try {
        if (mongoClient) {
            await mongoClient.close();
            logger_1.logger.info('MongoDB connection closed');
        }
        if (redis) {
            await redis.quit();
            logger_1.logger.info('Redis connection closed');
        }
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
    }
    process.exit(0);
}
// ============================================================================
// MAIN
// ============================================================================
let server = null;
async function main() {
    try {
        // Connect to databases
        logger_1.logger.info('Connecting to databases...');
        await connectDatabases();
        // Initialize Core Brain client
        logger_1.logger.info('Connecting to Core Brain...');
        const coreBrain = (0, coreBrainIntegration_1.getCoreBrainClient)();
        const coreBrainHealthy = await coreBrain.healthCheck().catch(() => false);
        if (coreBrainHealthy) {
            logger_1.logger.info('Core Brain connection established', {
                baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
            });
        }
        else {
            logger_1.logger.warn('Core Brain not available - running in degraded mode');
        }
        // Initialize services
        logger_1.logger.info('Initializing services...');
        await initializeServices();
        // Create and start Express app
        const app = createApp();
        server = app.listen(config.port, () => {
            logger_1.logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                    REZ Culinary Expert Agent                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     Running                                         ║
║  Port:       ${String(config.port).padEnd(53)}║
║  Environment: ${config.nodeEnv.padEnd(45)}║
║  MongoDB:    ${config.mongodbDbName.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
      `);
            logger_1.logger.info('API Endpoints:');
            logger_1.logger.info('  POST /api/culinary/chat         - Chat with culinary expert');
            logger_1.logger.info('  GET  /api/culinary/menu/:id     - Get restaurant menu');
            logger_1.logger.info('  POST /api/culinary/recommendations - Get recommendations');
            logger_1.logger.info('  POST /api/culinary/dietary/*    - Dietary management');
            logger_1.logger.info('  POST /api/culinary/orders/*     - Order management');
            logger_1.logger.info('  GET  /health                    - Health check');
        });
        // Graceful shutdown handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Unhandled rejection handler
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection:', { reason, promise });
        });
        // Uncaught exception handler
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map