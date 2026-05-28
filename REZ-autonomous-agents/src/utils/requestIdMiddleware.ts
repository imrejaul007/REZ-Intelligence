import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
}

export function requestIdMiddleware(options: RequestIdOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  const { header = 'x-request-id', generator = uuidv4 } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    let requestId = req.headers[header] as string | undefined;

    if (!requestId) {
      requestId = generator();
    }

    req.headers[header] = requestId;
    res.setHeader(header, requestId);

    next();
  };
}
