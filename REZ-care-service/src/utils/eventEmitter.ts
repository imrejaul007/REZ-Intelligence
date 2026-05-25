/**
 * REZ Care Service - Event Emitter Utility
 *
 * Can be added to unknown service to emit events to REZ-care-service.
 * Usage: Import and call emitEvent() when issues occur.
 */

import axios from 'axios';

const REZ_CARE_URL = process.env.REZ_CARE_SERVICE_URL || 'http://localhost:4055';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

export type EventType =
  | 'payment_failed'
  | 'payment_success'
  | 'qr_scan_failed'
  | 'qr_scan_success'
  | 'app_error'
  | 'app_crash'
  | 'order_placed'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_issue'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_issue'
  | 'refund_initiated'
  | 'refund_completed'
  | 'complaint_received'
  | 'ticket_resolved'
  | 'ticket_created'
  | 'merchant_issue'
  | 'delivery_delay'
  | 'wallet_sync_error';

export interface CareEvent {
  eventType: EventType;
  timestamp: Date;
  customerId?: string;
  customerPhone?: string;
  merchantId?: string;
  orderId?: string;
  bookingId?: string;
  transactionId?: string;
  platform?: 'hotel' | 'restaurant' | 'retail' | 'delivery' | 'ecommerce';
  category?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Emit an event to REZ-care-service
 */
export async function emitCareEvent(event: CareEvent): Promise<boolean> {
  try {
    const response = await axios.post(`${REZ_CARE_URL}/api/events`, {
      eventType: event.eventType,
      data: {
        ...event,
        timestamp: event.timestamp || new Date()
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN
      },
      timeout: 5000
    });

    return response.data?.success === true;
  } catch (error) {
    console.warn('[CareEvent] Failed to emit event:', event.eventType, error.message);
    return false;
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Emit payment failed event
 */
export async function emitPaymentFailed(params: {
  customerId: string;
  customerPhone: string;
  merchantId?: string;
  orderId?: string;
  transactionId?: string;
  errorCode?: string;
  errorMessage?: string;
  amount?: number;
  platform?: string;
}) {
  return emitCareEvent({
    eventType: 'payment_failed',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    merchantId: params.merchantId,
    orderId: params.orderId,
    transactionId: params.transactionId,
    platform: params.platform as unknown,
    severity: params.amount && params.amount > 1000 ? 'high' : 'medium',
    description: params.errorMessage || `Payment failed: ${params.errorCode}`,
    metadata: {
      errorCode: params.errorCode,
      amount: params.amount
    }
  });
}

/**
 * Emit QR scan failed event
 */
export async function emitQRScanFailed(params: {
  customerId: string;
  customerPhone: string;
  merchantId: string;
  merchantName?: string;
  reason?: string;
  orderId?: string;
  platform?: string;
}) {
  return emitCareEvent({
    eventType: 'qr_scan_failed',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    merchantId: params.merchantId,
    orderId: params.orderId,
    platform: params.platform as unknown,
    severity: 'medium',
    description: `QR scan failed: ${params.reason || 'Unknown reason'}`,
    metadata: {
      merchantName: params.merchantName,
      reason: params.reason
    }
  });
}

/**
 * Emit app error event
 */
export async function emitAppError(params: {
  customerId?: string;
  customerPhone?: string;
  errorType: string;
  errorMessage: string;
  appVersion?: string;
  deviceInfo?: string;
  orderId?: string;
}) {
  return emitCareEvent({
    eventType: 'app_error',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    orderId: params.orderId,
    category: 'technical',
    severity: 'medium',
    description: `${params.errorType}: ${params.errorMessage}`,
    metadata: {
      appVersion: params.appVersion,
      deviceInfo: params.deviceInfo
    }
  });
}

/**
 * Emit order issue event
 */
export async function emitOrderIssue(params: {
  customerId: string;
  customerPhone: string;
  orderId: string;
  merchantId: string;
  issueType: 'delivery_delay' | 'wrong_item' | 'missing_item' | 'quality_issue' | 'other';
  description: string;
  platform?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  return emitCareEvent({
    eventType: 'order_issue',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    merchantId: params.merchantId,
    orderId: params.orderId,
    platform: params.platform as unknown,
    category: params.issueType,
    severity: params.severity || 'medium',
    description: params.description
  });
}

/**
 * Emit booking issue event
 */
export async function emitBookingIssue(params: {
  customerId: string;
  customerPhone: string;
  bookingId: string;
  merchantId: string;
  issueType: 'room_issue' | 'service_issue' | 'billing' | 'cancellation' | 'other';
  description: string;
  platform?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  return emitCareEvent({
    eventType: 'booking_issue',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    merchantId: params.merchantId,
    bookingId: params.bookingId,
    platform: 'hotel',
    category: params.issueType,
    severity: params.severity || 'high',
    description: params.description
  });
}

/**
 * Emit complaint received event
 */
export async function emitComplaint(params: {
  customerId: string;
  customerPhone: string;
  ticketId: string;
  description: string;
  platform?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) {
  return emitCareEvent({
    eventType: 'complaint_received',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    category: 'complaint',
    severity: params.severity || 'high',
    description: params.description,
    metadata: {
      ticketId: params.ticketId,
      platform: params.platform
    }
  });
}

/**
 * Emit refund initiated event
 */
export async function emitRefundInitiated(params: {
  customerId: string;
  customerPhone: string;
  orderId?: string;
  transactionId: string;
  amount: number;
  reason: string;
  platform?: string;
}) {
  return emitCareEvent({
    eventType: 'refund_initiated',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    orderId: params.orderId,
    transactionId: params.transactionId,
    platform: params.platform as unknown,
    category: 'refund',
    severity: params.amount > 5000 ? 'high' : 'medium',
    description: `Refund initiated: ₹${params.amount} - ${params.reason}`,
    metadata: {
      amount: params.amount,
      reason: params.reason
    }
  });
}

/**
 * Emit delivery delay event
 */
export async function emitDeliveryDelay(params: {
  customerId: string;
  customerPhone: string;
  orderId: string;
  merchantId: string;
  expectedTime: number; // minutes
  actualTime: number; // minutes
  platform?: string;
}) {
  const delay = params.actualTime - params.expectedTime;

  return emitCareEvent({
    eventType: 'delivery_delay',
    timestamp: new Date(),
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    merchantId: params.merchantId,
    orderId: params.orderId,
    platform: params.platform as unknown,
    category: 'delivery',
    severity: delay > 30 ? 'high' : 'medium',
    description: `Delivery delayed by ${delay} minutes`,
    metadata: {
      expectedTime: params.expectedTime,
      actualTime: params.actualTime,
      delayMinutes: delay
    }
  });
}

/**
 * Emit ticket resolved event
 */
export async function emitTicketResolved(params: {
  customerId: string;
  ticketId: string;
  resolution: string;
  resolvedBy: string;
  resolutionTime: number; // minutes
  csatScore?: number;
}) {
  return emitCareEvent({
    eventType: 'ticket_resolved',
    timestamp: new Date(),
    customerId: params.customerId,
    category: 'support',
    severity: 'low',
    description: `Ticket resolved: ${params.resolution}`,
    metadata: {
      ticketId: params.ticketId,
      resolvedBy: params.resolvedBy,
      resolutionTime: params.resolutionTime,
      csatScore: params.csatScore
    }
  });
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

/**
 * Express middleware to automatically emit events
 */
export function careEventMiddleware(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json to emit events on certain responses
  res.json = function(body) {
    // Emit payment failed
    if (req.path.includes('/payments') && res.statusCode >= 400) {
      emitPaymentFailed({
        customerId: req.body?.customerId || 'unknown',
        customerPhone: req.body?.phone || '',
        orderId: req.body?.orderId,
        transactionId: req.body?.transactionId,
        errorMessage: body?.message || 'Payment failed',
        errorCode: body?.code
      }).catch(() => {});
    }

    return originalJson(body);
  };

  next();
}
