/**
 * REZ Company Memory - Routes
 */
import { Router, Request, Response } from 'express';
import { getCompanyMemoryService } from '../services/companyMemoryService.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = Router();
const service = getCompanyMemoryService();

function resp(success: boolean, data?: any, error?: { code: string; message: string }) {
  return { success, ...(data && { data }), ...(error && { error }), meta: { timestamp: new Date().toISOString() } };
}
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);

router.use(tenantMiddleware());

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.create(tenant_id!, req.body);
  res.status(201).json(resp(true, memory));
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const entityType = req.query.entity_type as string;
  const memories = await service.getAllMemories(tenant_id!, entityType);
  res.json(resp(true, memories));
}));

router.get('/:entityId', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.get(tenant_id!, req.params.entityId);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.json(resp(true, memory));
}));

router.patch('/:entityId/metrics', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.updateMetrics(tenant_id!, req.params.entityId, req.body);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.json(resp(true, memory));
}));

router.post('/:entityId/goals', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.addGoal(tenant_id!, req.params.entityId, req.body);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.status(201).json(resp(true, memory));
}));

router.patch('/:entityId/goals/:goalId', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.updateGoalProgress(tenant_id!, req.params.entityId, req.params.goalId, req.body.progress);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.json(resp(true, memory));
}));

router.post('/:entityId/decisions', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.recordDecision(tenant_id!, req.params.entityId, req.body);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.status(201).json(resp(true, memory));
}));

router.patch('/:entityId/health', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const memory = await service.updateHealthScore(tenant_id!, req.params.entityId, req.body.score);
  if (!memory) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Company memory not found' })); return; }
  res.json(resp(true, memory));
}));

router.post('/:entityId/knowledge', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const knowledge = await service.addKnowledge(tenant_id!, req.params.entityId, req.body);
  res.status(201).json(resp(true, knowledge));
}));

router.get('/:entityId/knowledge', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const category = req.query.category as string;
  const knowledge = category
    ? await service.getKnowledge(tenant_id!, req.params.entityId, category)
    : await service.getKnowledge(tenant_id!, req.params.entityId);
  res.json(resp(true, knowledge));
}));

router.get('/:entityId/events', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const limit = parseInt(req.query.limit as string) || 50;
  const events = await service.getEvents(tenant_id!, req.params.entityId, limit);
  res.json(resp(true, events));
}));

export default router;
