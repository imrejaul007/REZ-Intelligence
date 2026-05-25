import { Router, Request, Response } from 'express';
import { adTemplateService } from '../services';
import {
  asyncHandler,
  NotFoundError,
} from '../middleware';
import {
  validateRequest,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  z
} from '../schemas';

const router = Router();

// Param validation schemas
const templateIdParams = z.object({
  id: z.string().min(1),
});

const listQuery = z.object({
  channel: z.enum(['banner', 'push', 'in_app', 'sms', 'email']).optional(),
  is_active: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const personalizeBody = z.object({
  user_data: z.record(z.unknown()).optional(),
});

const renderBody = z.object({
  channel: z.enum(['banner', 'push', 'in_app', 'sms', 'email']),
});

const duplicateBody = z.object({
  new_name: z.string().min(1).max(100),
});

/**
 * POST /templates
 * Create a new ad template
 */
router.post(
  '/',
  validateRequest({ body: CreateTemplateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const template = await adTemplateService.createTemplate({
      name: req.body.name,
      channel: req.body.channel,
      content: req.body.content,
      design: req.body.design,
      targeting: req.body.targeting
    });

    res.status(201).json({
      success: true,
      data: {
        template_id: template.template_id,
        name: template.name,
        channel: template.channel,
        is_active: template.is_active,
        created_at: template.created_at
      },
      message: 'Template created successfully'
    });
  })
);

/**
 * GET /templates
 * List all templates with optional filtering
 */
router.get(
  '/',
  validateRequest({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { channel, is_active, limit, offset } = req.query;

    const result = await adTemplateService.listTemplates({
      channel: channel as unknown,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({
      success: true,
      data: {
        templates: result.templates.map(t => ({
          template_id: t.template_id,
          name: t.name,
          channel: t.channel,
          content: t.content,
          design: t.design,
          is_active: t.is_active,
          created_at: t.created_at,
          updated_at: t.updated_at
        })),
        pagination: {
          total: result.total,
          limit: limit ? parseInt(limit as string) : 20,
          offset: offset ? parseInt(offset as string) : 0
        }
      }
    });
  })
);

/**
 * GET /templates/channels
 * Get templates grouped by channel
 */
router.get(
  '/channels',
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await adTemplateService.getDefaultTemplates();

    res.json({
      success: true,
      data: {
        channels: Object.entries(templates).map(([channel, channelTemplates]) => ({
          channel,
          templates: channelTemplates.map(t => ({
            template_id: t.template_id,
            name: t.name,
            content: t.content
          }))
        }))
      }
    });
  })
);

/**
 * GET /templates/:id
 * Get template by ID
 */
router.get(
  '/:id',
  validateRequest({ params: templateIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const template = await adTemplateService.getTemplate(req.params.id);

    if (!template) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: {
        template: {
          template_id: template.template_id,
          name: template.name,
          channel: template.channel,
          content: template.content,
          design: template.design,
          targeting: template.targeting,
          is_active: template.is_active,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      }
    });
  })
);

/**
 * PATCH /templates/:id
 * Update template
 */
router.patch(
  '/:id',
  validateRequest({ params: templateIdParams, body: UpdateTemplateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const template = await adTemplateService.updateTemplate(req.params.id, {
      name: req.body.name,
      content: req.body.content,
      design: req.body.design,
      targeting: req.body.targeting,
      is_active: req.body.is_active
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: {
        template_id: template.template_id,
        name: template.name,
        is_active: template.is_active,
        updated_at: template.updated_at
      },
      message: 'Template updated successfully'
    });
  })
);

/**
 * DELETE /templates/:id
 * Delete (deactivate) template
 */
router.delete(
  '/:id',
  validateRequest({ params: templateIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await adTemplateService.deleteTemplate(req.params.id);

    if (!deleted) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      message: 'Template deactivated successfully'
    });
  })
);

/**
 * POST /templates/:id/personalize
 * Get personalized content for a template
 */
router.post(
  '/:id/personalize',
  validateRequest({ params: templateIdParams, body: personalizeBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const personalized = await adTemplateService.personalizeContent(
      req.params.id,
      req.body.user_data || {}
    );

    if (!personalized) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: {
        template_id: req.params.id,
        content: personalized
      }
    });
  })
);

/**
 * POST /templates/:id/render
 * Render template for a specific channel
 */
router.post(
  '/:id/render',
  validateRequest({ params: templateIdParams, body: renderBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { channel } = req.body;

    const result = await adTemplateService.renderForChannel(req.params.id, channel);

    res.json({
      success: result.success,
      data: {
        template_id: req.params.id,
        channel,
        rendered: result.rendered,
        ...(result.errors && { errors: result.errors })
      }
    });
  })
);

/**
 * POST /templates/:id/duplicate
 * Duplicate a template with a new name
 */
router.post(
  '/:id/duplicate',
  validateRequest({ params: templateIdParams, body: duplicateBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { new_name } = req.body;

    const template = await adTemplateService.duplicateTemplate(req.params.id, new_name);

    if (!template) {
      throw new NotFoundError('Template');
    }

    res.status(201).json({
      success: true,
      data: {
        template_id: template.template_id,
        name: template.name,
        channel: template.channel
      },
      message: 'Template duplicated successfully'
    });
  })
);

/**
 * POST /templates/init
 * Initialize default templates (for first-time setup)
 */
router.post(
  '/init',
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await adTemplateService.createDefaultTemplates();

    res.status(201).json({
      success: true,
      data: {
        created_count: templates.length,
        templates: templates.map(t => ({
          template_id: t.template_id,
          name: t.name,
          channel: t.channel
        }))
      },
      message: 'Default templates created successfully'
    });
  })
);

export default router;
