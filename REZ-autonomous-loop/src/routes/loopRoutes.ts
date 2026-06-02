/**
 * REZ Autonomous Loop Service - Routes
 */
import { Router, Request, Response } from 'express';
import { getLoopService, AutonomousLoopEngine } from '../services/autonomousLoopEngine.js';
import { getLoopScheduler } from '../services/scheduler.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = Router();
const loopService = getLoopService();

function resp(success: boolean, data?: any, error?: { code: string; message: string }) {
  return { success, ...(data && { data }), ...(error && { error }), meta: { timestamp: new Date().toISOString() } };
}
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: any) => Promise.resolve(fn(req, res)).catch(next);

router.use(tenantMiddleware());

// CRUD
router.post('/loops', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const loop = await loopService.createLoop(tenant_id!, req.body);
  res.status(201).json(resp(true, loop));
}));

router.get('/loops', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const entityId = req.query.entity_id as string;
  const loops = await loopService.getLoops(tenant_id!, entityId);
  res.json(resp(true, loops));
}));

router.get('/loops/:id', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const loop = await loopService.getLoop(tenant_id!, req.params.id);
  if (!loop) { res.status(404).json(resp(false, undefined, { code: 'NOT_FOUND', message: 'Loop not found' })); return; }
  res.json(resp(true, loop));
}));

router.post('/loops/:id/pause', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  await loopService.pauseLoop(tenant_id!, req.params.id);
  res.json(resp(true, { paused: true }));
}));

router.post('/loops/:id/resume', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  await loopService.resumeLoop(tenant_id!, req.params.id);
  res.json(resp(true, { resumed: true }));
}));

router.post('/loops/:id/run', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const engine = new AutonomousLoopEngine(tenant_id!, req.params.id);
  const result = await engine.executeCycle();
  res.json(resp(true, result));
}));

router.delete('/loops/:id', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  await loopService.deleteLoop(tenant_id!, req.params.id);
  res.json(resp(true, { deleted: true }));
}));

// Decisions
router.get('/decisions/pending', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const decisions = await loopService.getPendingDecisions(tenant_id!);
  res.json(resp(true, decisions));
}));

router.post('/decisions/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id, user_id } = req.tenantContext || {};
  await loopService.approveDecision(tenant_id!, req.params.id, user_id || 'system');
  res.json(resp(true, { approved: true }));
}));

router.post('/decisions/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  await loopService.rejectDecision(tenant_id!, req.params.id);
  res.json(resp(true, { rejected: true }));
}));

// Activity Feed
router.get('/activity', asyncHandler(async (req: Request, res: Response) => {
  const { tenant_id } = req.tenantContext || {};
  const entityId = req.query.entity_id as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const feed = await loopService.getActivityFeed(tenant_id!, entityId, limit);
  res.json(resp(true, feed));
}));

// Scheduler status
router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.json(resp(true, { running: getLoopScheduler().isActive() }));
});

router.post('/scheduler/start', (_req: Request, res: Response) => {
  getLoopScheduler().start();
  res.json(resp(true, { started: true }));
});

router.post('/scheduler/stop', (_req: Request, res: Response) => {
  getLoopScheduler().stop();
  res.json(resp(true, { stopped: true }));
});

export default router;
