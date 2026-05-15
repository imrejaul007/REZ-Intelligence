import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function createAuthMiddleware(options?: {
  headerName?: string;
  requiredEnvVars?: string[];
}) {
  const headerName = options?.headerName || 'x-internal-token';
  const requiredEnvVars = options?.requiredEnvVars || ['INTERNAL_SERVICE_TOKEN'];

  return (req: Request, res: Response, next: NextFunction): void => {
    const publicPaths = ['/health', '/ready', '/metrics'];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    const token = req.headers[headerName.toLowerCase()] as string;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token required' });
      return;
    }

    const validToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!validToken) {
      res.status(500).json({ error: 'Server error', message: 'Auth not configured' });
      return;
    }

    try {
      if (
        token.length !== validToken.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(validToken))
      ) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
      return;
    }

    next();
  };
}
