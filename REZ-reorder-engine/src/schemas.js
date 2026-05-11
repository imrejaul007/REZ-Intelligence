'use strict';

const { z } = require('zod');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const schemas = {
  createProfile: z.object({
    userId: z.string().regex(UUID_REGEX, 'Invalid userId format'),
    merchantId: z.string().regex(UUID_REGEX, 'Invalid merchantId format'),
    orderId: z.string(),
    items: z.array(z.object({
      itemId: z.string().optional(),
      productId: z.string().optional(),
      name: z.string(),
      quantity: z.number().int().min(1),
      price: z.number().min(0)
    })).optional(),
    orderValue: z.number().min(0).optional()
  }),

  reorderQuery: z.object({
    userId: z.string().regex(UUID_REGEX),
    threshold: z.coerce.number().min(0).max(1).default(0.5),
    limit: z.coerce.number().int().min(1).max(50).default(10)
  }),

  nudgeInteraction: z.object({
    nudgeId: z.string(),
    orderId: z.string().optional()
  })
};

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}

module.exports = {
  schemas,
  reorderSchemas: schemas,
  validate
};
