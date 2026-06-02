const Joi = require('joi');

const sendNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  templateId: Joi.string(),
  category: Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'),
  channels: Joi.array().items(
    Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp')
  ).default(['fcm']),
  data: Joi.object().default({}),
  variables: Joi.object().default({}),
  priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
  scheduledFor: Joi.date().iso().greater('now'),
  idempotencyKey: Joi.string().max(255),
  metadata: Joi.object().default({}),
}).or('templateId', 'category');

const broadcastSchema = Joi.object({
  templateId: Joi.string().required(),
  category: Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'),
  channels: Joi.array().items(
    Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp')
  ).default(['fcm']),
  data: Joi.object().default({}),
  variables: Joi.object().default({}),
  priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
  scheduledFor: Joi.date().iso().greater('now'),
  filters: Joi.object().default({}),
  metadata: Joi.object().default({}),
});

const segmentSchema = Joi.object({
  segmentId: Joi.string().required(),
  templateId: Joi.string().required(),
  category: Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'),
  channels: Joi.array().items(
    Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp')
  ).default(['fcm']),
  data: Joi.object().default({}),
  variables: Joi.object().default({}),
  priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
  scheduledFor: Joi.date().iso().greater('now'),
  segmentQuery: Joi.object().default({}),
  metadata: Joi.object().default({}),
});

const preferencesUpdateSchema = Joi.object({
  channelPreferences: Joi.object().pattern(
    Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'),
    Joi.object({
      enabled: Joi.boolean(),
      tokens: Joi.any(),
    })
  ),
  quietHours: Joi.object({
    enabled: Joi.boolean(),
    startHour: Joi.number().min(0).max(23),
    startMinute: Joi.number().min(0).max(59),
    endHour: Joi.number().min(0).max(23),
    endMinute: Joi.number().min(0).max(59),
    timezone: Joi.string(),
    channelOverrides: Joi.object().pattern(Joi.string(), Joi.object({
      enabled: Joi.boolean(),
      startHour: Joi.number().min(0).max(23),
      startMinute: Joi.number().min(0).max(59),
      endHour: Joi.number().min(0).max(23),
      endMinute: Joi.number().min(0).max(59),
    })),
  }),
  categoryPreferences: Joi.object().pattern(
    Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'),
    Joi.object({
      enabled: Joi.boolean(),
      channels: Joi.array().items(
        Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp')
      ),
    })
  ),
  frequencyCaps: Joi.object().pattern(
    Joi.string().valid('all', 'fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp'),
    Joi.object({
      maxPerDay: Joi.number().min(0).max(1000),
      maxPerWeek: Joi.number().min(0).max(10000),
      maxPerMonth: Joi.number().min(0).max(50000),
    })
  ),
  globalOptOut: Joi.boolean(),
  optOutCategories: Joi.array().items(
    Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing')
  ),
  optOutTemplates: Joi.array().items(Joi.string()),
});

const templateSchema = Joi.object({
  templateId: Joi.string(),
  name: Joi.string().required(),
  description: Joi.string(),
  category: Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing').required(),
  channels: Joi.array().items(
    Joi.string().valid('fcm', 'apns', 'sms', 'email', 'whatsapp', 'inapp')
  ).min(1).required(),
  variants: Joi.array().items(
    Joi.object({
      variantId: Joi.string().required(),
      variantName: Joi.string().required(),
      weight: Joi.number().min(0).max(100).default(50),
      channels: Joi.object({
        fcm: Joi.object({
          title: Joi.string(),
          body: Joi.string(),
          image: Joi.string(),
          icon: Joi.string(),
          clickAction: Joi.string(),
        }),
        apns: Joi.object({
          title: Joi.string(),
          body: Joi.string(),
          image: Joi.string(),
          sound: Joi.string(),
          badge: Joi.number(),
          category: Joi.string(),
        }),
        sms: Joi.object({
          body: Joi.string(),
          maxLength: Joi.number(),
        }),
        email: Joi.object({
          subject: Joi.string(),
          htmlBody: Joi.string(),
          textBody: Joi.string(),
          fromName: Joi.string(),
        }),
        whatsapp: Joi.object({
          body: Joi.string(),
          templateName: Joi.string(),
          headerType: Joi.string(),
          headerContent: Joi.string(),
          footerText: Joi.string(),
          buttons: Joi.array(),
        }),
        inapp: Joi.object({
          title: Joi.string(),
          body: Joi.string(),
          image: Joi.string(),
          actionUrl: Joi.string(),
          actionText: Joi.string(),
          duration: Joi.number(),
          position: Joi.string(),
        }),
      }).required(),
    })
  ).min(1).required(),
  abTestEnabled: Joi.boolean().default(false),
  abTestConfig: Joi.object({
    controlVariant: Joi.string(),
    testDuration: Joi.number(),
    minSampleSize: Joi.number(),
    successMetric: Joi.string().valid('open_rate', 'click_rate', 'conversion_rate', 'engagement'),
  }),
  defaultVariant: Joi.string(),
  tags: Joi.array().items(Joi.string()),
  status: Joi.string().valid('draft', 'active', 'paused', 'archived').default('draft'),
  metadata: Joi.object(),
});

const statsQuerySchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  category: Joi.string().valid('food', 'offers', 'alerts', 'orders', 'promotions', 'system', 'marketing'),
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }
    req.validatedBody = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }
    req.validatedQuery = value;
    next();
  };
}

module.exports = {
  sendNotificationSchema,
  broadcastSchema,
  segmentSchema,
  preferencesUpdateSchema,
  templateSchema,
  statsQuerySchema,
  validate,
  validateQuery,
};
