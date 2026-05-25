/**
 * REZ Care - Validation Schemas (Zod)
 *
 * Input validation for all API endpoints
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Date range filter
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * ID parameter
 */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Client ID parameter
 */
export const clientIdParamSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
});

// ============================================
// AUTH SCHEMAS
// ============================================

/**
 * Token verification
 */
export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * Login
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
});

// ============================================
// TICKET SCHEMAS
// ============================================

/**
 * Create ticket
 */
export const createTicketSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email').optional(),
  customerPhone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone').optional(),
  category: z.enum(['payment', 'delivery', 'product', 'technical', 'billing', 'refund', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  channel: z.enum(['whatsapp', 'sms', 'email', 'inapp', 'chat']).default('inapp'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Update ticket
 */
export const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Add message to ticket
 */
export const addMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file', 'link']),
    url: z.string().url('Invalid URL'),
    name: z.string().optional(),
  })).optional(),
});

// ============================================
// CUSTOMER 360 SCHEMAS
// ============================================

/**
 * Get customer context
 */
export const customerContextSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  includeTimeline: z.boolean().default(true),
  includePredictions: z.boolean().default(true),
  includeSegments: z.boolean().default(true),
});

/**
 * Timeline event
 */
export const timelineEventSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  eventType: z.enum(['ticket', 'chat', 'refund', 'payment', 'order', 'loyalty', 'delivery', 'support', 'compensation']),
  source: z.string().min(1, 'Source is required'),
  data: z.record(z.string(), z.unknown()),
  sentiment: z.number().min(-1).max(1).optional(),
  intent: z.string().optional(),
  category: z.string().optional(),
});

// ============================================
// CSAT SCHEMAS
// ============================================

/**
 * Submit CSAT survey
 */
export const submitCSATSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  rating: z.number().int().min(1).max(5),
  npsScore: z.number().int().min(0).max(10).optional(),
  cesScore: z.number().int().min(1).max(7).optional(),
  feedback: z.string().max(1000).optional(),
});

/**
 * Send CSAT survey
 */
export const sendCSATSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  templateId: z.string().optional(),
});

// ============================================
// AGENT SCHEMAS
// ============================================

/**
 * Create agent
 */
export const createAgentSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone').optional(),
  role: z.enum(['agent', 'senior_agent', 'team_lead', 'manager']).default('agent'),
  skills: z.array(z.string()).optional(),
  maxTickets: z.number().int().min(1).max(50).default(10),
  workingHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    timezone: z.string().default('Asia/Kolkata'),
  }).optional(),
});

/**
 * Update agent
 */
export const updateAgentSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['online', 'offline', 'busy', 'away']).optional(),
  role: z.enum(['agent', 'senior_agent', 'team_lead', 'manager']).optional(),
  skills: z.array(z.string()).optional(),
  maxTickets: z.number().int().min(1).max(50).optional(),
});

/**
 * Set agent status
 */
export const setAgentStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'busy', 'away']),
});

// ============================================
// SUBSCRIPTION SCHEMAS
// ============================================

/**
 * Create subscription
 */
export const createSubscriptionSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  tier: z.enum(['lite', 'pro', 'enterprise']),
});

/**
 * Upgrade subscription
 */
export const upgradeSubscriptionSchema = z.object({
  tier: z.enum(['lite', 'pro', 'enterprise']),
});

/**
 * Change billing cycle
 */
export const changeBillingCycleSchema = z.object({
  cycle: z.enum(['monthly', 'yearly']),
});

/**
 * Process refund
 */
export const processRefundSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * Record usage
 */
export const recordUsageSchema = z.object({
  tickets: z.number().int().min(0).optional(),
  agents: z.number().int().min(0).optional(),
  brands: z.number().int().min(0).optional(),
  apiCalls: z.number().int().min(0).optional(),
  storage: z.number().min(0).optional(),
});

// ============================================
// SELF-SERVICE SCHEMAS
// ============================================

/**
 * Execute self-service action
 */
export const executeActionSchema = z.object({
  actionType: z.enum([
    'retry_payment',
    'sync_wallet',
    'retry_cashback',
    'track_refund',
    'cancel_order',
    'modify_order',
    'add_to_wishlist',
    'update_profile',
  ]),
  orderId: z.string().optional(),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Report issue
 */
export const reportIssueSchema = z.object({
  category: z.enum(['payment', 'delivery', 'product', 'technical', 'other']),
  description: z.string().min(10).max(2000),
  orderId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file']),
    url: z.string().url(),
  })).optional(),
});

// ============================================
// AI SCHEMAS
// ============================================

/**
 * Get AI suggestion
 */
export const getAISuggestionSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  context: z.object({
    message: z.string().optional(),
    category: z.string().optional(),
    sentiment: z.number().min(-1).max(1).optional(),
    ticketId: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(['customer', 'agent', 'system']),
      content: z.string(),
      timestamp: z.string().datetime(),
    })).optional(),
  }),
});

/**
 * Trigger workflow
 */
export const triggerWorkflowSchema = z.object({
  workflowName: z.string().min(1, 'Workflow name is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  trigger: z.string().min(1, 'Trigger is required'),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Validate request body against schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError<T> } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}

/**
 * Create validation middleware
 */
export function validate<T>(schema: z.ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((e: z.ZodIssue) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'query') {
      req.query = result.data;
    } else {
      req.params = result.data;
    }

    next();
  };
}

export default {
  pagination: paginationSchema,
  dateRange: dateRangeSchema,
  verifyToken: verifyTokenSchema,
  login: loginSchema,
  createTicket: createTicketSchema,
  updateTicket: updateTicketSchema,
  addMessage: addMessageSchema,
  customerContext: customerContextSchema,
  timelineEvent: timelineEventSchema,
  submitCSAT: submitCSATSchema,
  sendCSAT: sendCSATSchema,
  createAgent: createAgentSchema,
  updateAgent: updateAgentSchema,
  setAgentStatus: setAgentStatusSchema,
  createSubscription: createSubscriptionSchema,
  upgradeSubscription: upgradeSubscriptionSchema,
  changeBillingCycle: changeBillingCycleSchema,
  processRefund: processRefundSchema,
  recordUsage: recordUsageSchema,
  executeAction: executeActionSchema,
  reportIssue: reportIssueSchema,
  getAISuggestion: getAISuggestionSchema,
  triggerWorkflow: triggerWorkflowSchema,
  validateBody,
  validate,
};
