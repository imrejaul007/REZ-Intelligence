"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthMiddleware = createAuthMiddleware;
const logger_js_1 = require("./utils/logger.js");
function createAuthMiddleware(config) {
    const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;
    return (req, res, next) => {
        const path = req.path;
        // Bypass health checks
        if (bypassPaths.some(p => path.startsWith(p))) {
            return next();
        }
        // Check API key
        const apiKey = req.headers['x-api-key'];
        if (apiKey && apiKeys.includes(apiKey)) {
            return next();
        }
        // Check internal token
        const internalToken = req.headers['x-internal-token'];
        if (internalToken && internalTokens.includes(internalToken)) {
            return next();
        }
        // No valid auth found
        logger_js_1.logger.warn('Unauthorized access attempt', {
            path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid API key or internal token required',
        });
    };
}
//# sourceMappingURL=auth.js.map