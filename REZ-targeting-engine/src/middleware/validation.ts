/**
 * Validation middleware using express-validator
 * This file provides validation chains for API requests
 */

import { body, param, query, ValidationChain } from 'express-validator';

// Re-export validators
export { body, param, query };
export type { ValidationChain };

// Campaign validation rules
export const createCampaignValidation: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ max: 200 })
    .withMessage('Campaign name must be 200 characters or less'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),

  body('rules.targeting.user_segments')
    .isArray()
    .withMessage('Targeting segments must be an array'),

  body('rules.targeting.exclusions')
    .isArray()
    .withMessage('Exclusions must be an array'),

  body('rules.targeting.recency_days')
    .isInt({ min: 0 })
    .withMessage('Recency days must be a positive integer'),

  body('rules.targeting.min_orders')
    .isInt({ min: 0 })
    .withMessage('Minimum orders must be a non-negative integer'),

  body('rules.content.ad_template_id')
    .notEmpty()
    .withMessage('Ad template ID is required'),

  body('rules.content.fallback_offer')
    .notEmpty()
    .withMessage('Fallback offer is required'),

  body('rules.budget.daily_limit')
    .isFloat({ min: 0 })
    .withMessage('Daily budget must be a positive number'),

  body('rules.budget.cost_per_impression')
    .isFloat({ min: 0 })
    .withMessage('Cost per impression must be a positive number'),

  body('rules.scheduling.send_time')
    .isIn(['optimal', 'morning', 'afternoon', 'evening', 'night', 'specific'])
    .withMessage('Invalid send time value'),

  body('created_by')
    .notEmpty()
    .withMessage('Creator ID is required'),
];

export const updateCampaignValidation: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Campaign ID is required'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Campaign name must be 200 characters or less'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
];

export const campaignIdValidation: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Campaign ID is required'),
];

export const audiencePreviewValidation: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Campaign ID is required'),

  query('sample_size')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Sample size must be between 1 and 1000'),
];

export const triggerCampaignValidation: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Campaign ID is required'),

  body('user_contexts')
    .isArray()
    .withMessage('User contexts must be an array'),

  body('user_contexts.*.user_id')
    .notEmpty()
    .withMessage('Each user context must have a user_id'),
];

// Template validation rules
export const createTemplateValidation: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 200 })
    .withMessage('Template name must be 200 characters or less'),

  body('channel')
    .isIn(['banner', 'push', 'in_app', 'sms', 'email'])
    .withMessage('Invalid channel value'),

  body('content.body')
    .notEmpty()
    .withMessage('Template body is required')
    .isLength({ max: 500 })
    .withMessage('Template body must be 500 characters or less'),

  body('content.headline')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Headline must be 100 characters or less'),

  body('content.cta_text')
    .optional()
    .isLength({ max: 30 })
    .withMessage('CTA text must be 30 characters or less'),
];

export const templateIdValidation: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Template ID is required'),
];

export const listQueryValidation: ValidationChain[] = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),

  query('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),

  query('channel')
    .optional()
    .isIn(['banner', 'push', 'in_app', 'sms', 'email'])
    .withMessage('Invalid channel filter'),
];
