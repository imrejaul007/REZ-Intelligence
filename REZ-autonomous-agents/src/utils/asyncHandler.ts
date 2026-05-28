import { Request, Response, NextFunction } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(
  fn: AsyncRequestHandler
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
