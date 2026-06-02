/**
 * REZ Live Action Feed - Routes
 */
import { Router, Request, Response } from 'express';
import { getFeedService } from '../services/feedService.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = Router();
const service = getFeedService();

function resp(success: boolean, data?: any, error?: { code: string; message: string }) {
  return { success, ...(data && { data }), ...(error && { error }), meta: { timestamp: new Date().toISOString() } };
}
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);

router.use(tenantMiddleware());

// Feed Items
router.post('/feed', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const item = await service.addFeedItem(tenant_id!, req.body);
  res.status(201).json(resp(true, item));
}));

router.patch('/feed/:id', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const item = await service.updateFeedItem(tenant_id!, req.params.id, req.body);
  if (!item) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Feed item not found' })); return; }
  res.json(resp(true, item));
}));

router.get('/feed', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const { entity_id, agent_id, action_type, status, limit } = req.query;
  const feed = await service.getFeed(tenant_id!, { entityId: entity_id as string, agentId: agent_id as string, actionType: action_type as string, status: status as string, limit: parseInt(limit as string) || 50 });
  res.json(resp(true, feed));
}));

router.get('/feed/running', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const running = await service.getRunningActions(tenant_id!);
  res.json(resp(true, running));
}));

// Agents
router.get('/agents', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const agents = await service.getAgentStatuses(tenant_id!);
  res.json(resp(true, agents));
}));

router.post('/agents/register', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const { agent_id, name, type } = req.body;
  const agent = await service.registerAgent(tenant_id!, agent_id, name, type);
  res.status(201).json(resp(true, agent));
}));

router.delete('/agents/:agentId', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  await service.unregisterAgent(tenant_id!, req.params.agentId);
  res.json(resp(true, { unregistered: true }));
}));

// Stats
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const entityId = req.query.entity_id as string;
  const stats = await service.getStats(tenant_id!, entityId);
  res.json(resp(true, stats));
}));

export default router;
