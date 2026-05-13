"use strict";
/**
 * Authentication Middleware
 * Verifies internal service tokens for service-to-service communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSubscribe = exports.requirePublish = exports.requireAdmin = exports.Permission = void 0;
exports.verifyInternalToken = verifyInternalToken;
exports.requirePermission = requirePermission;
exports.optionalAuth = optionalAuth;
exports.addRequestId = addRequestId;
const config_1 = require("../config");
const logger_1 = require("../services/logger");
/**
 * Permission types
 */
var Permission;
(function (Permission) {
    Permission["READ"] = "read";
    Permission["WRITE"] = "write";
    Permission["PUBLISH"] = "publish";
    Permission["SUBSCRIBE"] = "subscribe";
    Permission["ADMIN"] = "admin";
})(Permission || (exports.Permission = Permission = {}));
/**
 * Service permissions mapping
 */
const SERVICE_PERMISSIONS = {
    'payment-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'wallet-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'order-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'notification-service': [Permission.READ, Permission.PUBLISH, Permission.SUBSCRIBE],
    'intent-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'merchant-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'identity-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
    'admin-panel': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE, Permission.ADMIN],
};
/**
 * Get permissions for a service
 */
function getServicePermissions(serviceName) {
    return SERVICE_PERMISSIONS[serviceName] || [Permission.READ, Permission.PUBLISH];
}
/**
 * Generate request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Verify internal service token
 */
function verifyInternalToken(req, res, next) {
    const token = req.headers['x-internal-token'];
    // Add request ID for tracing
    req.requestId = generateRequestId();
    if (!token) {
        logger_1.logger.warn('Missing internal token', {
            requestId: req.requestId,
            path: req.path,
            ip: req.ip,
        });
        res.status(401).json({
            error: 'Unauthorized',
            code: 'MISSING_TOKEN',
            message: 'X-Internal-Token header is required',
            requestId: req.requestId,
        });
        return;
    }
    // Look up service by token
    const serviceName = config_1.config.auth.internalServiceTokens[token];
    if (!serviceName) {
        logger_1.logger.warn('Invalid internal token', {
            requestId: req.requestId,
            path: req.path,
            ip: req.ip,
        });
        res.status(401).json({
            error: 'Unauthorized',
            code: 'INVALID_TOKEN',
            message: 'Invalid service token',
            requestId: req.requestId,
        });
        return;
    }
    // Set service info on request
    req.serviceInfo = {
        serviceName,
        permissions: getServicePermissions(serviceName),
    };
    logger_1.logger.debug('Service authenticated', {
        requestId: req.requestId,
        serviceName,
        permissions: req.serviceInfo.permissions,
    });
    next();
}
/**
 * Require specific permission
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.serviceInfo) {
            res.status(401).json({
                error: 'Unauthorized',
                code: 'NOT_AUTHENTICATED',
                message: 'Authentication required',
                requestId: req.requestId,
            });
            return;
        }
        if (!req.serviceInfo.permissions.includes(permission)) {
            logger_1.logger.warn('Insufficient permissions', {
                requestId: req.requestId,
                serviceName: req.serviceInfo.serviceName,
                requiredPermission: permission,
                currentPermissions: req.serviceInfo.permissions,
            });
            res.status(403).json({
                error: 'Forbidden',
                code: 'INSUFFICIENT_PERMISSIONS',
                message: `Required permission: ${permission}`,
                requestId: req.requestId,
            });
            return;
        }
        next();
    };
}
/**
 * Require admin permission
 */
exports.requireAdmin = requirePermission(Permission.ADMIN);
/**
 * Require publish permission
 */
exports.requirePublish = requirePermission(Permission.PUBLISH);
/**
 * Require subscribe permission
 */
exports.requireSubscribe = requirePermission(Permission.SUBSCRIBE);
/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
    const token = req.headers['x-internal-token'];
    req.requestId = generateRequestId();
    if (token) {
        const serviceName = config_1.config.auth.internalServiceTokens[token];
        if (serviceName) {
            req.serviceInfo = {
                serviceName,
                permissions: getServicePermissions(serviceName),
            };
        }
    }
    next();
}
/**
 * Add request ID to response headers
 */
function addRequestId(req, res, next) {
    if (!req.requestId) {
        req.requestId = generateRequestId();
    }
    res.setHeader('X-Request-Id', req.requestId);
    next();
}
exports.default = {
    verifyInternalToken,
    requirePermission,
    requireAdmin: exports.requireAdmin,
    requirePublish: exports.requirePublish,
    requireSubscribe: exports.requireSubscribe,
    optionalAuth,
    addRequestId,
};
//# sourceMappingURL=auth.js.map