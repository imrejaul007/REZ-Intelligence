/**
 * REZ Care Service - Self-Service Recovery Service
 *
 * Allows customers to fix common issues without contacting support.
 * Reduces support volume and improves resolution speed.
 */

import axios from 'axios';
import { SelfServiceAction, SelfServiceResult } from '../types';
import { logger } from '../utils/logger';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// Service URLs
const SERVICE_URLS = {
  payment: process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com',
  wallet: process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com',
  order: process.env.ORDER_SERVICE_URL || 'https://rez-order-service.onrender.com',
  qr: process.env.QR_SERVICE_URL || 'https://rez-qr-service.onrender.com',
  booking: process.env.BOOKING_SERVICE_URL || 'https://rez-booking-service.onrender.com',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
};

export class SelfServiceService {
  /**
   * Get available self-service actions for a customer
   */
  async getAvailableActions(customerId: string): Promise<SelfServiceAction[]> {
    const actions: SelfServiceAction[] = [];

    // Check cashback eligibility
    const cashbackStatus = await this.checkCashbackStatus(customerId);
    if (cashbackStatus.hasPending) {
      actions.push({
        id: 'cashback_retry',
        type: 'cashback_retry',
        title: 'Retry Missing Cashback',
        description: 'Retry crediting your pending cashback',
        eligible: true,
        actionData: { pendingCount: cashbackStatus.pendingCount }
      });
    }

    // Check payment retry eligibility
    const paymentStatus = await this.checkPaymentStatus(customerId);
    if (paymentStatus.hasFailedPayments) {
      actions.push({
        id: 'payment_retry',
        type: 'payment_retry',
        title: 'Retry Payment',
        description: 'Retry payment for your pending order',
        eligible: true,
        actionData: { orderId: paymentStatus.orderId }
      });
    }

    // Check refund eligibility
    const refundStatus = await this.checkRefundEligibility(customerId);
    if (refundStatus.data?.eligible) {
      actions.push({
        id: 'refund_check',
        type: 'refund_check',
        title: 'Check Refund Status',
        description: 'View your refund history and status',
        eligible: true,
        actionData: { refunds: refundStatus.data?.refunds }
      });
    }

    // Check wallet sync
    const walletStatus = await this.checkWalletSync(customerId);
    if (walletStatus.hasSyncIssue) {
      actions.push({
        id: 'wallet_sync',
        type: 'wallet_sync',
        title: 'Sync Wallet',
        description: 'Fix unknown missing balance or transactions',
        eligible: true
      });
    }

    // QR troubleshooting
    actions.push({
      id: 'qr_troubleshoot',
      type: 'qr_troubleshoot',
      title: 'QR Troubleshooting',
      description: 'Fix QR scan issues with step-by-step guide',
      eligible: true
    });

    // Booking reschedule (if applicable)
    const bookingStatus = await this.checkBookingStatus(customerId);
    if (bookingStatus.hasActiveBookings) {
      actions.push({
        id: 'booking_reschedule',
        type: 'booking_reschedule',
        title: 'Reschedule Booking',
        description: 'Modify your hotel or service booking',
        eligible: true,
        actionData: { bookings: bookingStatus.bookings }
      });
    }

    return actions;
  }

  /**
   * Execute a self-service action
   */
  async executeAction(
    customerId: string,
    actionType: string,
    actionData: Record<string, unknown>
  ): Promise<SelfServiceResult> {
    switch (actionType) {
      case 'cashback_retry':
        return this.retryCashback(customerId, actionData.transactionId);

      case 'payment_retry':
        return this.retryPayment(customerId, actionData.orderId);

      case 'refund_check':
        return this.checkRefundEligibility(customerId);

      case 'wallet_sync':
        return this.syncWallet(customerId);

      case 'qr_troubleshoot':
        return this.provideQRTroubleshooting(customerId);

      case 'booking_reschedule':
        return this.rescheduleBooking(customerId, actionData.bookingId, actionData.newDate);

      default:
        return {
          success: false,
          action: actionType,
          message: 'Unknown action type'
        };
    }
  }

  /**
   * Retry missing cashback
   */
  async retryCashback(customerId: string, transactionId?: string): Promise<SelfServiceResult> {
    try {
      const response = await axios.post(
        `${SERVICE_URLS.wallet}/api/wallet/retry-cashback`,
        {
          customerId,
          transactionId
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );

      if (response.data.success) {
        return {
          success: true,
          action: 'cashback_retry',
          message: `Successfully credited ${response.data.amount} NC to your wallet!`,
          data: response.data
        };
      } else {
        return {
          success: false,
          action: 'cashback_retry',
          message: response.data.message || 'Could not process cashback. Please contact support.'
        };
      }
    } catch (error) {
      logger.error('Cashback retry failed', error);

      if (error.response?.data?.code === 'ALREADY_PROCESSED') {
        return {
          success: false,
          action: 'cashback_retry',
          message: 'This cashback has already been processed.'
        };
      }

      return {
        success: false,
        action: 'cashback_retry',
        message: 'Something went wrong. Please try again later.'
      };
    }
  }

  /**
   * Retry failed payment
   */
  async retryPayment(customerId: string, orderId?: string): Promise<SelfServiceResult> {
    try {
      // Get pending order if not provided
      if (!orderId) {
        const orderResponse = await axios.get(
          `${SERVICE_URLS.order}/api/orders/pending/${customerId}`,
          { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
        );
        orderId = orderResponse.data?.orderId;
      }

      if (!orderId) {
        return {
          success: false,
          action: 'payment_retry',
          message: 'No pending order found.'
        };
      }

      // Trigger payment retry
      const response = await axios.post(
        `${SERVICE_URLS.payment}/api/payments/retry`,
        {
          orderId,
          customerId
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );

      if (response.data.success) {
        return {
          success: true,
          action: 'payment_retry',
          message: 'Payment retry initiated. Please complete payment within 15 minutes.',
          data: { paymentLink: response.data.paymentLink }
        };
      } else {
        return {
          success: false,
          action: 'payment_retry',
          message: response.data.message || 'Could not initiate payment. Please try again.'
        };
      }
    } catch (error) {
      logger.error('Payment retry failed', error);

      if (error.response?.status === 404) {
        return {
          success: false,
          action: 'payment_retry',
          message: 'Order not found or already paid.'
        };
      }

      return {
        success: false,
        action: 'payment_retry',
        message: 'Something went wrong. Please try again later.'
      };
    }
  }

  /**
   * Sync wallet (fix missing transactions)
   */
  async syncWallet(customerId: string): Promise<SelfServiceResult> {
    try {
      const response = await axios.post(
        `${SERVICE_URLS.wallet}/api/wallet/sync`,
        {
          customerId
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 15000 }
      );

      if (response.data.success) {
        const message = response.data.corrected
          ? `Wallet synced! ${response.data.corrected} transaction(s) corrected.`
          : 'Wallet is up to date!';

        return {
          success: true,
          action: 'wallet_sync',
          message,
          data: response.data
        };
      } else {
        return {
          success: false,
          action: 'wallet_sync',
          message: response.data.message || 'Could not sync wallet.'
        };
      }
    } catch (error) {
      logger.error('Wallet sync failed', error);

      return {
        success: false,
        action: 'wallet_sync',
        message: 'Something went wrong during sync. Please try again.'
      };
    }
  }

  /**
   * Provide QR troubleshooting steps
   */
  async provideQRTroubleshooting(customerId: string): Promise<SelfServiceResult> {
    // Return step-by-step troubleshooting guide
    const steps = [
      {
        step: 1,
        title: 'Check Internet Connection',
        description: 'Ensure you have stable internet. Try loading a webpage.',
        action: 'test_connection'
      },
      {
        step: 2,
        title: 'Clear App Cache',
        description: 'Go to Settings > Apps > ReZ > Storage > Clear Cache',
        action: 'clear_cache'
      },
      {
        step: 3,
        title: 'Update the App',
        description: 'Make sure you\'re using the latest version of ReZ app.',
        action: 'check_update'
      },
      {
        step: 4,
        title: 'Restart Device',
        description: 'Sometimes a simple restart fixes connectivity issues.',
        action: 'restart_device'
      }
    ];

    return {
      success: true,
      action: 'qr_troubleshoot',
      message: 'Follow these steps to fix QR issues:',
      data: {
        steps,
        tip: 'If issues persist after trying all steps, we\'ll automatically credit 10 NC to your wallet.'
      }
    };
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(
    customerId: string,
    bookingId?: string,
    newDate?: Date
  ): Promise<SelfServiceResult> {
    try {
      if (!bookingId) {
        // Get active bookings
        const response = await axios.get(
          `${SERVICE_URLS.booking}/api/bookings/active/${customerId}`,
          { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
        );

        const bookings = response.data.bookings || [];

        if (bookings.length === 0) {
          return {
            success: false,
            action: 'booking_reschedule',
            message: 'No active bookings found.'
          };
        }

        return {
          success: true,
          action: 'booking_reschedule',
          message: `You have ${bookings.length} active booking(s).`,
          data: { bookings }
        };
      }

      if (!newDate) {
        return {
          success: false,
          action: 'booking_reschedule',
          message: 'Please provide a new date for rescheduling.'
        };
      }

      // Attempt reschedule
      const response = await axios.post(
        `${SERVICE_URLS.booking}/api/bookings/${bookingId}/reschedule`,
        { newDate },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );

      if (response.data.success) {
        return {
          success: true,
          action: 'booking_reschedule',
          message: `Booking rescheduled to ${new Date(newDate).toLocaleDateString()}.`,
          data: response.data
        };
      } else {
        return {
          success: false,
          action: 'booking_reschedule',
          message: response.data.message || 'Could not reschedule booking. Please contact support.'
        };
      }
    } catch (error) {
      logger.error('Booking reschedule failed', error);

      if (error.response?.status === 400) {
        return {
          success: false,
          action: 'booking_reschedule',
          message: error.response.data.message || 'Rescheduling not allowed for this booking type.'
        };
      }

      return {
        success: false,
        action: 'booking_reschedule',
        message: 'Something went wrong. Please try again.'
      };
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async checkCashbackStatus(customerId: string): Promise<{
    hasPending: boolean;
    pendingCount: number;
  }> {
    try {
      const response = await axios.get(
        `${SERVICE_URLS.wallet}/api/wallet/pending-cashback/${customerId}`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      return {
        hasPending: (response.data.pendingCount || 0) > 0,
        pendingCount: response.data.pendingCount || 0
      };
    } catch {
      return { hasPending: false, pendingCount: 0 };
    }
  }

  private async checkPaymentStatus(customerId: string): Promise<{
    hasFailedPayments: boolean;
    orderId?: string;
  }> {
    try {
      const response = await axios.get(
        `${SERVICE_URLS.order}/api/orders/pending/${customerId}`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      return {
        hasFailedPayments: !!response.data?.orderId,
        orderId: response.data?.orderId
      };
    } catch {
      return { hasFailedPayments: false };
    }
  }

  private async checkRefundEligibility(customerId: string): Promise<SelfServiceResult> {
    try {
      const response = await axios.get(
        `${SERVICE_URLS.payment}/api/refunds/customer/${customerId}`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      return {
        success: true,
        action: 'refund_check',
        message: 'Refund eligibility checked',
        data: { eligible: true, refunds: response.data.refunds || [] }
      };
    } catch {
      return { success: false, action: 'refund_check', message: 'Unable to check refund eligibility' };
    }
  }

  private async checkWalletSync(customerId: string): Promise<{
    hasSyncIssue: boolean;
  }> {
    try {
      const response = await axios.get(
        `${SERVICE_URLS.wallet}/api/wallet/sync-status/${customerId}`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      return {
        hasSyncIssue: response.data.needsSync || false
      };
    } catch {
      return { hasSyncIssue: false };
    }
  }

  private async checkBookingStatus(customerId: string): Promise<{
    hasActiveBookings: boolean;
    bookings?: unknown[];
  }> {
    try {
      const response = await axios.get(
        `${SERVICE_URLS.booking}/api/bookings/active/${customerId}`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      const bookings = response.data.bookings || [];
      return {
        hasActiveBookings: bookings.length > 0,
        bookings
      };
    } catch {
      return { hasActiveBookings: false };
    }
  }
}
