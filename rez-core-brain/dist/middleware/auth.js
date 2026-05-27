"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
exports.authenticate = authenticate;
exports.internalAuth = internalAuth;
exports.authenticateAny = authenticateAny;
exports.createAuthMiddleware = createAuthMiddleware;
const logger_js_1 = require("../utils/logger.js");
const uuid_1 = require("uuid");
/**
 * Request ID middleware - adds unique request ID to each request
 */
function requestId(req, _res, next) {
    req.requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    next();
}
/**
 * Simple authentication middleware (no-op for backward compatibility)
 */
function authenticate(_req, _res, next) {
    next();
}
/**
 * Internal auth middleware (no-op for backward compatibility)
 */
function internalAuth(_req, _res, next) {
    next();
}
/**
 * Any auth middleware (no-op for backward compatibility)
 */
function authenticateAny(_req, _res, next) {
    next();
}
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