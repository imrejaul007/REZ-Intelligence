"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.internalAuth = internalAuth;
exports.authenticateAny = authenticateAny;
exports.optionalAuth = optionalAuth;
exports.generateUserToken = generateUserToken;
exports.generateServiceToken = generateServiceToken;
exports.verifyToken = verifyToken;
exports.requestId = requestId;
exports.requireRole = requireRole;
exports.userRateLimit = userRateLimit;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
/**
 * Authentication middleware for user requests
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authorization header is required',
            },
        });
        return;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN_FORMAT',
                message: 'Authorization header must be in format: Bearer <token>',
            },
        });
        return;
    }
    const token = parts[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        req.userId = decoded.userId;
        req.agentId = decoded.agentId;
        req.isInternal = decoded.type === 'service';
        next();
    }
    catch (error) {
        logger_1.logger.warn('JWT verification failed', { error });
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired',
                },
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token',
                },
            });
            return;
        }
        res.status(401).json({
            success: false,
            error: {
                code: 'AUTHENTICATION_FAILED',
                message: 'Authentication failed',
            },
        });
    }
}
/**
 * Internal service authentication middleware
 */
function internalAuth(req, res, next) {
    const internalToken = req.headers['x-internal-token'];
    if (!internalToken) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Internal token is required',
            },
        });
        return;
    }
    const tokens = (0, config_1.getInternalServiceTokens)();
    const serviceName = req.headers['x-service-name'];
    // Verify token matches service name
    const expectedToken = tokens[serviceName];
    if (!expectedToken || expectedToken !== internalToken) {
        logger_1.logger.warn('Invalid internal token', { serviceName });
        res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_SERVICE_TOKEN',
                message: 'Invalid internal service token',
            },
        });
        return;
    }
    req.isInternal = true;
    req.agentId = serviceName;
    next();
}
/**
 * Combined auth middleware - accepts either user JWT or internal token
 */
function authenticateAny(req, res, next) {
    // Try internal auth first
    const internalToken = req.headers['x-internal-token'];
    const serviceName = req.headers['x-service-name'];
    if (internalToken && serviceName) {
        const tokens = (0, config_1.getInternalServiceTokens)();
        const expectedToken = tokens[serviceName];
        if (expectedToken && expectedToken === internalToken) {
            req.isInternal = true;
            req.agentId = serviceName;
            next();
            return;
        }
    }
    // Fall back to user JWT auth
    authenticate(req, res, next);
}
/**
 * Optional authentication - doesn't fail if no token provided
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        next();
        return;
    }
    authenticate(req, res, next);
}
/**
 * Generate a JWT token for a user
 */
function generateUserToken(userId, agentId, expiresIn) {
    const payload = {
        userId,
        agentId,
        type: 'user',
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, {
        expiresIn: expiresIn || config_1.config.JWT_EXPIRES_IN,
    });
}
/**
 * Generate a service token for internal service communication
 */
function generateServiceToken(serviceName) {
    const payload = {
        userId: `service:${serviceName}`,
        type: 'service',
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, {
        expiresIn: '24h',
    });
}
/**
 * Verify a token without middleware
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
    }
    catch {
        return null;
    }
}
/**
 * Request ID middleware - adds unique ID to each request
 */
function requestId(req, res, next) {
    const id = req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
}
/**
 * Role-based access control middleware factory
 */
function requireRole(...roles) {
    return (req, res, next) => {
        // This would be expanded with actual role checking
        // For now, just pass through
        next();
    };
}
/**
 * Rate limiting by user ID
 */
function userRateLimit() {
    return (req, res, next) => {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User authentication required',
                },
            });
            return;
        }
        next();
    };
}
exports.default = {
    authenticate,
    internalAuth,
    authenticateAny,
    optionalAuth,
    generateUserToken,
    generateServiceToken,
    verifyToken,
    requestId,
    requireRole,
    userRateLimit,
};
//# sourceMappingURL=auth.js.map