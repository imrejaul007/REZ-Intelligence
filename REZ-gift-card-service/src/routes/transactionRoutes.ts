import { Router, Request, Response } from 'express';
import { Transaction } from '../models/index.js';
import {
  TransactionQuerySchema,
  ApiResponse,
  TransactionListResponse,
  TransactionSummary,
  Transaction as TransactionType,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logError } from '../services/logger.js';

const router = Router();

/**
 * GET /api/transactions
 * List all transactions
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = TransactionQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid query parameters',
          },
        };
        res.status(400).json(response);
        return;
      }

      const query: Record<string, unknown> = {};

      if (validationResult.data.type) query.type = validationResult.data.type;
      if (validationResult.data.giftCardId) query.giftCardId = validationResult.data.giftCardId;
      if (validationResult.data.walletId) query.walletId = validationResult.data.walletId;
      if (validationResult.data.status) query.status = validationResult.data.status;

      if (validationResult.data.customerId) {
        query.$or = [
          { 'metadata.customerId': validationResult.data.customerId },
          { 'metadata.recipientEmail': validationResult.data.customerId },
        ];
      }

      if (validationResult.data.startDate || validationResult.data.endDate) {
        query.createdAt = {} as Record<string, Date>;
        if (validationResult.data.startDate) {
          (query.createdAt as Record<string, Date>).$gte = new Date(validationResult.data.startDate);
        }
        if (validationResult.data.endDate) {
          (query.createdAt as Record<string, Date>).$lte = new Date(validationResult.data.endDate);
        }
      }

      const page = validationResult.data.page;
      const limit = validationResult.data.limit;
      const skip = (page - 1) * limit;

      const [transactionDocs, total] = await Promise.all([
        Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Transaction.countDocuments(query),
      ]);

      const transactions: TransactionType[] = transactionDocs.map((doc) => ({
        transactionId: doc.transactionId,
        giftCardId: doc.giftCardId || '',
        type: doc.type,
        status: doc.status,
        amount: doc.amount,
        balanceBefore: doc.balanceBefore || 0,
        balanceAfter: doc.balanceAfter || 0,
        paymentMethod: doc.paymentMethod,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        updatedAt: new Date(),
      }));

      const response: ApiResponse<TransactionListResponse> = {
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error listing transactions', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/transactions/:transactionId
 * Get transaction details
 */
router.get(
  '/:transactionId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.params;

      const transaction = await Transaction.findOne({ transactionId });

      if (!transaction) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Transaction not found: ${transactionId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof transaction> = {
        success: true,
        data: transaction,
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching transaction', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/transactions/gift-card/:cardId
 * Get transactions for a gift card
 */
router.get(
  '/gift-card/:cardId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        Transaction.find({ giftCardId: cardId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Transaction.countDocuments({ giftCardId: cardId }),
      ]);

      const response: ApiResponse<{
        cardId: string;
        transactions: typeof transactions;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }> = {
        success: true,
        data: {
          cardId,
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching gift card transactions', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/transactions/reports/summary
 * Get transaction summary/analytics
 */
router.get(
  '/reports/summary',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const matchStage: Record<string, unknown> = {};

      if (req.query.startDate || req.query.endDate) {
        matchStage.createdAt = {} as Record<string, Date>;
        if (req.query.startDate) {
          (matchStage.createdAt as Record<string, Date>).$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          (matchStage.createdAt as Record<string, Date>).$lte = new Date(req.query.endDate as string);
        }
      }

      const [summary, statusSummary, dailyVolume] = await Promise.all([
        Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
        ]),
        Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
        ]),
        Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              amount: { $sum: '$amount' },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 30 },
        ]),
      ]);

      const response: ApiResponse<TransactionSummary> = {
        success: true,
        data: {
          byType: summary,
          byStatus: statusSummary,
          dailyVolume,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error generating transaction summary', { error: (error as Error).message });
      throw error;
    }
  })
);

export default router;
