import { Router, Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { AuditEventType, AuditFilter } from '../types/audit.types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const event = await auditService.logEvent(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to log event' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';
    if (req.query.correlationId) filter.correlationId = req.query.correlationId as string;
    if (req.query.limit) filter.limit = parseInt(req.query.limit as string, 10);
    if (req.query.offset) filter.offset = parseInt(req.query.offset as string, 10);

    const events = await auditService.getEvents(filter);
    const total = await auditService.getEventCount(filter);

    res.json({ success: true, data: events, total, filter });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve events' });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';

    const summary = await auditService.getEventsSummary(filter);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve summary' });
  }
});

router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const events = await auditService.getRecentEvents(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve recent events' });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const events = await auditService.getEventsByUser(req.params.userId, limit);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve user events' });
  }
});

router.get('/resource/:resource', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const events = await auditService.getEventsByResource(req.params.resource, limit);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve resource events' });
  }
});

router.get('/type/:type', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const eventType = req.params.type as AuditEventType;
    const events = await auditService.getEventsByType(eventType, limit);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve events by type' });
  }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';
    if (req.query.limit) filter.limit = parseInt(req.query.limit as string, 10);

    const report = await auditService.generateReport(filter);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await auditService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve event' });
  }
});

router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const daysOld = parseInt(req.query.days as string, 10) || 30;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const deletedCount = await auditService.deleteEventsOlderThan(cutoffDate);
    res.json({ success: true, deleted: deletedCount, cutoffDate });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cleanup events' });
  }
});

export default router;
