"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthExpert = exports.startServer = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const health_routes_1 = require("./routes/health.routes");
const healthExpert_1 = require("./services/healthExpert");
Object.defineProperty(exports, "healthExpert", { enumerable: true, get: function () { return healthExpert_1.healthExpert; } });
const expertise_1 = require("./services/expertise");
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3011;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    healthExpert_1.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'rez-health-expert',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});
app.use('/api/v1/health', health_routes_1.healthRouter);
app.use((err, req, res, next) => {
    healthExpert_1.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
        }
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
});
const startServer = async () => {
    try {
        (0, expertise_1.validateEnv)();
        healthExpert_1.logger.info('REZ Health Expert starting...');
        app.listen(PORT, () => {
            healthExpert_1.logger.info(`REZ Health Expert started on port ${PORT}`, {
                port: PORT,
                env: process.env.NODE_ENV || 'development'
            });
        });
    }
    catch (error) {
        healthExpert_1.logger.error('Failed to start server', { error });
        process.exit(1);
    }
};
exports.startServer = startServer;
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=index.js.map