import { v4 as uuidv4 } from 'uuid';

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum RefundType {
  FULL = 'full',
  PARTIAL = 'partial',
  COMPENSATION = 'compensation',
  LOYALTY_CREDIT = 'loyalty_credit'
}

export enum RefundReason {
  CUSTOMER_REQUEST = 'customer_request',
  SERVICE_ISSUE = 'service_issue',
  PRODUCT_ISSUE = 'product_issue',
  DOUBLE_CHARGE = 'double_charge',
  WRONG_AMOUNT = 'wrong_amount',
  CANCELLATION = 'cancellation',
  NO_SHOW = 'no_show',
  EARLY_CHECKOUT = 'early_checkout',
  GOODWILL = 'goodwill',
  PROMOTIONAL = 'promotional'
}

export enum RefundMethod {
  ORIGINAL_PAYMENT = 'original_payment',
  STORE_CREDIT = 'store_credit',
  BANK_TRANSFER = 'bank_transfer',
  GIFT_CARD = 'gift_card'
}

export interface RefundRequest {
  id: string;
  displayId: string;
  orderId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  originalAmount: number;
  refundAmount: number;
  bonusAmount: number;
  totalRefund: number;
  refundType: RefundType;
  reason: RefundReason;
  description: string;
  refundMethod: RefundMethod;
  status: RefundStatus;
  evidence?: RefundEvidence;
  processedBy?: string;
  processedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  ticketId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundEvidence {
  screenshots?: string[];
  descriptions?: string[];
  emailThread?: string;
}

export interface RefundEligibility {
  eligible: boolean;
  refundAmount: number;
  bonusRefund: number;
  refundMethod: string;
  processingTime: string;
  reasons: string[];
  alternatives: string[];
  policyViolations: string[];
}

export interface RefundPolicy {
  name: string;
  refundableDays: number;
  cancellationFeePercent: number;
  processingDays: number;
  requiresEvidence: boolean;
  maxBonusPercent: number;
}

class RefundService {
  private refundRequests: Map<string, RefundRequest> = new Map();
  private refundCounter: number = 10000;

  private readonly REFUND_POLICIES: Record<string, RefundPolicy> = {
    'basic': {
      name: 'Standard Refund Policy',
      refundableDays: 30,
      cancellationFeePercent: 15,
      processingDays: 7,
      requiresEvidence: true,
      maxBonusPercent: 5
    },
    'premium': {
      name: 'Premium Refund Policy',
      refundableDays: 60,
      cancellationFeePercent: 10,
      processingDays: 5,
      requiresEvidence: true,
      maxBonusPercent: 10
    },
    'enterprise': {
      name: 'Enterprise Refund Policy',
      refundableDays: 90,
      cancellationFeePercent: 5,
      processingDays: 3,
      requiresEvidence: false,
      maxBonusPercent: 15
    }
  };

  private readonly PROCESSING_TIMES: Record<RefundMethod, string> = {
    [RefundMethod.ORIGINAL_PAYMENT]: '5-7 business days',
    [RefundMethod.STORE_CREDIT]: 'Instant',
    [RefundMethod.BANK_TRANSFER]: '3-5 business days',
    [RefundMethod.GIFT_CARD]: 'Instant'
  };

  getRefundEligibility(params: {
    orderId: string;
    customerId: string;
    totalSpent: number;
    totalTickets: number;
  }): RefundEligibility {
    const orderInfo = this.getOrderInfo(params.orderId);
    const policy = this.REFUND_POLICIES[orderInfo.tier] || this.REFUND_POLICIES['basic'];

    const reasons: string[] = [];
    const alternatives: string[] = [];
    const policyViolations: string[] = [];

    let eligible = true;
    let refundAmount = orderInfo.amount;
    let bonusRefund = 0;

    if (!orderInfo.exists) {
      eligible = false;
      reasons.push('Order not found in our system');
      policyViolations.push('Invalid order ID');
    }

    const daysSinceOrder = orderInfo.orderDate
      ? Math.floor((Date.now() - orderInfo.orderDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (orderInfo.exists && daysSinceOrder > policy.refundableDays) {
      eligible = false;
      reasons.push(`Refund window has expired. Our policy allows refunds within ${policy.refundableDays} days of purchase`);
      policyViolations.push(`Order is ${daysSinceOrder} days old, exceeds ${policy.refundableDays} day window`);
    }

    if (orderInfo.status === 'completed' && orderInfo.serviceDate) {
      const daysSinceService = Math.floor(
        (Date.now() - orderInfo.serviceDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceService > 7) {
        eligible = false;
        reasons.push('Service has already been provided and more than 7 days have passed');
        policyViolations.push('Post-service refund window expired');
      }
    }

    if (orderInfo.status === 'cancelled') {
      eligible = false;
      reasons.push('This order has already been cancelled');
      policyViolations.push('Order already cancelled');
      alternatives.push('Check your email for the original refund if applicable');
    }

    if (orderInfo.status === 'refunded') {
      eligible = false;
      reasons.push('A refund has already been processed for this order');
      policyViolations.push('Order already refunded');
    }

    if (eligible) {
      if (orderInfo.status === 'cancelled' || params.totalTickets > 3) {
        const cancellationFee = orderInfo.amount * (policy.cancellationFeePercent / 100);
        refundAmount = orderInfo.amount - cancellationFee;
      }

      if (params.totalTickets > 2 && params.totalSpent > 1000) {
        bonusRefund = refundAmount * (policy.maxBonusPercent / 100);
      }
    }

    if (eligible && refundAmount > 0) {
      alternatives.push('Store credit for faster processing');
      alternatives.push('Exchange for a different product/service');
    }

    return {
      eligible,
      refundAmount: Math.max(0, refundAmount),
      bonusRefund: Math.max(0, bonusRefund),
      refundMethod: this.determineRefundMethod(orderInfo.originalPaymentMethod),
      processingTime: policy.processingDays + ' business days',
      reasons,
      alternatives,
      policyViolations
    };
  }

  async createRefundRequest(params: {
    orderId: string;
    customerId: string;
    customerEmail: string;
    customerName: string;
    amount: number;
    reason: RefundReason;
    description: string;
    evidence?: RefundEvidence;
    ticketId?: string;
  }): Promise<RefundRequest> {
    const eligibility = this.getRefundEligibility({
      orderId: params.orderId,
      customerId: params.customerId,
      totalSpent: 0,
      totalTickets: 0
    });

    if (!eligibility.eligible) {
      throw new Error(`Refund not eligible: ${eligibility.reasons.join(', ')}`);
    }

    const refundRequest: RefundRequest = {
      id: uuidv4(),
      displayId: this.generateDisplayId(),
      orderId: params.orderId,
      customerId: params.customerId,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      originalAmount: params.amount,
      refundAmount: eligibility.refundAmount,
      bonusAmount: eligibility.bonusRefund,
      totalRefund: eligibility.refundAmount + eligibility.bonusRefund,
      refundType: eligibility.refundAmount === params.amount ? RefundType.FULL : RefundType.PARTIAL,
      reason: params.reason,
      description: params.description,
      refundMethod: eligibility.refundMethod as RefundMethod,
      status: RefundStatus.PENDING,
      evidence: params.evidence,
      ticketId: params.ticketId,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.refundRequests.set(refundRequest.id, refundRequest);

    return refundRequest;
  }

  async approveRefund(refundId: string, approvedBy: string): Promise<RefundRequest | null> {
    const refund = this.refundRequests.get(refundId);
    if (!refund) return null;

    if (refund.status !== RefundStatus.PENDING) {
      throw new Error(`Refund is not pending. Current status: ${refund.status}`);
    }

    refund.status = RefundStatus.APPROVED;
    refund.processedBy = approvedBy;
    refund.processedAt = new Date();
    refund.updatedAt = new Date();

    this.refundRequests.set(refundId, refund);
    return refund;
  }

  async processRefund(refundId: string): Promise<RefundRequest | null> {
    const refund = this.refundRequests.get(refundId);
    if (!refund) return null;

    if (refund.status !== RefundStatus.APPROVED) {
      throw new Error(`Refund must be approved before processing. Current status: ${refund.status}`);
    }

    refund.status = RefundStatus.PROCESSING;
    refund.updatedAt = new Date();

    this.refundRequests.set(refundId, refund);
    return refund;
  }

  async completeRefund(refundId: string, transactionId?: string): Promise<RefundRequest | null> {
    const refund = this.refundRequests.get(refundId);
    if (!refund) return null;

    if (refund.status !== RefundStatus.PROCESSING) {
      throw new Error(`Refund must be processing before completion. Current status: ${refund.status}`);
    }

    refund.status = RefundStatus.COMPLETED;
    refund.completedAt = new Date();
    refund.updatedAt = new Date();

    if (transactionId) {
      refund.metadata = { ...refund.metadata, transactionId };
    }

    this.refundRequests.set(refundId, refund);
    return refund;
  }

  async rejectRefund(refundId: string, reason: string, rejectedBy: string): Promise<RefundRequest | null> {
    const refund = this.refundRequests.get(refundId);
    if (!refund) return null;

    if (refund.status === RefundStatus.COMPLETED || refund.status === RefundStatus.REJECTED) {
      throw new Error(`Cannot reject a refund with status: ${refund.status}`);
    }

    refund.status = RefundStatus.REJECTED;
    refund.rejectionReason = reason;
    refund.processedBy = rejectedBy;
    refund.processedAt = new Date();
    refund.updatedAt = new Date();

    this.refundRequests.set(refundId, refund);
    return refund;
  }

  async cancelRefund(refundId: string, cancelledBy: string): Promise<RefundRequest | null> {
    const refund = this.refundRequests.get(refundId);
    if (!refund) return null;

    if ([RefundStatus.COMPLETED, RefundStatus.REJECTED, RefundStatus.CANCELLED].includes(refund.status)) {
      throw new Error(`Cannot cancel a refund with status: ${refund.status}`);
    }

    refund.status = RefundStatus.CANCELLED;
    refund.processedBy = cancelledBy;
    refund.processedAt = new Date();
    refund.updatedAt = new Date();

    this.refundRequests.set(refundId, refund);
    return refund;
  }

  getRefundRequest(refundId: string): RefundRequest | undefined {
    return this.refundRequests.get(refundId);
  }

  getRefundByDisplayId(displayId: string): RefundRequest | undefined {
    for (const refund of this.refundRequests.values()) {
      if (refund.displayId === displayId) {
        return refund;
      }
    }
    return undefined;
  }

  getRefundsByOrder(orderId: string): RefundRequest[] {
    return Array.from(this.refundRequests.values())
      .filter(r => r.orderId === orderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRefundsByCustomer(customerId: string): RefundRequest[] {
    return Array.from(this.refundRequests.values())
      .filter(r => r.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRefundsByStatus(status: RefundStatus): RefundRequest[] {
    return Array.from(this.refundRequests.values())
      .filter(r => r.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAllRefunds(): RefundRequest[] {
    return Array.from(this.refundRequests.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRefundStats(): {
    total: number;
    pending: number;
    approved: number;
    processing: number;
    completed: number;
    rejected: number;
    totalAmount: number;
    averageRefund: number;
  } {
    const refunds = this.getAllRefunds();

    return {
      total: refunds.length,
      pending: refunds.filter(r => r.status === RefundStatus.PENDING).length,
      approved: refunds.filter(r => r.status === RefundStatus.APPROVED).length,
      processing: refunds.filter(r => r.status === RefundStatus.PROCESSING).length,
      completed: refunds.filter(r => r.status === RefundStatus.COMPLETED).length,
      rejected: refunds.filter(r => r.status === RefundStatus.REJECTED).length,
      totalAmount: refunds
        .filter(r => r.status === RefundStatus.COMPLETED)
        .reduce((sum, r) => sum + r.totalRefund, 0),
      averageRefund: refunds.length > 0
        ? refunds.reduce((sum, r) => sum + r.totalRefund, 0) / refunds.length
        : 0
    };
  }

  private getOrderInfo(orderId: string): {
    exists: boolean;
    amount: number;
    status: string;
    tier: string;
    orderDate: Date | null;
    serviceDate: Date | null;
    originalPaymentMethod: string;
  } {
    const mockOrders: Record<string, { amount: number; status: string; tier: string; orderDate: Date; serviceDate?: Date }> = {
      'ORD-001': { amount: 299.99, status: 'completed', tier: 'basic', orderDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      'ORD-002': { amount: 599.99, status: 'completed', tier: 'premium', orderDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), serviceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      'ORD-003': { amount: 899.99, status: 'cancelled', tier: 'basic', orderDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
    };

    const order = mockOrders[orderId];
    if (!order) {
      return {
        exists: false,
        amount: 0,
        status: 'not_found',
        tier: 'basic',
        orderDate: null,
        serviceDate: null,
        originalPaymentMethod: 'credit_card'
      };
    }

    return {
      exists: true,
      amount: order.amount,
      status: order.status,
      tier: order.tier,
      orderDate: order.orderDate,
      serviceDate: order.serviceDate || null,
      originalPaymentMethod: 'credit_card'
    };
  }

  private determineRefundMethod(originalMethod: string): string {
    return this.PROCESSING_TIMES[RefundMethod.ORIGINAL_PAYMENT].includes('business')
      ? 'Original payment method'
      : 'Store credit';
  }

  private generateDisplayId(): string {
    this.refundCounter++;
    return `REF-${this.refundCounter}`;
  }
}

export const refundService = new RefundService();
export { RefundService };
