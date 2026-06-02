import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Middleware factory: validates that a named route param is a valid MongoDB ObjectId.
 * Rejects with 400 if the param is missing or not a valid ObjectId.
 *
 * @example
 * // Apply to a router
 * router.get('/:id', validateObjectIdParam('id'), myHandler);
 * router.get('/:merchantId/reviews', validateObjectIdParam('merchantId'), myHandler);
 *
 * @param paramName - The name of the req.params key to validate
 */
export function validateObjectIdParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      // Intentionally avoid returning the value to prevent ObjectId enumeration
      _res.status(400).json({ success: false, error: `Invalid ${paramName}` });
      return;
    }
    next();
  };
}
