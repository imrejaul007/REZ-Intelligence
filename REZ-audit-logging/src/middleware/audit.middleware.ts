import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../services/audit.service';

export interface AuditMiddlewareOptions {
  resource?: string;
  action?: string;
  eventType?: string;
}

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

interface UserInfo {
  id?: string;
  email?: string;
}

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const existingCorrelationId = req.headers['x-correlation-id'];
  const correlationIdValue = Array.isArray(existingCorrelationId) ? existingCorrelationId[0] : existingCorrelationId;

  if (correlationIdValue) {
    req.correlationId = correlationIdValue;
  } else {
    req.correlationId = uuidv4();
    res.setHeader('X-Correlation-Id', req.correlationId);
  }

  next();
};

export const auditAction = (options: AuditMiddlewareOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function(body) {
      const status = res.statusCode;
      let statusResult: 'success' | 'failure' | 'warning' = 'success';

      if (status >= 400 && status < 500) {
        statusResult = 'warning';
      } else if (status >= 500) {
        statusResult = 'failure';
      }

      const reqAny = req as unknown as { user?: UserInfo };
      const user = reqAny.user;

      auditService.logEvent({
        eventType: (options.eventType || 'api_call') as 'api_call',
        action: options.action || `${req.method} ${req.path}`,
        resource: options.resource || req.path.split('/')[1] || 'unknown',
        resourceId: req.params.id,
        userId: user?.id,
        userEmail: user?.email,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        status: statusResult,
        correlationId: req.correlationId,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: status,
        },
      }).catch(console.error);

      return originalSend.call(this, body);
    };

    next();
  };
};

export const auditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const reqAny = req as unknown as { user?: UserInfo };

  await auditService.logEvent({
    eventType: 'api_call',
    action: `${req.method} ${req.path}`,
    resource: req.path.split('/')[1] || 'unknown',
    resourceId: req.params.id,
    userId: reqAny.user?.id,
    userEmail: reqAny.user?.email,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    status: 'success',
    correlationId: req.correlationId,
    details: {
      method: req.method,
      path: req.path,
      query: req.query,
    },
  });

  next();
};
