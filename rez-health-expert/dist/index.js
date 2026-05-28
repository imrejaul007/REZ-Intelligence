"use strict";
/**
 * REZ Health Expert Agent
 * Main entry point with TypeScript, Zod validation, and proper error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.app = void 0;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const compression_1 = __importDefault(require("compression"));
const index_1 = require("./config/index");
const healthExpert_1 = require("./services/healthExpert");
const health_routes_1 = require("./routes/health.routes");
const validation_1 = require("./middleware/validation");
const index_2 = require("./types/index");
// ============================================
// CONFIGURATION VALIDATION
// ============================================
function loadConfig() {
    const result = index_1.configSchema.safeParse({
        port: process.env.PORT,
        nodeEnv: process.env.NODE_ENV,
        corsOrigins: process.env.ALLOWED_ORIGINS,
        rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
        rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
        logLevel: process.env.LOG_LEVEL
    });
    if (!result.success) {
        console.error('Configuration validation failed:', result.error.format());
        throw new index_2.ServiceError('Invalid configuration', 'CONFIG_ERROR', 1);
    }
    const data = result.data;
    return {
        port: data.port ?? 3011,
        nodeEnv: data.nodeEnv ?? 'development',
        corsOrigins: data.corsOrigins ?? ['http://localhost:3000'],
        rateLimitWindowMs: data.rateLimitWindowMs ?? 60000,
        rateLimitMaxRequests: data.rateLimitMaxRequests ?? 100,
        logLevel: data.logLevel ?? 'info',
        serviceName: 'rez-health-expert',
        version: '1.0.0'
    };
}
const config = loadConfig();
exports.config = config;
// ============================================
// APP INITIALIZATION
// ============================================
const app = (0, express_1.default)();
exports.app = app;
// ============================================
// SECURITY MIDDLEWARE
// ============================================
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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token']
}));
// Body parsing
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Compression
app.use((0, compression_1.default)());
// Request logging
app.use(validation_1.requestLogger);
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.body?.sessionId || req.ip || 'unknown';
    },
});
app.use('/api/', limiter);
// ============================================
// HEALTH CHECKS
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: config.serviceName,
        version: config.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.get('/health/detailed', (0, validation_1.asyncHandler)(async (req, res) => {
    const memoryUsage = process.memoryUsage();
    const healthData = {
        status: 'healthy',
        service: config.serviceName,
        version: config.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        process: {
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version
        }
    };
    res.json(healthData);
}));
app.get('/health/ready', (req, res) => {
    const checks = {
        initialized: true,
        memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024
    };
    const isReady = Object.values(checks).every(Boolean);
    res.status(isReady ? 200 : 503).json({
        ready: isReady,
        checks,
        timestamp: new Date().toISOString()
    });
});
// ============================================
// API ROUTES
// ============================================
app.use('/api/v1/health', health_routes_1.healthRouter);
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: config.serviceName,
        version: config.version,
        description: 'AI-powered health expert for symptom guidance, wellness tips, and appointment booking',
        endpoints: {
            health: 'GET /health',
            healthDetailed: 'GET /health/detailed',
            healthReady: 'GET /health/ready',
            chat: 'POST /api/v1/health/chat',
            symptom: 'POST /api/v1/health/symptom',
            appointment: 'POST /api/v1/health/appointment',
            wellness: 'GET /api/v1/health/wellness',
            glossary: 'GET /api/v1/health/glossary'
        }
    });
});
// ============================================
// ERROR HANDLING
// ============================================
app.use(validation_1.notFoundHandler);
app.use(validation_1.errorHandler);
// ============================================
// GRACEFUL SHUTDOWN
// ============================================
let server = null;
async function shutdown(signal) {
    healthExpert_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
        server.close(() => {
            healthExpert_1.logger.info('HTTP server closed');
        });
    }
    process.exit(0);
}
// ============================================
// SERVER STARTUP
// ============================================
function startServer() {
    try {
        server = app.listen(config.port, () => {
            healthExpert_1.logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                   REZ Health Expert Agent                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     Running                                         ║
║  Port:       ${String(config.port).padEnd(53)}║
║  Environment: ${config.nodeEnv.padEnd(45)}║
║  Log Level:  ${config.logLevel.padEnd(47)}║
╚═══════════════════════════════════════════════════════════════╝
      `);
            healthExpert_1.logger.info('API Endpoints:');
            healthExpert_1.logger.info('  POST /api/v1/health/chat         - Chat with health expert');
            healthExpert_1.logger.info('  POST /api/v1/health/symptom       - Get symptom guidance');
            healthExpert_1.logger.info('  POST /api/v1/health/appointment  - Book appointment');
            healthExpert_1.logger.info('  GET  /api/v1/health/wellness     - Get wellness tips');
            healthExpert_1.logger.info('  GET  /health                     - Health check');
        });
        // Graceful shutdown
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Unhandled rejection
        process.on('unhandledRejection', (reason) => {
            healthExpert_1.logger.error('Unhandled Rejection:', { reason });
        });
        // Uncaught exception
        process.on('uncaughtException', (error) => {
            healthExpert_1.logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }
    catch (error) {
        healthExpert_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start server if this is the main module
if (require.main === module || process.argv[1]?.endsWith('index.ts')) {
    startServer();
}
//# sourceMappingURL=index.js.map