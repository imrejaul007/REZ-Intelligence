import { Router, Request, Response } from 'express';
import { complianceService } from '../services/compliance';
import { AuditFilter } from '../types/audit.types';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as import('../types/audit.types').AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';

    const status = await complianceService.checkCompliance(filter);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check compliance' });
  }
});

router.get('/report', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as import('../types/audit.types').AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';

    const report = await complianceService.getComplianceReport(filter);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate compliance report' });
  }
});

router.get('/frameworks', async (req: Request, res: Response) => {
  try {
    const frameworks = complianceService.getFrameworks();
    res.json({ success: true, data: frameworks });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve frameworks' });
  }
});

router.get('/frameworks/:id', async (req: Request, res: Response) => {
  try {
    const framework = complianceService.getFramework(req.params.id);
    if (!framework) {
      return res.status(404).json({ success: false, error: 'Framework not found' });
    }
    res.json({ success: true, data: framework });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve framework' });
  }
});

router.patch('/frameworks/:frameworkId/requirements/:requirementId', async (req: Request, res: Response) => {
  try {
    const { frameworkId, requirementId } = req.params;
    const { checked } = req.body;

    if (typeof checked !== 'boolean') {
      return res.status(400).json({ success: false, error: 'checked must be a boolean' });
    }

    const success = complianceService.updateRequirement(frameworkId, requirementId, checked);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Framework or requirement not found' });
    }

    const framework = complianceService.getFramework(frameworkId);
    res.json({ success: true, data: framework });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update requirement' });
  }
});

router.post('/frameworks', async (req: Request, res: Response) => {
  try {
    const framework = req.body;
    complianceService.addFramework(framework);
    res.status(201).json({ success: true, data: framework });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create framework' });
  }
});

router.delete('/frameworks/:id', async (req: Request, res: Response) => {
  try {
    const success = complianceService.removeFramework(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Framework not found' });
    }
    res.json({ success: true, message: 'Framework deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete framework' });
  }
});

export default router;
