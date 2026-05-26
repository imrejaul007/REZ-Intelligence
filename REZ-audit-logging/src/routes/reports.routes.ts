import { Router, Request, Response } from 'express';
import { reportsService } from '../services/reports';
import { AuditFilter } from '../types/audit.types';

const router = Router();

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = reportsService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve templates' });
  }
});

router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = reportsService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve template' });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const template = reportsService.createTemplate(req.body);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = reportsService.updateTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const success = reportsService.deleteTemplate(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const reports = reportsService.getScheduledReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve scheduled reports' });
  }
});

router.get('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const report = reportsService.getScheduledReport(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Scheduled report not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve scheduled report' });
  }
});

router.post('/scheduled', async (req: Request, res: Response) => {
  try {
    const report = reportsService.createScheduledReport(req.body);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create scheduled report' });
  }
});

router.patch('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const report = reportsService.updateScheduledReport(req.params.id, req.body);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Scheduled report not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update scheduled report' });
  }
});

router.delete('/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const success = reportsService.deleteScheduledReport(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Scheduled report not found' });
    }
    res.json({ success: true, message: 'Scheduled report deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete scheduled report' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = req.body.filter || {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as import('../types/audit.types').AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';
    if (req.query.limit) filter.limit = parseInt(req.query.limit as string, 10);

    const report = await reportsService.generateReport(filter);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

router.post('/generate/from-template/:templateId', async (req: Request, res: Response) => {
  try {
    const report = await reportsService.generateReportFromTemplate(req.params.templateId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate report from template' });
  }
});

router.get('/executive-summary', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as import('../types/audit.types').AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';

    const summary = await reportsService.generateExecutiveSummary(filter);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate executive summary' });
  }
});

router.get('/security', async (req: Request, res: Response) => {
  try {
    const filter: AuditFilter = {};

    if (req.query.startDate) filter.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filter.endDate = new Date(req.query.endDate as string);
    if (req.query.eventTypes) filter.eventTypes = (req.query.eventTypes as string).split(',') as import('../types/audit.types').AuditEventType[];
    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.resource) filter.resource = req.query.resource as string;
    if (req.query.status) filter.status = req.query.status as 'success' | 'failure' | 'warning';

    const securityReport = await reportsService.generateSecurityReport(filter);
    res.json({ success: true, data: securityReport });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate security report' });
  }
});

export default router;
