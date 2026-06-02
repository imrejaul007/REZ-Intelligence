import { Request, Response, NextFunction } from 'express';
export interface TenantContext { tenant_id: string; user_id?: string }
export function tenantMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const t = req.headers['x-tenant-id'] as string;
    const u = req.headers['x-user-id'] as string;
    if (!t && req.path !== '/health') { res.status(400).json({ success: false, error: { code: 'MISSING_TENANT' } }); return; }
    req.tenantContext = { tenant_id: t || 'default', user_id: u };
    if (u) req.userId = u;
    next();
  };
}
