"use strict";
/**
 * REZ Event Bus Service
 * Shared Event Bus for REZ Agent OS v3
 *
 * Port: 4082
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("./config");
const logger_1 = require("./services/logger");
const redisPubSub_1 = require("./services/redisPubSub");
const kafkaProducer_1 = require("./services/kafkaProducer");
const publisher_1 = require("./services/publisher");
const subscriber_1 = require("./services/subscriber");
const events_routes_1 = require("./routes/events.routes");
const subscriptions_routes_1 = require("./routes/subscriptions.routes");
// Create Express app
const app = (0, express_1.default)();
exports.app = app;
// Services
let redisPubSubService;
let kafkaProducerService;
const startTime = Date.now();
/**
 * Setup middleware
 */
function setupMiddleware() {
    // Security headers
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
            },
        },
    }));
    // CORS
    app.use((0, cors_1.default)({
        origin: config_1.config.server.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
    }));
    // Compression
    app.use((0, compression_1.default)());
    // Body parsing
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Request logging
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger_1.httpLogger.info('Request completed', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: duration,
                ip: req.ip,
                userAgent: req.get('user-agent'),
            });
        });
        next();
    });
    // Add request ID
    app.use((req, res, next) => {
        const reqId = req.headers['x-request-id'] || `${crypto_1.default.randomUUID()}`;
        res.setHeader('X-Request-Id', reqId);
        req.requestId = reqId;
        next();
    });
}
/**
 * Setup routes
 */
function setupRoutes() {
    // Health check endpoints
    app.get('/health', async (req, res) => {
        try {
            const redisHealthy = await redisPubSubService.healthCheck();
            const kafkaHealthy = await kafkaProducerService.healthCheck();
            const status = {
                status: redisHealthy && kafkaHealthy ? 'healthy' : redisHealthy ? 'degraded' : 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - startTime) / 1000),
                services: {
                    redis: redisHealthy,
                    kafka: kafkaHealthy,
                },
                version: '1.0.0',
            };
            res.status(status.status === 'healthy' ? 200 : 503).json(status);
        }
        catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Health check failed',
            });
        }
    });
    app.get('/health/live', (req, res) => {
        res.json({ status: 'alive', timestamp: new Date().toISOString() });
    });
    app.get('/health/ready', async (req, res) => {
        try {
            const redisHealthy = await redisPubSubService.healthCheck();
            if (redisHealthy) {
                res.json({ status: 'ready', timestamp: new Date().toISOString() });
            }
            else {
                res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
            }
        }
        catch {
            res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
        }
    });
    // API routes
    app.use('/events', events_routes_1.eventRoutes);
    app.use('/subscriptions', subscriptions_routes_1.subscriptionRoutes);
    // Stats endpoint
    app.get('/stats', async (req, res) => {
        const publisher = (0, publisher_1.getPublisherService)();
        const subscriber = subscriber_1.subscriberService;
        res.json({
            publisher: publisher.getStats(),
            subscriber: subscriber.getStats(),
            redis: redisPubSubService.getStatus(),
            kafka: kafkaProducerService.getStatus(),
            uptime: Math.floor((Date.now() - startTime) / 1000),
        });
    });
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            error: 'Not Found',
            code: 'ENDPOINT_NOT_FOUND',
            message: `Cannot ${req.method} ${req.path}`,
            timestamp: new Date().toISOString(),
        });
    });
    // Error handler
    app.use((err, req, res, next) => {
        logger_1.logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            requestId: req.requestId,
        });
        res.status(500).json({
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
            message: config_1.config.server.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
        });
    });
}
/**
 * Initialize services
 */
async function initializeServices() {
    logger_1.logger.info('Initializing services...');
    // Initialize Redis Pub/Sub
    redisPubSubService = new redisPubSub_1.RedisPubSubService();
    await redisPubSubService.connect();
    logger_1.logger.info('Redis Pub/Sub connected');
    // Initialize Kafka Producer
    kafkaProducerService = new kafkaProducer_1.KafkaProducerService();
    await kafkaProducerService.connect();
    logger_1.logger.info('Kafka producer connected');
    // Ensure Kafka topic exists
    await kafkaProducerService.ensureTopic(config_1.config.kafka.topic);
    logger_1.logger.info('Kafka topic ensured', { topic: config_1.config.kafka.topic });
    // Initialize Publisher Service
    (0, publisher_1.initPublisherService)(redisPubSubService, kafkaProducerService);
    logger_1.logger.info('Publisher service initialized');
    // Initialize Subscriber Service
    await subscriber_1.subscriberService.initialize();
    logger_1.logger.info('Subscriber service initialized');
    // Store services on app for route access
    app.set('redisPubSub', redisPubSubService);
    app.set('kafkaProducer', kafkaProducerService);
    app.set('publisher', (0, publisher_1.getPublisherService)());
    app.set('subscriber', subscriber_1.subscriberService);
}
/**
 * Graceful shutdown
 */
async function shutdown() {
    logger_1.logger.info('Shutting down...');
    try {
        await subscriber_1.subscriberService.shutdown();
        await kafkaProducerService.disconnect();
        await redisPubSubService.disconnect();
        logger_1.logger.info('Shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Shutdown error', { error });
        process.exit(1);
    }
}
// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection', { reason, promise });
});
/**
 * Start server
 */
async function start() {
    try {
        logger_1.logger.info('Starting REZ Event Bus Service...', {
            port: config_1.config.server.port,
            nodeEnv: config_1.config.server.nodeEnv,
        });
        setupMiddleware();
        await initializeServices();
        setupRoutes();
        app.listen(config_1.config.server.port, () => {
            logger_1.logger.info(`REZ Event Bus Service started`, {
                port: config_1.config.server.port,
                nodeEnv: config_1.config.server.nodeEnv,
                healthCheck: `http://localhost:${config_1.config.server.port}/health`,
                apiDocs: `http://localhost:${config_1.config.server.port}/events/types`,
            });
            logger_1.logger.info(`
╔══════════════════════════════════════════════════════════╗
║        REZ Event Bus Service - Started Successfully      ║
╠══════════════════════════════════════════════════════════╣
║  Port:     ${config_1.config.server.port.toString().padEnd(43)}║
║  Health:   http://localhost:${config_1.config.server.port}/health              ║
║  API:      http://localhost:${config_1.config.server.port}/events              ║
║  Version:  1.0.0                                       ║
╚══════════════════════════════════════════════════════════╝
      `);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', { error });
        process.exit(1);
    }
}
// Start the server
start();
//# sourceMappingURL=index.js.map