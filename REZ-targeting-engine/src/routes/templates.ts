import { Router, Request, Response } from 'express';
import { adTemplateService } from '../services';
import { asyncHandler, NotFoundError } from '../middleware';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  z
} from '../schemas';
import { TemplateContent, TemplateDesign } from '../types';

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate with Zod
    const parsedBody = CreateTemplateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    const template = await adTemplateService.createTemplate({
      name: parsedBody.data.name,
      channel: parsedBody.data.channel,
      content: parsedBody.data.content as TemplateContent,
      design: parsedBody.data.design as TemplateDesign | undefined,
      targeting: parsedBody.data.targeting
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
  asyncHandler(async (req: Request, res: Response) => {
    // Parse query params
    const parsedQuery = listQuery.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid query parameters', details: parsedQuery.error.errors }
      });
    }

    const { channel, is_active, limit, offset } = parsedQuery.data;

    const result = await adTemplateService.listTemplates({
      channel,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      limit,
      offset
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
          limit: limit ?? 20,
          offset: offset ?? 0
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
        channels: Object.entries(templates).map(([ch, channelTemplates]) => ({
          channel: ch,
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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    const template = await adTemplateService.getTemplate(parsedParams.data.id);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = UpdateTemplateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    // Build update input with proper types
    const updateInput: {
      name?: string;
      content?: TemplateContent;
      design?: TemplateDesign;
      targeting?: { min_age?: number; max_age?: number; preferred_segments?: string[] };
      is_active?: boolean;
    } = {};

    if (parsedBody.data.name !== undefined) updateInput.name = parsedBody.data.name;
    if (parsedBody.data.content !== undefined) updateInput.content = parsedBody.data.content as TemplateContent;
    if (parsedBody.data.design !== undefined) updateInput.design = parsedBody.data.design as TemplateDesign;
    if (parsedBody.data.targeting !== undefined) updateInput.targeting = parsedBody.data.targeting;
    if (parsedBody.data.is_active !== undefined) updateInput.is_active = parsedBody.data.is_active;

    const template = await adTemplateService.updateTemplate(parsedParams.data.id, updateInput);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    const deleted = await adTemplateService.deleteTemplate(parsedParams.data.id);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = personalizeBody.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    const personalized = await adTemplateService.personalizeContent(
      parsedParams.data.id,
      parsedBody.data.user_data || {}
    );

    if (!personalized) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: {
        template_id: parsedParams.data.id,
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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = renderBody.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    const result = await adTemplateService.renderForChannel(parsedParams.data.id, parsedBody.data.channel);

    res.json({
      success: result.success,
      data: {
        template_id: parsedParams.data.id,
        channel: parsedBody.data.channel,
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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = templateIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = duplicateBody.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    const template = await adTemplateService.duplicateTemplate(parsedParams.data.id, parsedBody.data.new_name);

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
