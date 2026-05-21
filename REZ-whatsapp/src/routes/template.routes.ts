import { Router, Response, NextFunction } from 'express';
import { validateInternalToken, AuthenticatedRequest } from '../middleware/auth';
import { TemplateManager } from '../services/templateManager';
import { CreateTemplateSchema, ApiResponse, TemplateStatus } from '../types/whatsapp';
import { logger } from '../utils/logger';

export function createTemplateRoutes(
  templateManager: TemplateManager
): Router {
  const router = Router();

  /**
   * GET /api/templates
   * List templates with filtering
   */
  router.get(
    '/',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const merchantId = req.query.merchantId as string;
        const status = req.query.status as TemplateStatus;
        const category = req.query.category as string;
        const language = req.query.language as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await templateManager.listTemplates({
          merchantId,
          status,
          category: category as any,
          language,
          page,
          limit,
        });

        const response: ApiResponse<{
          templates: unknown[];
          page: number;
          limit: number;
          total: number;
        }> = {
          success: true,
          data: {
            templates: result.templates,
            page: result.page,
            limit: result.limit,
            total: result.total,
          },
          meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to list templates', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/templates/:templateId
   * Get single template
   */
  router.get(
    '/:templateId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;

        const template = await templateManager.getTemplate(templateId);

        if (!template) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Template not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<unknown> = {
          success: true,
          data: template,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to get template', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/templates
   * Create new template
   */
  router.post(
    '/',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = CreateTemplateSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { name, category, language, components, merchantId, metadata } = validation.data;

        const template = await templateManager.createTemplate({
          name,
          category,
          language,
          components,
          merchantId,
          metadata,
        });

        logger.info('Template created via API', {
          templateId: template.templateId,
          name,
          category,
        });

        const response: ApiResponse<unknown> = {
          success: true,
          data: template,
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error('Failed to create template', { error });
        next(error);
      }
    }
  );

  /**
   * PUT /api/templates/:templateId
   * Update template
   */
  router.put(
    '/:templateId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;
        const updates = req.body;

        const template = await templateManager.updateTemplate(templateId, updates);

        if (!template) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Template not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<unknown> = {
          success: true,
          data: template,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to update template', { error });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/templates/:templateId
   * Delete template
   */
  router.delete(
    '/:templateId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;

        const deleted = await templateManager.deleteTemplate(templateId);

        if (!deleted) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Template not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<{ message: string }> = {
          success: true,
          data: {
            message: 'Template deleted successfully',
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to delete template', { error });
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'OPERATION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to delete template',
          },
        };
        res.status(400).json(response);
      }
    }
  );

  /**
   * POST /api/templates/:templateId/send
   * Send template message to a recipient
   */
  router.post(
    '/:templateId/send',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;
        const { to, variables, sessionId } = req.body;

        if (!to) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Recipient phone number (to) is required',
            },
          };
          res.status(400).json(response);
          return;
        }

        // Get template
        const template = await templateManager.getTemplate(templateId);
        if (!template) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Template not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        // Validate for sending
        const validation = templateManager.validateForSending(templateId);
        if (!validation.valid) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'TEMPLATE_NOT_READY',
              message: validation.errors.join(', '),
            },
          };
          res.status(400).json(response);
          return;
        }

        // Render template
        const rendered = templateManager.renderTemplate(
          template,
          variables || {}
        );

        // Note: Actual sending would be done via Twilio client
        // This is handled by the main WhatsApp routes
        logger.info('Template message prepared', {
          templateId,
          to,
          rendered: rendered.body,
        });

        const response: ApiResponse<{
          message: string;
          rendered: {
            body: string;
            header?: string;
            footer?: string;
          };
        }> = {
          success: true,
          data: {
            message: 'Template message prepared for sending',
            rendered: {
              body: rendered.body,
              header: rendered.header,
              footer: rendered.footer,
            },
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to send template', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/templates/:templateId/register
   * Register template with Twilio
   */
  router.post(
    '/:templateId/register',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;

        const template = await templateManager.registerWithTwilio(templateId);

        const response: ApiResponse<unknown> = {
          success: true,
          data: {
            message: 'Template registered with Twilio',
            template,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to register template with Twilio', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/templates/sync
   * Sync templates from Twilio
   */
  router.post(
    '/sync',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await templateManager.syncFromTwilio();

        const response: ApiResponse<{
          synced: number;
          errors: number;
        }> = {
          success: true,
          data: result,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to sync templates from Twilio', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/templates/stats
   * Get template statistics
   */
  router.get(
    '/stats',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const merchantId = req.query.merchantId as string;

        const stats = await templateManager.getStats(merchantId);

        const response: ApiResponse<{
          total: number;
          byStatus: Record<string, number>;
          byCategory: Record<string, number>;
        }> = {
          success: true,
          data: stats,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to get template stats', { error });
        next(error);
      }
    }
  );

  return router;
}

export default createTemplateRoutes;
