"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = void 0;
exports.verifyInternalToken = verifyInternalToken;
exports.requirePermission = requirePermission;
exports.createAuthMiddleware = createAuthMiddleware;
const logger_js_1 = require("../services/logger.js");
// Permission types
var Permission;
(function (Permission) {
    Permission["READ"] = "read";
    Permission["WRITE"] = "write";
    Permission["PUBLISH"] = "publish";
    Permission["SUBSCRIBE"] = "subscribe";
    Permission["ADMIN"] = "admin";
})(Permission || (exports.Permission = Permission = {}));
// Token validation helper
function validateInternalToken(token, validTokens) {
    return validTokens.includes(token);
}
// Middleware to verify internal service tokens
function verifyInternalToken(req, res, next) {
    const token = req.headers['x-internal-token'];
    if (!token) {
        res.status(401).json({ error: 'Internal token required' });
        return;
    }
    const config = req.app.get('config');
    if (!config) {
        res.status(500).json({ error: 'Server configuration error' });
        return;
    }
    const tokens = config.auth?.internalServiceTokens || {};
    const isValid = Object.values(tokens).includes(token);
    if (!isValid) {
        logger_js_1.logger.warn('Invalid internal token attempt', { path: req.path, ip: req.ip });
        res.status(401).json({ error: 'Invalid internal token' });
        return;
    }
    req.internalToken = token;
    next();
}
// Middleware factory to require specific permission
function requirePermission(permission) {
    return (req, res, next) => {
        // For internal service tokens, all permissions are granted
        const authReq = req;
        if (authReq.internalToken) {
            next();
            return;
        }
        // Check for API key with appropriate permissions
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            const config = req.app.get('config');
            // API keys have all permissions for now
            if (config?.auth?.apiKeys?.includes(apiKey)) {
                next();
                return;
            }
        }
        logger_js_1.logger.warn('Permission denied', { path: req.path, permission, ip: req.ip });
        res.status(403).json({ error: 'Permission denied' });
    };
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