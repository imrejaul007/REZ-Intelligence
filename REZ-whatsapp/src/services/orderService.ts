import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';
import { Session, ISession } from '../models/Session';
import { WhatsAppOrder, OrderStatus, OrderCreateInput, CartItem, SessionState } from '../types/whatsapp';
import { logger } from '../utils/logger.js';

// Mock order model - in production, this would be in a separate model file
interface IOrder extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  orderId: string;
  sessionId: string;
  userId: string;
  merchantId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  deliveryAddress?: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  paymentLink?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  twilioOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

const OrderSchema = new mongoose.Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    merchantId: { type: String, required: true, index: true },
    items: { type: [], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    deliveryAddress: {
      name: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    paymentLink: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    twilioOrderId: String,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export interface OrderResult {
  success: boolean;
  order?: IOrder;
  error?: string;
}

export interface DeliveryTracking {
  orderId: string;
  status: OrderStatus;
  estimatedDelivery?: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  driver?: {
    name: string;
    phone: string;
    photoUrl?: string;
  };
  timeline: Array<{
    status: string;
    timestamp: Date;
    description: string;
  }>;
}

export class OrderService {
  private paymentServiceUrl: string;
  private deliveryServiceUrl: string;
  private readonly CURRENCY = 'INR';

  constructor(options?: {
    paymentServiceUrl?: string;
    deliveryServiceUrl?: string;
  }) {
    this.paymentServiceUrl = options?.paymentServiceUrl || process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
    this.deliveryServiceUrl = options?.deliveryServiceUrl || process.env.DELIVERY_SERVICE_URL || 'http://localhost:4009';
  }

  /**
   * Create order from cart
   */
  async createOrder(input: OrderCreateInput): Promise<OrderResult> {
    const session = await Session.findOne({ sessionId: input.sessionId });
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.context.cart.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    const orderId = this.generateOrderId();

    // Calculate totals
    const subtotal = session.getCartTotal();
    const metadata: Record<string, unknown> = {};
    if (session.metadata instanceof Map) {
      session.metadata.forEach((value, key) => {
        metadata[key] = value;
      });
    } else {
      Object.assign(metadata, session.metadata);
    }
    const discount = (metadata.discountAmount as number) || 0;
    const deliveryFee = this.calculateDeliveryFee(subtotal - discount);
    const total = subtotal - discount + deliveryFee;

    const order = await Order.create({
      orderId,
      sessionId: input.sessionId,
      userId: session.userId,
      merchantId: input.merchantId,
      items: session.context.cart,
      subtotal,
      discount,
      deliveryFee,
      total,
      status: OrderStatus.PENDING,
      deliveryAddress: input.deliveryAddress,
      paymentStatus: 'pending',
      metadata: {
        ...input.metadata,
        source: 'whatsapp',
      },
    });

    // Update session state
    session.state = SessionState.PAYMENT_PENDING;
    session.context.currentOrder = {
      id: orderId,
      status: OrderStatus.PENDING,
    };
    session.lastActivity = new Date();
    await session.save();

    // Clear cart after order creation
    session.clearCart();
    await session.save();

    logger.info('Order created', {
      orderId,
      userId: session.userId,
      merchantId: input.merchantId,
      total,
    });

    return { success: true, order };
  }

  /**
   * Generate payment link for order
   */
  async generatePaymentLink(orderId: string): Promise<{ success: boolean; paymentLink?: string; error?: string }> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.paymentStatus === 'paid') {
      return { success: false, error: 'Order already paid' };
    }

    const PAYMENT_TIMEOUT_MS = 10000; // 10 second timeout for payment service

    try {
      // Call payment service to create Razorpay order
      const response = await axios.post(
        `${this.paymentServiceUrl}/api/payments/create`,
        {
          orderId: order.orderId,
          amount: order.total * 100, // Convert to paisa
          currency: this.CURRENCY,
          customerPhone: order.deliveryAddress?.phone || '',
          metadata: {
            source: 'whatsapp',
            orderId: order.orderId,
          },
        },
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: PAYMENT_TIMEOUT_MS,
        }
      );

      const paymentLink = response.data.paymentLink || response.data.shortUrl;

      if (paymentLink) {
        order.paymentLink = paymentLink;
        await order.save();

        logger.info('Payment link generated', { orderId, paymentLink });
        return { success: true, paymentLink };
      }

      logger.error('Payment link not returned from service', { orderId, response: response.data });
      return { success: false, error: 'Failed to generate payment link - no link returned' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific timeout error
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        logger.error('Payment service timeout', { orderId, error: errorMessage });
        return { success: false, error: 'Payment service timed out. Please try again.' };
      }

      logger.error('Failed to generate payment link', {
        orderId,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });

      // NOTE: Removed silent fallback to mock payment link in production
      // This ensures we don't return success when the actual operation failed
      // Uncomment the following lines ONLY for local development:
      // const mockPaymentLink = `https://rzp.io/i/${orderId}`;
      // order.paymentLink = mockPaymentLink;
      // await order.save();
      // return { success: true, paymentLink: mockPaymentLink };

      return { success: false, error: `Failed to generate payment link: ${errorMessage}` };
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<IOrder | null> {
    return Order.findOne({ orderId });
  }

  /**
   * Get order by session
   */
  async getOrderBySession(sessionId: string): Promise<IOrder | null> {
    return Order.findOne({ sessionId }).sort({ createdAt: -1 });
  }

  /**
   * Get user orders
   */
  async getUserOrders(
    userId: string,
    options?: {
      merchantId?: string;
      status?: OrderStatus;
      page?: number;
      limit?: number;
    }
  ): Promise<{ orders: IOrder[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { userId };
    if (options?.merchantId) {
      query.merchantId = options.merchantId;
    }
    if (options?.status) {
      query.status = options.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return { orders, total };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderResult> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Validate status transition
    const validTransitions = this.getValidStatusTransitions(order.status as OrderStatus);
    if (!validTransitions.includes(status)) {
      return {
        success: false,
        error: `Invalid status transition from ${order.status} to ${status}`,
      };
    }

    order.status = status;
    await order.save();

    // Update session if exists
    await Session.updateOne(
      { sessionId: order.sessionId },
      {
        $set: {
          'context.currentOrder.status': status,
          lastActivity: new Date(),
        },
      }
    );

    logger.info('Order status updated', {
      orderId,
      newStatus: status,
    });

    return { success: true, order };
  }

  /**
   * Confirm payment
   */
  async confirmPayment(
    orderId: string,
    paymentDetails: {
      razorpayPaymentId: string;
      razorpayOrderId: string;
      signature: string;
    }
  ): Promise<OrderResult> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.paymentStatus === 'paid') {
      return { success: false, error: 'Order already paid' };
    }

    const PAYMENT_TIMEOUT_MS = 10000; // 10 second timeout

    try {
      // Verify payment with payment service
      const response = await axios.post(
        `${this.paymentServiceUrl}/api/payments/verify`,
        {
          razorpayPaymentId: paymentDetails.razorpayPaymentId,
          razorpayOrderId: paymentDetails.razorpayOrderId,
          signature: paymentDetails.signature,
        },
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: PAYMENT_TIMEOUT_MS,
        }
      );

      if (response.data.valid) {
        order.paymentStatus = 'paid';
        order.status = OrderStatus.CONFIRMED;
        order.metadata = {
          ...order.metadata,
          paymentDetails,
        };
        await order.save();

        logger.info('Payment confirmed', {
          orderId,
          paymentId: paymentDetails.razorpayPaymentId,
        });

        return { success: true, order };
      }

      logger.warn('Payment verification returned invalid', {
        orderId,
        paymentId: paymentDetails.razorpayPaymentId,
        response: response.data,
      });
      return { success: false, error: 'Payment verification failed - invalid response' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Payment verification request failed', {
        orderId,
        paymentId: paymentDetails.razorpayPaymentId,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });

      // CRITICAL FIX: Return failure instead of silently accepting payment
      // This prevents fraud where verification is bypassed
      // Uncomment the following ONLY for local development when payment service is unavailable:
      // if (process.env.NODE_ENV === 'development') {
      //   logger.warn('DEV MODE: Accepting payment without verification', { orderId });
      //   order.paymentStatus = 'paid';
      //   order.status = OrderStatus.CONFIRMED;
      //   await order.save();
      //   return { success: true, order };
      // }

      return {
        success: false,
        error: `Payment verification failed: ${errorMessage}. Please try again or contact support.`
      };
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    orderId: string,
    reason?: string
  ): Promise<OrderResult> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Can only cancel pending or confirmed orders
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status as OrderStatus)) {
      return {
        success: false,
        error: `Cannot cancel order with status: ${order.status}`,
      };
    }

    // If payment was made, initiate refund
    if (order.paymentStatus === 'paid') {
      await this.initiateRefund(orderId);
    }

    order.status = OrderStatus.CANCELLED;
    order.metadata = {
      ...order.metadata,
      cancellationReason: reason,
      cancelledAt: new Date(),
    };
    await order.save();

    logger.info('Order cancelled', {
      orderId,
      reason,
    });

    return { success: true, order };
  }

  /**
   * Get delivery tracking
   */
  async getDeliveryTracking(orderId: string): Promise<DeliveryTracking | null> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return null;
    }

    // If not out for delivery, return basic info
    if (![OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED].includes(order.status as OrderStatus)) {
      return {
        orderId: order.orderId,
        status: order.status as OrderStatus,
        timeline: [
          {
            status: order.status,
            timestamp: order.createdAt,
            description: this.getStatusDescription(order.status as OrderStatus),
          },
        ],
      };
    }

    const DELIVERY_TIMEOUT_MS = 8000; // 8 second timeout for delivery service

    try {
      // Call delivery service for real-time tracking
      const response = await axios.get(
        `${this.deliveryServiceUrl}/api/delivery/track/${orderId}`,
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: DELIVERY_TIMEOUT_MS,
        }
      );

      // Validate response has required fields
      if (!response.data) {
        logger.warn('Empty delivery tracking response', { orderId });
        return this.buildFallbackTracking(order);
      }

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get delivery tracking', {
        orderId,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });

      // Fallback to mock tracking data - acceptable for tracking since
      // it provides basic status info without blocking the user
      return this.buildFallbackTracking(order);
    }
  }

  /**
   * Build fallback tracking data when delivery service is unavailable
   */
  private buildFallbackTracking(order: IOrder): DeliveryTracking {
    return {
      orderId: order.orderId,
      status: order.status as OrderStatus,
      estimatedDelivery: new Date(Date.now() + 30 * 60 * 1000), // 30 mins from now
      timeline: [
        {
          status: OrderStatus.CONFIRMED,
          timestamp: order.createdAt,
          description: 'Order confirmed',
        },
        {
          status: OrderStatus.PREPARING,
          timestamp: new Date(order.createdAt.getTime() + 10 * 60 * 1000),
          description: 'Preparing your order',
        },
        {
          status: OrderStatus.OUT_FOR_DELIVERY,
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          description: 'Driver is on the way',
        },
        {
          status: order.status as OrderStatus,
          timestamp: new Date(),
          description: this.getStatusDescription(order.status as OrderStatus),
        },
      ],
    };
  }

  /**
   * Request refund
   */
  async initiateRefund(orderId: string): Promise<{ success: boolean; refundId?: string; error?: string }> {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.paymentStatus !== 'paid') {
      return { success: false, error: 'Order was not paid' };
    }

    if (order.status === OrderStatus.REFUNDED) {
      return { success: false, error: 'Order already refunded' };
    }

    const REFUND_TIMEOUT_MS = 15000; // 15 second timeout for refund

    try {
      const response = await axios.post(
        `${this.paymentServiceUrl}/api/payments/refund`,
        {
          orderId: order.orderId,
          amount: order.total * 100,
          reason: 'Customer requested cancellation',
        },
        {
          headers: {
            'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          },
          timeout: REFUND_TIMEOUT_MS,
        }
      );

      // Validate refund response
      if (!response.data || !response.data.refundId) {
        logger.error('Refund response missing refundId', { orderId, response: response.data });
        return { success: false, error: 'Refund initiated but refund ID not returned' };
      }

      const refundId = response.data.refundId;

      order.status = OrderStatus.REFUNDED;
      order.paymentStatus = 'refunded';
      order.metadata = {
        ...order.metadata,
        refundId,
      };
      await order.save();

      logger.info('Refund initiated', {
        orderId,
        refundId,
      });

      return { success: true, refundId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to initiate refund', {
        orderId,
        error: errorMessage,
        errorCode: (error as { code?: string }).code,
      });

      // Return actual error instead of generic message
      return {
        success: false,
        error: `Failed to initiate refund: ${errorMessage}. Please try again or contact support.`
      };
    }
  }

  // Helper methods

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomInt(10000).toString(16).toUpperCase().padStart(4, '0');
    return `WA${timestamp}${random}`;
  }

  private calculateDeliveryFee(subtotal: number): number {
    // Free delivery above 499 INR
    if (subtotal >= 499) return 0;
    // 40 INR standard delivery
    return 40;
  }

  private getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    return transitions[currentStatus] || [];
  }

  private getStatusDescription(status: OrderStatus): string {
    const descriptions: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Order placed, awaiting confirmation',
      [OrderStatus.CONFIRMED]: 'Order confirmed',
      [OrderStatus.PREPARING]: 'Preparing your order',
      [OrderStatus.READY]: 'Order ready for pickup',
      [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Order cancelled',
      [OrderStatus.REFUNDED]: 'Refund processed',
    };

    return descriptions[status] || status;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(merchantId?: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
    avgOrderValue: number;
  }> {
    const matchStage: Record<string, unknown> = {};
    if (merchantId) {
      matchStage.merchantId = merchantId;
    }
    matchStage.paymentStatus = 'paid';

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    const byStatus: Record<string, number> = {};
    let totalRevenue = 0;
    let totalOrders = 0;

    stats.forEach((s) => {
      byStatus[s._id] = s.count;
      totalRevenue += s.revenue;
      totalOrders += s.count;
    });

    return {
      totalOrders,
      totalRevenue,
      byStatus,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }
}

export default OrderService;
