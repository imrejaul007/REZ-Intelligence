const { templateEngine } = require('../services');
const logger = require('../utils/logger');

class TemplateController {
  async create(req, res) {
    try {
      const validation = templateEngine.validateTemplate(req.validatedBody);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const template = await templateEngine.createTemplate(req.validatedBody);

      logger.info(`Template created: ${template.templateId}`);

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template',
        message: error.message,
      });
    }
  }

  async get(req, res) {
    try {
      const { templateId } = req.params;
      const template = await templateEngine.getTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get template',
      });
    }
  }

  async update(req, res) {
    try {
      const { templateId } = req.params;
      const template = await templateEngine.updateTemplate(templateId, req.validatedBody);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      logger.info(`Template updated: ${templateId}`);

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update template',
        message: error.message,
      });
    }
  }

  async delete(req, res) {
    try {
      const { templateId } = req.params;
      const template = await templateEngine.deleteTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      logger.info(`Template archived: ${templateId}`);

      res.json({
        success: true,
        data: template,
        message: 'Template archived',
      });
    } catch (error) {
      logger.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template',
      });
    }
  }

  async list(req, res) {
    try {
      const { category, status, channels, tags } = req.query;

      const templates = await templateEngine.listTemplates({
        category,
        status,
        channels: channels ? channels.split(',') : undefined,
        tags: tags ? tags.split(',') : undefined,
      });

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      logger.error('Error listing templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list templates',
      });
    }
  }

  async preview(req, res) {
    try {
      const { templateId } = req.params;
      const { userId, channel, variantId, variables } = req.body;

      const template = await templateEngine.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      const mockUser = {
        userId: userId || 'preview_user',
        name: 'Preview User',
        email: 'preview@example.com',
        phone: '+1234567890',
      };

      const rendered = templateEngine.renderTemplate(
        template,
        mockUser,
        variables || {},
        channel,
        variantId
      );

      if (!rendered) {
        return res.status(400).json({
          success: false,
          error: 'Failed to render template for the specified channel',
        });
      }

      res.json({
        success: true,
        data: {
          templateId,
          variantId: rendered.variantId,
          variantName: rendered.variantName,
          content: rendered,
        },
      });
    } catch (error) {
      logger.error('Error previewing template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to preview template',
      });
    }
  }

  async getABTestResults(req, res) {
    try {
      const { templateId } = req.params;
      const { Notification } = require('../models');

      const notifications = await Notification.find({
        templateId,
        status: { $in: ['sent', 'delivered', 'read'] },
      }).lean();

      const results = templateEngine.estimateABTestResults(notifications);

      res.json({
        success: true,
        data: {
          templateId,
          results,
        },
      });
    } catch (error) {
      logger.error('Error getting AB test results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get AB test results',
      });
    }
  }
}

const templateController = new TemplateController();

module.exports = templateController;
