"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const logger_js_1 = require("./utils/logger.js");
// Import routes
const memory_routes_1 = __importDefault(require("./routes/memory.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const personalization_routes_1 = __importDefault(require("./routes/personalization.routes"));
// Import middleware
const auth_js_1 = require("./middleware/auth.js");
// Import services
const memoryService_1 = require("./services/memoryService");
const sessionService_1 = require("./services/sessionService");
const contextService_1 = require("./services/contextService");
// Create Express app
const app = (0, express_1.default)();
exports.app = app;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: (0, config_1.getCorsOrigins)() }));
app.use((0, compression_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.RATE_LIMIT_WINDOW,
    max: config_1.config.RATE_LIMIT_MAX,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Request ID middleware
app.use(auth_js_1.requestId);
// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
    const mongoStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        success: true,
        data: {
            service: config_1.config.SERVICE_NAME,
            status: 'healthy',
            timestamp: new Date(),
            dependencies: {
                mongodb: mongoStatus,
            },
        },
        meta: {
            timestamp: new Date(),
            requestId: req.requestId,
        },
    });
});
// Readiness check endpoint
app.get('/ready', async (req, res) => {
    try {
        // Check MongoDB connection
        await mongoose_1.default.connection.db?.admin().ping();
        res.json({
            success: true,
            data: {
                ready: true,
                timestamp: new Date(),
            },
            meta: {
                timestamp: new Date(),
                requestId: req.requestId,
            },
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_READY',
                message: 'Service dependencies not ready',
            },
        });
    }
});
// API routes
app.use('/api/memory', memory_routes_1.default);
app.use('/api/session', session_routes_1.default);
app.use('/api/personalization', personalization_routes_1.default);
// Internal API routes (for service-to-service communication)
app.use('/internal/memory', auth_js_1.internalAuth, memory_routes_1.default);
app.use('/internal/session', auth_js_1.internalAuth, session_routes_1.default);
app.use('/internal/personalization', auth_js_1.internalAuth, personalization_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
});
// Global error handler
app.use((err, req, res, _next) => {
    logger_js_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        requestId: req.requestId,
        path: req.path,
    });
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: config_1.isProduction ? 'An unexpected error occurred' : err.message,
        },
        meta: {
            timestamp: new Date(),
            requestId: req.requestId,
        },
    });
});
// Database connection
async function connectToMongoDB() {
    const mongoUri = (0, config_1.getMongoUri)();
    try {
        await mongoose_1.default.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger_js_1.logger.info('Connected to MongoDB', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });
        // Create indexes
        await createIndexes();
    }
    catch (error) {
        logger_js_1.logger.error('Failed to connect to MongoDB', { error });
        throw error;
    }
}
// Create database indexes
async function createIndexes() {
    try {
        // MongoDB indexes are defined in the schemas
        // This is a placeholder for any additional index creation
        logger_js_1.logger.info('Database indexes ready');
    }
    catch (error) {
        logger_js_1.logger.error('Failed to create indexes', { error });
    }
}
// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectToMongoDB();
        // Start Express server
        const server = app.listen(config_1.config.PORT, () => {
            logger_js_1.logger.info(`Server started`, {
                port: config_1.config.PORT,
                env: config_1.config.NODE_ENV,
                service: config_1.config.SERVICE_NAME,
            });
        });
        // Graceful shutdown
        const shutdown = async (signal) => {
            logger_js_1.logger.info(`Received ${signal}, starting graceful shutdown`);
            // Stop accepting new connections
            server.close(async () => {
                logger_js_1.logger.info('HTTP server closed');
                try {
                    // Close service connections
                    await sessionService_1.sessionService.close();
                    await contextService_1.contextService.close();
                    // Close MongoDB connection
                    await mongoose_1.default.connection.close();
                    logger_js_1.logger.info('MongoDB connection closed');
                    process.exit(0);
                }
                catch (error) {
                    logger_js_1.logger.error('Error during shutdown', { error });
                    process.exit(1);
                }
            });
            // Force shutdown after timeout
            setTimeout(() => {
                logger_js_1.logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger_js_1.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            logger_js_1.logger.error('Unhandled rejection', { reason });
            process.exit(1);
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to start server', { error });
        process.exit(1);
    }
}
// Scheduled tasks
function startScheduledTasks() {
    // Clean up expired memories every hour
    setInterval(async () => {
        try {
            await memoryService_1.memoryService.cleanupExpired();
        }
        catch (error) {
            logger_js_1.logger.error('Failed to cleanup expired memories', { error });
        }
    }, 60 * 60 * 1000); // 1 hour
    // Clean up stale sessions every 15 minutes
    setInterval(async () => {
        try {
            await sessionService_1.sessionService.cleanupStaleSessions();
        }
        catch (error) {
            logger_js_1.logger.error('Failed to cleanup stale sessions', { error });
        }
    }, 15 * 60 * 1000); // 15 minutes
    logger_js_1.logger.info('Scheduled tasks started');
}
// Start the server
if (require.main === module) {
    startServer();
    startScheduledTasks();
}
exports.default = app;
//# sourceMappingURL=index.js.map