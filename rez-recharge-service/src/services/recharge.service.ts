import { v4 as uuidv4 } from 'uuid';
import {
  Recharge,
  Plan,
  IRecharge,
  IPlan,
  RechargeType,
  RechargeStatus,
  MobileOperator,
  DTHOperator,
} from '../models/recharge.model.js';
import { operatorService, OperatorResponse } from './operator.service.js';

// Request/Response types
export interface MobileRechargeRequest {
  userId?: string;
  operator: MobileOperator;
  mobileNumber: string;
  amount: number;
  planId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface DTHRechargeRequest {
  userId?: string;
  operator: DTHOperator;
  subscriberId: string;
  amount: number;
  planId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface RechargeResponse {
  success: boolean;
  transactionId?: string;
  message: string;
  status?: RechargeStatus;
  operatorReferenceId?: string;
  errorCode?: string;
}

export interface TransactionHistoryQuery {
  userId?: string;
  type?: RechargeType;
  operator?: string;
  status?: RechargeStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// Recharge Service Class
export class RechargeService {
  private static instance: RechargeService;

  private constructor() {}

  static getInstance(): RechargeService {
    if (!RechargeService.instance) {
      RechargeService.instance = new RechargeService();
    }
    return RechargeService.instance;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `RCH${Date.now()}${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Process mobile recharge
   */
  async processMobileRecharge(request: MobileRechargeRequest): Promise<RechargeResponse> {
    const transactionId = this.generateTransactionId();

    // Create recharge record
    const recharge = new Recharge({
      transactionId,
      userId: request.userId,
      type: RechargeType.MOBILE,
      operator: request.operator,
      subscriberNumber: request.mobileNumber,
      amount: request.amount,
      status: RechargeStatus.PENDING,
      planId: request.planId,
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
      retryCount: 0,
    });

    try {
      await recharge.save();

      // If scheduled for later, save and return
      if (request.scheduledAt && request.scheduledAt > new Date()) {
        return {
          success: true,
          transactionId,
          message: 'Recharge scheduled successfully',
          status: RechargeStatus.PENDING,
        };
      }

      // Process immediately
      return await this.executeMobileRecharge(recharge);
    } catch (error) {
      console.error('Mobile recharge error:', error);
      return {
        success: false,
        transactionId,
        message: 'Failed to initiate recharge',
        errorCode: 'DB_ERROR',
      };
    }
  }

  /**
   * Execute mobile recharge with operator
   */
  private async executeMobileRecharge(recharge: IRecharge): Promise<RechargeResponse> {
    try {
      // Update status to processing
      recharge.status = RechargeStatus.PROCESSING;
      await recharge.save();

      // Call operator service
      const operatorResponse: OperatorResponse = await operatorService.processMobileRecharge(
        recharge.operator as MobileOperator,
        recharge.subscriberNumber,
        recharge.amount,
        recharge.planId
      );

      if (operatorResponse.success) {
        recharge.status = RechargeStatus.SUCCESS;
        recharge.operatorReferenceId = operatorResponse.referenceId;
        recharge.operatorResponse = operatorResponse.operatorData;
        recharge.completedAt = new Date();
        await recharge.save();

        return {
          success: true,
          transactionId: recharge.transactionId,
          message: operatorResponse.message || 'Recharge successful',
          status: RechargeStatus.SUCCESS,
          operatorReferenceId: operatorResponse.referenceId,
        };
      } else {
        recharge.status = RechargeStatus.FAILED;
        recharge.errorMessage = operatorResponse.message;
        await recharge.save();

        return {
          success: false,
          transactionId: recharge.transactionId,
          message: operatorResponse.message || 'Recharge failed',
          status: RechargeStatus.FAILED,
          errorCode: operatorResponse.errorCode,
        };
      }
    } catch (error) {
      console.error('Execute mobile recharge error:', error);
      recharge.status = RechargeStatus.FAILED;
      recharge.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await recharge.save();

      return {
        success: false,
        transactionId: recharge.transactionId,
        message: 'Recharge processing failed',
        status: RechargeStatus.FAILED,
        errorCode: 'PROCESSING_ERROR',
      };
    }
  }

  /**
   * Process DTH recharge
   */
  async processDTHRecharge(request: DTHRechargeRequest): Promise<RechargeResponse> {
    const transactionId = this.generateTransactionId();

    const recharge = new Recharge({
      transactionId,
      userId: request.userId,
      type: RechargeType.DTH,
      operator: request.operator,
      subscriberNumber: request.subscriberId,
      amount: request.amount,
      status: RechargeStatus.PENDING,
      planId: request.planId,
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
      retryCount: 0,
    });

    try {
      await recharge.save();

      // If scheduled for later, save and return
      if (request.scheduledAt && request.scheduledAt > new Date()) {
        return {
          success: true,
          transactionId,
          message: 'Recharge scheduled successfully',
          status: RechargeStatus.PENDING,
        };
      }

      // Process immediately
      return await this.executeDTHRecharge(recharge);
    } catch (error) {
      console.error('DTH recharge error:', error);
      return {
        success: false,
        transactionId,
        message: 'Failed to initiate recharge',
        errorCode: 'DB_ERROR',
      };
    }
  }

  /**
   * Execute DTH recharge with operator
   */
  private async executeDTHRecharge(recharge: IRecharge): Promise<RechargeResponse> {
    try {
      // Update status to processing
      recharge.status = RechargeStatus.PROCESSING;
      await recharge.save();

      // Call operator service
      const operatorResponse: OperatorResponse = await operatorService.processDTHRecharge(
        recharge.operator as DTHOperator,
        recharge.subscriberNumber,
        recharge.amount,
        recharge.planId
      );

      if (operatorResponse.success) {
        recharge.status = RechargeStatus.SUCCESS;
        recharge.operatorReferenceId = operatorResponse.referenceId;
        recharge.operatorResponse = operatorResponse.operatorData;
        recharge.completedAt = new Date();
        await recharge.save();

        return {
          success: true,
          transactionId: recharge.transactionId,
          message: operatorResponse.message || 'Recharge successful',
          status: RechargeStatus.SUCCESS,
          operatorReferenceId: operatorResponse.referenceId,
        };
      } else {
        recharge.status = RechargeStatus.FAILED;
        recharge.errorMessage = operatorResponse.message;
        await recharge.save();

        return {
          success: false,
          transactionId: recharge.transactionId,
          message: operatorResponse.message || 'Recharge failed',
          status: RechargeStatus.FAILED,
          errorCode: operatorResponse.errorCode,
        };
      }
    } catch (error) {
      console.error('Execute DTH recharge error:', error);
      recharge.status = RechargeStatus.FAILED;
      recharge.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await recharge.save();

      return {
        success: false,
        transactionId: recharge.transactionId,
        message: 'Recharge processing failed',
        status: RechargeStatus.FAILED,
        errorCode: 'PROCESSING_ERROR',
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<IRecharge | null> {
    return await Recharge.findOne({ transactionId });
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(query: TransactionHistoryQuery): Promise<{
    transactions: IRecharge[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build query filter
    const filter: Record<string, unknown> = {};

    if (query.userId) {
      filter.userId = query.userId;
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.operator) {
      filter.operator = query.operator;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        (filter.createdAt as Record<string, Date>).$gte = query.startDate;
      }
      if (query.endDate) {
        (filter.createdAt as Record<string, Date>).$lte = query.endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      Recharge.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Recharge.countDocuments(filter),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retry failed recharge
   */
  async retryRecharge(transactionId: string): Promise<RechargeResponse> {
    const recharge = await Recharge.findOne({ transactionId });

    if (!recharge) {
      return {
        success: false,
        message: 'Transaction not found',
        errorCode: 'NOT_FOUND',
      };
    }

    if (recharge.status !== RechargeStatus.FAILED) {
      return {
        success: false,
        transactionId,
        message: 'Only failed transactions can be retried',
        errorCode: 'INVALID_STATUS',
      };
    }

    // Check retry limit
    const maxRetries = 3;
    if (recharge.retryCount >= maxRetries) {
      return {
        success: false,
        transactionId,
        message: 'Maximum retry attempts exceeded',
        errorCode: 'MAX_RETRIES',
      };
    }

    // Increment retry count
    recharge.retryCount += 1;
    recharge.status = RechargeStatus.PENDING;

    // Reset error fields
    recharge.errorMessage = undefined;

    await recharge.save();

    // Execute recharge based on type
    if (recharge.type === RechargeType.MOBILE) {
      return await this.executeMobileRecharge(recharge);
    } else {
      return await this.executeDTHRecharge(recharge);
    }
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(transactionId: string): Promise<RechargeResponse> {
    const recharge = await Recharge.findOne({ transactionId });

    if (!recharge) {
      return {
        success: false,
        message: 'Transaction not found',
        errorCode: 'NOT_FOUND',
      };
    }

    if (recharge.status !== RechargeStatus.SUCCESS) {
      return {
        success: false,
        transactionId,
        message: 'Only successful transactions can be refunded',
        errorCode: 'INVALID_STATUS',
      };
    }

    // Update status to refunded
    recharge.status = RechargeStatus.REFUNDED;
    await recharge.save();

    return {
      success: true,
      transactionId,
      message: 'Refund initiated successfully',
      status: RechargeStatus.REFUNDED,
    };
  }

  /**
   * Get customer balance
   */
  async getCustomerBalance(
    operator: string,
    subscriberNumber: string,
    type: 'mobile' | 'dth'
  ): Promise<{ balance: number; lastUpdated: Date } | null> {
    const details = await operatorService.getCustomerDetails(operator, subscriberNumber, type);

    if (!details || typeof details.balance !== 'number') {
      return null;
    }

    return {
      balance: details.balance,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get bill details for mobile postpaid
   */
  async getMobileBillDetails(
    operator: string,
    mobileNumber: string
  ): Promise<{ amount: number; dueDate: Date; billNumber: string } | null> {
    return await operatorService.getMobileBillDetails(operator, mobileNumber);
  }

  /**
   * Get operator status
   */
  async getOperatorStatus(operator: string): Promise<{
    operator: string;
    status: string;
    latency: number;
  }> {
    const status = await operatorService.checkOperatorStatus(operator);
    return {
      operator: status.operator,
      status: status.status,
      latency: status.latency,
    };
  }

  /**
   * Get all operators status
   */
  async getAllOperatorsStatus(): Promise<
    Array<{ operator: string; status: string; latency: number }>
  > {
    const mobileOperators = operatorService.getSupportedMobileOperators();
    const dthOperators = operatorService.getSupportedDTHOperators();

    const allOperators = [...mobileOperators, ...dthOperators];

    const statuses = await Promise.all(
      allOperators.map(async (operator) => {
        const status = await operatorService.checkOperatorStatus(operator);
        return {
          operator: status.operator,
          status: status.status,
          latency: status.latency,
        };
      })
    );

    return statuses;
  }

  /**
   * Get daily transaction summary
   */
  async getDailySummary(date: Date = new Date()): Promise<{
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalAmount: number;
    successfulAmount: number;
    byOperator: Record<string, { count: number; amount: number }>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactions = await Recharge.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const summary = {
      totalTransactions: transactions.length,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalAmount: 0,
      successfulAmount: 0,
      byOperator: {} as Record<string, { count: number; amount: number }>,
    };

    for (const tx of transactions) {
      summary.totalAmount += tx.amount;

      if (!summary.byOperator[tx.operator]) {
        summary.byOperator[tx.operator] = { count: 0, amount: 0 };
      }
      summary.byOperator[tx.operator].count += 1;
      summary.byOperator[tx.operator].amount += tx.amount;

      if (tx.status === RechargeStatus.SUCCESS) {
        summary.successfulTransactions += 1;
        summary.successfulAmount += tx.amount;
      } else if (tx.status === RechargeStatus.FAILED) {
        summary.failedTransactions += 1;
      }
    }

    return summary;
  }
}

// Export singleton instance
export const rechargeService = RechargeService.getInstance();
