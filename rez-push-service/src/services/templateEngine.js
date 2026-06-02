const Template = require('../models/Template');
const logger = require('../utils/logger');

class TemplateEngine {
  constructor() {
    this.variablePattern = /\{\{([^}]+)\}\}/g;
    this.personalizationPattern = /\{\{user\.([^}]+)\}\}/g;
    this.conditionalPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  }

  async getTemplate(templateId) {
    return Template.findOne({ templateId, status: 'active' });
  }

  async getTemplateByCategory(category) {
    return Template.findOne({ category, status: 'active' }).sort({ createdAt: -1 });
  }

  substituteVariables(text, variables) {
    if (!text || typeof text !== 'string') return text;

    return text.replace(this.variablePattern, (match, varName) => {
      const trimmedName = varName.trim();

      if (variables && variables.hasOwnProperty(trimmedName)) {
        const value = variables[trimmedName];
        return value !== undefined && value !== null ? String(value) : match;
      }

      return match;
    });
  }

  processPersonalization(text, user) {
    if (!text || typeof text !== 'string') return text;

    return text.replace(this.personalizationPattern, (match, property) => {
      const trimmedProp = property.trim();
      const value = this.getNestedValue(user, trimmedProp);
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  processConditionals(text, user, variables) {
    if (!text || typeof text !== 'string') return text;

    let result = text;

    result = result.replace(this.conditionalPattern, (match, condition, content) => {
      const isTruthy = this.evaluateCondition(condition.trim(), user, variables);
      return isTruthy ? content : '';
    });

    return result;
  }

  getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }

    return value;
  }

  evaluateCondition(condition, user, variables) {
    const match = condition.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (!match) return !!this.getNestedValue(user, condition);

    const [, left, operator, right] = match;
    const leftValue = this.getNestedValue(user, left.trim()) ??
                      (variables && variables[left.trim()]);
    const rightValue = right.trim().replace(/['"]/g, '');

    switch (operator) {
      case '==':
        return String(leftValue) === rightValue;
      case '!=':
        return String(leftValue) !== rightValue;
      case '>':
        return Number(leftValue) > Number(rightValue);
      case '<':
        return Number(leftValue) < Number(rightValue);
      case '>=':
        return Number(leftValue) >= Number(rightValue);
      case '<=':
        return Number(leftValue) <= Number(rightValue);
      default:
        return !!leftValue;
    }
  }

  processTemplate(templateText, user, variables = {}) {
    let result = templateText;
    result = this.processPersonalization(result, user);
    result = this.substituteVariables(result, variables);
    result = this.processConditionals(result, user, variables);
    return result;
  }

  processContent(content, user, variables = {}) {
    if (typeof content === 'string') {
      return this.processTemplate(content, user, variables);
    }

    if (typeof content === 'object' && content !== null) {
      const processed = {};
      for (const [key, value] of Object.entries(content)) {
        processed[key] = this.processContent(value, user, variables);
      }
      return processed;
    }

    return content;
  }

  renderTemplate(template, user, variables = {}, channel = null, variantId = null) {
    if (!template) return null;

    const variant = variantId
      ? template.getVariant(variantId)
      : template.selectRandomVariant();

    if (!variant) return null;

    const channelContent = channel
      ? variant.channels?.[channel]
      : variant.channels;

    if (!channelContent) return null;

    return {
      ...this.processContent(channelContent, user, variables),
      variantId: variant.variantId,
      variantName: variant.variantName,
    };
  }

  renderForChannel(template, user, channel, variables = {}) {
    if (!template) return null;

    const variant = template.selectRandomVariant();
    if (!variant) return null;

    const channelContent = variant.channels?.[channel];
    if (!channelContent) return null;

    return {
      ...this.processContent(channelContent, user, variables),
      variantId: variant.variantId,
      variantName: variant.variantName,
    };
  }

  async createTemplate(templateData) {
    const template = new Template({
      ...templateData,
      templateId: templateData.templateId || this.generateTemplateId(),
    });

    await template.save();
    logger.info(`Template created: ${template.templateId}`);
    return template;
  }

  async updateTemplate(templateId, updates) {
    const template = await Template.findOneAndUpdate(
      { templateId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (template) {
      logger.info(`Template updated: ${templateId}`);
    }
    return template;
  }

  async deleteTemplate(templateId) {
    const template = await Template.findOneAndUpdate(
      { templateId },
      { $set: { status: 'archived' } },
      { new: true }
    );

    if (template) {
      logger.info(`Template archived: ${templateId}`);
    }
    return template;
  }

  async listTemplates(filters = {}) {
    const query = { status: { $ne: 'archived' } };

    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.channels) query.channels = { $in: filters.channels };
    if (filters.tags) query.tags = { $in: filters.tags };

    return Template.find(query).sort({ createdAt: -1 }).lean();
  }

  generateTemplateId() {
    return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateTemplate(template) {
    const errors = [];

    if (!template.templateId) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.category) errors.push('Template category is required');
    if (!template.channels || template.channels.length === 0) {
      errors.push('At least one channel is required');
    }
    if (!template.variants || template.variants.length === 0) {
      errors.push('At least one variant is required');
    }

    if (template.variants) {
      for (let i = 0; i < template.variants.length; i++) {
        const variant = template.variants[i];
        if (!variant.variantId) {
          errors.push(`Variant ${i}: variant ID is required`);
        }
        if (!variant.variantName) {
          errors.push(`Variant ${i}: variant name is required`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  estimateABTestResults(notifications) {
    const variantStats = {};

    for (const notification of notifications) {
      const variantId = notification.templateVariantId;
      if (!variantId) continue;

      if (!variantStats[variantId]) {
        variantStats[variantId] = {
          sent: 0,
          delivered: 0,
          read: 0,
          clicked: 0,
        };
      }

      variantStats[variantId].sent++;
      if (notification.status === 'delivered' || notification.status === 'read') {
        variantStats[variantId].delivered++;
      }
      if (notification.status === 'read') {
        variantStats[variantId].read++;
      }
    }

    const results = [];
    for (const [variantId, stats] of Object.entries(variantStats)) {
      results.push({
        variantId,
        ...stats,
        deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
        openRate: stats.delivered > 0 ? (stats.read / stats.delivered) * 100 : 0,
      });
    }

    return results;
  }
}

const templateEngine = new TemplateEngine();

module.exports = templateEngine;
