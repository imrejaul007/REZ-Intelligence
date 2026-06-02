import type { Request, Response, NextFunction } from 'express';

/**
 * API Versioning Middleware
 *
 * Validates the API version from the 'api-version' header.
 * Returns 400 if the requested version does not match the required version.
 *
 * Usage:
 *   import { apiVersion } from '@rez/shared';
 *   app.use('/api/v1', apiVersion('v1'));
 */
export function apiVersion(required: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version = (req.headers['api-version'] as string) || 'v1';
    if (version !== required) {
      res.status(400).json({
        success: false,
        error: {
          code: 'API_VERSION',
          message: `API version ${required} required. Received: ${version}`,
        },
      });
      return;
    }
    next();
  };
}

/**
 * Default API version for services that don't explicitly set a required version.
 * Allows requests with 'api-version' header set to 'v1' or without the header.
 */
export function defaultApiVersion() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set the version on request for downstream use
    (req as Request & { apiVersion: string }).apiVersion =
      (req.headers['api-version'] as string) || 'v1';
    next();
  };
}
