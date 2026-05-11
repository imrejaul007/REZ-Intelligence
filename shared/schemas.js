'use strict';

const { z } = require('zod');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const schemas = {
  userId: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  uuid: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10).max(15).regex(/^\+?[0-9]{10,15}$/, 'Invalid phone format'),

  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20)
  }),

  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),

  geoLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),

  userProfile: z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    phone: schemas.phone.optional(),
    name: z.string().min(1).max(100).optional(),
    metadata: z.record(z.any()).optional()
  }),

  address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100).optional(),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(100).default('India')
  }),

  orderItem: z.object({
    productId: schemas.uuid,
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    options: z.record(z.any()).optional()
  }),

  createOrderDto: z.object({
    userId: schemas.uuid,
    items: z.array(schemas.orderItem).min(1),
    shippingAddress: schemas.address,
    paymentMethod: z.enum(['wallet', 'razorpay', 'card']),
    couponCode: z.string().optional(),
    notes: z.string().max(500).optional()
  }),

  createBookingDto: z.object({
    userId: schemas.uuid,
    merchantId: schemas.uuid,
    serviceId: schemas.uuid.optional(),
    dateTime: z.string().datetime(),
    duration: z.number().int().min(15).max(480).optional(),
    guests: z.number().int().min(1).max(50).optional(),
    notes: z.string().max(500).optional()
  }),

  chatMessage: z.object({
    text: z.string().min(1).max(4000),
    sessionId: schemas.uuid,
    userId: schemas.uuid.optional(),
    metadata: z.record(z.any()).optional()
  }),

  intentQuery: z.object({
    text: z.string().min(1).max(1000),
    userId: schemas.uuid.optional(),
    context: z.record(z.any()).optional()
  }),

  intentEvent: z.object({
    userId: schemas.uuid,
    intent: z.string().min(1),
    confidence: z.number().min(0).max(1),
    entities: z.record(z.any()).optional(),
    sessionId: schemas.uuid.optional(),
    source: z.string().optional()
  }),

  activityEvent: z.object({
    userId: schemas.uuid,
    type: z.string().min(1),
    properties: z.record(z.any()).optional(),
    timestamp: z.string().datetime().optional()
  }),

  profileUnify: z.object({
    primaryUserId: schemas.uuid,
    mergeUserIds: z.array(schemas.uuid).min(1),
    strategy: z.enum(['email', 'phone', 'manual']).default('manual')
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

function validateAsync(schema, data) {
  return schema.safeParseAsync(data);
}

module.exports = {
  ...schemas,
  validate,
  validateAsync,
  schemas
};
