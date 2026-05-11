'use strict';

const helmet = require('helmet');
const { ValidationError } = require('./errorHandler');
const logger = require('./logger');

const mongoSanitize = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/[\$\.]/g, '_');
};

const sanitizeInput = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[mongoSanitize(key)] = sanitizeInput(value);
  }
  return sanitized;
};

const ssrfProtection = (allowedHosts = []) => {
  return (req, res, next) => {
    const url = req.body?.url || req.query?.url;
    if (!url) return next();

    try {
      const parsed = new URL(url);

      if (['127.0.0.1', 'localhost', '0.0.0.0', '::1'].includes(parsed.hostname)) {
        return next(new ValidationError('SSRF attempt detected: internal hosts not allowed'));
      }

      if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) {
        return next(new ValidationError('SSRF attempt detected: host not in whitelist'));
      }

      if (['http:', 'https:'].indexOf(parsed.protocol) === -1) {
        return next(new ValidationError('Invalid protocol in URL'));
      }

      const ip = parsed.hostname;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        const octets = ip.split('.').map(Number);
        if (octets[0] === 10 || octets[0] === 172 || (octets[0] === 192 && octets[1] === 168)) {
          return next(new ValidationError('SSRF attempt detected: private IP range'));
        }
      }
    } catch (e) {
      return next(new ValidationError('Invalid URL format'));
    }

    next();
  };
};

const inputValidation = (schema) => {
  return (req, res, next) => {
    try {
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
      req.params = sanitizeInput(req.params);
      next();
    } catch (e) {
      next(new ValidationError('Input sanitization failed'));
    }
  };
};

const authFailureLogger = () => {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        logger.warn('Authentication/Authorization failure', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent']
        });
      }
      return originalSend.call(this, data);
    };
    next();
  };
};

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

module.exports = {
  helmet: securityHeaders,
  sanitizeInput,
  inputValidation,
  ssrfProtection,
  authFailureLogger
};
