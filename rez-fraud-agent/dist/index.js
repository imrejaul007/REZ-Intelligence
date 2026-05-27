"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = require("redis");
const logger_js_1 = require("./utils/logger.js");
const fraud_routes_1 = __importDefault(require("./routes/fraud.routes"));
const alert_routes_1 = __importDefault(require("./routes/alert.routes"));
const systemPrompt_1 = require("./config/systemPrompt");
// Configuration from environment
const PORT = parseInt(process.env.PORT || '3007', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_fraud_agent';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Redis client
let redisClient = null;
exports.redisClient = redisClient;
// Express app
const app = (0, express_1.default)();
exports.app = app;
// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-User-Id', 'X-Request-Id'],
    credentials: true,
}));
// Compression
app.use((0, compression_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_js_1.logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
        });
    });
    next();
});
// Health check endpoints (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rez-fraud-agent',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
    });
});
app.get('/ready', async (req, res) => {
    try {
        // Check MongoDB
        const mongoState = mongoose_1.default.connection.readyState;
        const mongoConnected = mongoState === 1;
        // Check Redis
        let redisConnected = false;
        if (redisClient) {
            try {
                await redisClient.ping();
                redisConnected = true;
            }
            catch {
                redisConnected = false;
            }
        }
        if (mongoConnected && redisConnected) {
            res.json({
                status: 'ready',
                checks: {
                    mongodb: mongoConnected ? 'connected' : 'disconnected',
                    redis: redisConnected ? 'connected' : 'disconnected',
                },
                timestamp: new Date().toISOString(),
            });
        }
        else {
            res.status(503).json({
                status: 'not_ready',
                checks: {
                    mongodb: mongoConnected ? 'connected' : 'disconnected',
                    redis: redisConnected ? 'connected' : 'disconnected',
                },
                timestamp: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// System prompt endpoint
app.get('/system-prompt', (req, res) => {
    res.json({
        systemPrompt: systemPrompt_1.FRAUD_AGENT_SYSTEM_PROMPT,
        timestamp: new Date().toISOString(),
    });
});
// API routes
app.use('/api/fraud', fraud_routes_1.default);
app.use('/api/alerts', alert_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method,
    });
});
// Global error handler
app.use((err, req, res, next) => {
    logger_js_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    (0, logger_js_1.logSecurity)('Unhandled error in request', {
        path: req.path,
        method: req.method,
        error: err.message,
    });
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    });
});
// Database connection
async function connectMongoDB() {
    try {
        await mongoose_1.default.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger_js_1.logger.info('MongoDB connected', {
            host: mongoose_1.default.connection.host,
            database: mongoose_1.default.connection.name,
        });
        mongoose_1.default.connection.on('error', (error) => {
            logger_js_1.logger.error('MongoDB connection error', { error: error.message });
        });
        mongoose_1.default.connection.on('disconnected', () => {
            logger_js_1.logger.warn('MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            logger_js_1.logger.info('MongoDB reconnected');
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to connect to MongoDB', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
// Redis connection
async function connectRedis() {
    try {
        exports.redisClient = redisClient = (0, redis_1.createClient)({
            url: REDIS_URL,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger_js_1.logger.error('Redis max reconnection attempts reached');
                        return new Error('Redis max reconnection attempts reached');
                    }
                    return Math.min(retries * 100, 3000);
                },
            },
        });
        redisClient.on('error', (error) => {
            logger_js_1.logger.error('Redis error', { error: error.message });
        });
        redisClient.on('connect', () => {
            logger_js_1.logger.info('Redis connected', { url: REDIS_URL });
        });
        redisClient.on('reconnecting', () => {
            logger_js_1.logger.info('Redis reconnecting');
        });
        await redisClient.connect();
    }
    catch (error) {
        logger_js_1.logger.error('Failed to connect to Redis', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - Redis is optional but recommended
    }
}
// Graceful shutdown
async function shutdown(signal) {
    logger_js_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    (0, logger_js_1.logAudit)('Service shutdown initiated', { signal });
    // Stop accepting new connections
    const server = app.listen();
    server.close(async () => {
        logger_js_1.logger.info('HTTP server closed');
        // Close Redis
        if (redisClient) {
            try {
                await redisClient.quit();
                logger_js_1.logger.info('Redis connection closed');
            }
            catch (error) {
                logger_js_1.logger.error('Error closing Redis', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        // Close MongoDB
        try {
            await mongoose_1.default.connection.close();
            logger_js_1.logger.info('MongoDB connection closed');
        }
        catch (error) {
            logger_js_1.logger.error('Error closing MongoDB', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        logger_js_1.logger.info('Graceful shutdown complete');
        process.exit(0);
    });
    // Force exit after timeout
    setTimeout(() => {
        logger_js_1.logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
    }, 30000);
}
// Start server
async function startServer() {
    try {
        // Connect to databases
        await connectMongoDB();
        await connectRedis();
        // Start HTTP server
        const server = app.listen(PORT, () => {
            logger_js_1.logger.info('REZ Fraud Agent started', {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
            });
            (0, logger_js_1.logAudit)('Fraud agent service started', {
                port: PORT,
                environment: process.env.NODE_ENV,
            });
        });
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger_js_1.logger.error(`Port ${PORT} is already in use`);
                process.exit(1);
            }
            throw error;
        });
        // Graceful shutdown handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Unhandled rejection handler
        process.on('unhandledRejection', (reason, promise) => {
            logger_js_1.logger.error('Unhandled Rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                promise: String(promise),
            });
        });
        // Uncaught exception handler
        process.on('uncaughtException', (error) => {
            logger_js_1.logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack,
            });
            process.exit(1);
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}
// Start
startServer();
//# sourceMappingURL=index.js.map