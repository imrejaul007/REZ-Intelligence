import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomInt, randomUUID } from 'crypto';
import { GiftCard, Wallet, Transaction } from '../models/index.js';
import {
  CreateGiftCardInputSchema,
  CheckBalanceInputSchema,
  RedeemGiftCardInputSchema,
  LoadBalanceInputSchema,
  CancelGiftCardInputSchema,
  CustomerQuerySchema,
  validateGiftCardValue,
  ApiResponse,
  GiftCardResponse,
  GiftCardDetailsResponse,
  BalanceCheckResponse,
  RedemptionResponse,
  LoadBalanceResponse,
  CustomerGiftCardsResponse,
  CancellationResponse,
  TransactionHistoryResponse,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logInfo, logError } from '../services/logger.js';

const router = Router();

// Generate gift card number
function generateCardNumber(): string {
  const prefix = process.env.GIFT_CARD_PREFIX || 'GC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`.substring(0, 16);
}

// Generate PIN
function generatePIN(): string {
  return randomInt(1000, 9999).toString();
}

// Generate transaction ID
function generateTransactionId(): string {
  return `TX-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * POST /api/gift-cards
 * Create/purchase a new gift card
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate input
      const validationResult = CreateGiftCardInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
            details: validationResult.error.issues,
          },
        };
        res.status(400).json(response);
        return;
      }

      const input = validationResult.data;

      // Validate value range
      const valueValidation = validateGiftCardValue(input.value);
      if (!valueValidation.valid) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: valueValidation.error!,
          },
        };
        res.status(400).json(response);
        return;
      }

      const cardId = `GC-${uuidv4().substring(0, 8).toUpperCase()}`;
      const cardNumber = generateCardNumber();
      const pin = generatePIN();

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + input.validDays);

      const transactionId = generateTransactionId();

      const giftCard = new GiftCard({
        cardId,
        cardNumber,
        pin,
        balance: input.value,
        originalValue: input.value,
        currency: input.currency,
        type: input.type,
        status: 'active',
        issuedTo: input.issuedTo,
        purchasedBy: input.purchasedBy,
        validFrom: new Date(),
        validUntil,
        transactionHistory: [
          {
            type: 'load',
            amount: input.value,
            balanceAfter: input.value,
            transactionId,
            timestamp: new Date(),
            notes: 'Gift card purchased',
          },
        ],
        metadata: input.metadata,
      });

      await giftCard.save();

      // Create transaction record
      const transaction = new Transaction({
        transactionId,
        type: 'purchase',
        giftCardId: cardId,
        amount: input.value,
        balanceBefore: 0,
        balanceAfter: input.value,
        currency: input.currency,
        status: 'completed',
        metadata: {
          customerId: input.purchasedBy?.customerId,
          recipientEmail: input.issuedTo?.email,
        },
      });
      await transaction.save();

      // Create or update wallet for issued user
      if (input.issuedTo?.customerId) {
        await Wallet.findOneAndUpdate(
          { customerId: input.issuedTo.customerId },
          {
            $inc: { balance: input.value, totalGiftCards: 1 },
            $set: { status: 'active', updatedAt: new Date() },
          },
          { upsert: true, new: true }
        );
      }

      logInfo('Gift card created', { cardId, cardNumber, value: input.value });

      const response: ApiResponse<GiftCardResponse> = {
        success: true,
        data: {
          cardId,
          cardNumber,
          balance: input.value,
          currency: input.currency,
          validUntil,
          message: 'Gift card created successfully',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating gift card', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/gift-cards/:cardId
 * Get gift card details
 */
router.get(
  '/:cardId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const giftCard = await GiftCard.findOne({ cardId });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      // Check and update expired status
      if (giftCard.status === 'active' && giftCard.validUntil && giftCard.validUntil < new Date()) {
        giftCard.status = 'expired';
        giftCard.transactionHistory.push({
          type: 'expire',
          amount: 0,
          balanceAfter: giftCard.balance,
          transactionId: generateTransactionId(),
          timestamp: new Date(),
          notes: 'Gift card expired',
        });
        await giftCard.save();
      }

      const response: ApiResponse<GiftCardDetailsResponse> = {
        success: true,
        data: {
          cardId: giftCard.cardId,
          cardNumber: giftCard.cardNumber,
          balance: giftCard.balance,
          originalValue: giftCard.originalValue,
          currency: giftCard.currency,
          status: giftCard.status,
          type: giftCard.type,
          validFrom: giftCard.validFrom,
          validUntil: giftCard.validUntil!,
          issuedTo: giftCard.issuedTo,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching gift card', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/gift-cards/balance
 * Check gift card balance
 */
router.post(
  '/balance',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = CheckBalanceInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { cardNumber, pin } = validationResult.data;

      const giftCard = await GiftCard.findOne({ cardNumber, pin });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invalid card number or PIN',
          },
        };
        res.status(404).json(response);
        return;
      }

      // Check expiry
      let status = giftCard.status;
      if (status === 'active' && giftCard.validUntil && giftCard.validUntil < new Date()) {
        status = 'expired';
      }

      const response: ApiResponse<BalanceCheckResponse> = {
        success: true,
        data: {
          cardId: giftCard.cardId,
          cardNumber: giftCard.cardNumber,
          balance: giftCard.balance,
          currency: giftCard.currency,
          status,
          validUntil: giftCard.validUntil!,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error checking balance', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/gift-cards/:cardId/redeem
 * Redeem gift card balance
 */
router.post(
  '/:cardId/redeem',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const validationResult = RedeemGiftCardInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { amount, pin, storeId, storeName, orderId, customerId } = validationResult.data;

      const giftCard = await GiftCard.findOne({ cardId });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      if (giftCard.pin !== pin) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_PIN',
            message: 'Invalid PIN',
          },
        };
        res.status(400).json(response);
        return;
      }

      if (giftCard.status !== 'active') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Gift card is ${giftCard.status}`,
          },
        };
        res.status(400).json(response);
        return;
      }

      if (giftCard.validUntil && giftCard.validUntil < new Date()) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'EXPIRED',
            message: 'Gift card has expired',
          },
        };
        res.status(400).json(response);
        return;
      }

      if (giftCard.balance < amount) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient balance. Available: ${giftCard.balance}`,
          },
        };
        res.status(400).json(response);
        return;
      }

      const balanceBefore = giftCard.balance;
      const balanceAfter = balanceBefore - amount;
      const transactionId = generateTransactionId();

      giftCard.balance = balanceAfter;
      giftCard.transactionHistory.push({
        type: 'redeem',
        amount,
        balanceAfter,
        transactionId,
        timestamp: new Date(),
        notes: `Redeemed at ${storeName || storeId}`,
      });

      if (balanceAfter === 0) {
        giftCard.status = 'redeemed';
        giftCard.redeemedAt = new Date();
        giftCard.redemptionStore = storeId;
      }

      giftCard.updatedAt = new Date();
      await giftCard.save();

      // Create transaction record
      const transaction = new Transaction({
        transactionId,
        type: 'redeem',
        giftCardId: cardId,
        amount,
        balanceBefore,
        balanceAfter,
        currency: giftCard.currency,
        status: 'completed',
        metadata: {
          orderId,
          storeId,
          storeName,
          customerId,
        },
      });
      await transaction.save();

      logInfo('Gift card redeemed', { cardId, amount, newBalance: balanceAfter });

      const response: ApiResponse<RedemptionResponse> = {
        success: true,
        data: {
          transactionId,
          amountRedeemed: amount,
          newBalance: balanceAfter,
          status: giftCard.status,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error redeeming gift card', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * POST /api/gift-cards/:cardId/load
 * Load additional balance to gift card
 */
router.post(
  '/:cardId/load',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const validationResult = LoadBalanceInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { amount } = validationResult.data;

      const giftCard = await GiftCard.findOne({ cardId });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      if (giftCard.status === 'redeemed') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Cannot load balance to a fully redeemed card',
          },
        };
        res.status(400).json(response);
        return;
      }

      if (giftCard.status === 'cancelled') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Cannot load balance to a cancelled card',
          },
        };
        res.status(400).json(response);
        return;
      }

      const balanceBefore = giftCard.balance;
      const balanceAfter = balanceBefore + amount;
      const transactionId = generateTransactionId();

      giftCard.balance = balanceAfter;
      giftCard.transactionHistory.push({
        type: 'load',
        amount,
        balanceAfter,
        transactionId,
        timestamp: new Date(),
        notes: 'Balance loaded',
      });

      giftCard.updatedAt = new Date();
      await giftCard.save();

      // Create transaction record
      const transaction = new Transaction({
        transactionId,
        type: 'load',
        giftCardId: cardId,
        amount,
        balanceBefore,
        balanceAfter,
        currency: giftCard.currency,
        status: 'completed',
      });
      await transaction.save();

      logInfo('Gift card balance loaded', { cardId, amount, newBalance: balanceAfter });

      const response: ApiResponse<LoadBalanceResponse> = {
        success: true,
        data: {
          transactionId,
          amountLoaded: amount,
          newBalance: balanceAfter,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error loading gift card balance', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/gift-cards/customer/:customerId
 * Get all gift cards for a customer
 */
router.get(
  '/customer/:customerId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      const queryValidation = CustomerQuerySchema.safeParse(req.query);
      const { status } = queryValidation.success ? queryValidation.data : { status: undefined };
      const page = queryValidation.success ? queryValidation.data.page : 1;
      const limit = queryValidation.success ? queryValidation.data.limit : 20;

      const query: Record<string, unknown> = { 'issuedTo.customerId': customerId };
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const [cards, total] = await Promise.all([
        GiftCard.find(query)
          .select('-pin -transactionHistory')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        GiftCard.countDocuments(query),
      ]);

      // Calculate total balance
      const totalBalance = await GiftCard.aggregate([
        { $match: { 'issuedTo.customerId': customerId, status: 'active' } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]);

      const response: ApiResponse<CustomerGiftCardsResponse> = {
        success: true,
        data: {
          cards: cards.map((card) => ({
            cardId: card.cardId,
            cardNumber: card.cardNumber,
            balance: card.balance,
            originalValue: card.originalValue,
            currency: card.currency,
            status: card.status,
            type: card.type,
            validFrom: card.validFrom,
            validUntil: card.validUntil!,
            issuedTo: card.issuedTo,
          })),
          totalBalance: totalBalance[0]?.total || 0,
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
      logError('Error fetching customer gift cards', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/gift-cards/:cardId/cancel
 * Cancel a gift card
 */
router.patch(
  '/:cardId/cancel',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const validationResult = CancelGiftCardInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.issues[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { reason, pin } = validationResult.data;

      const giftCard = await GiftCard.findOne({ cardId });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      if (giftCard.pin !== pin) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_PIN',
            message: 'Invalid PIN',
          },
        };
        res.status(400).json(response);
        return;
      }

      if (!['active', 'frozen'].includes(giftCard.status)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot cancel a ${giftCard.status} card`,
          },
        };
        res.status(400).json(response);
        return;
      }

      const transactionId = generateTransactionId();

      giftCard.status = 'cancelled';
      giftCard.transactionHistory.push({
        type: 'cancel',
        amount: giftCard.balance,
        balanceAfter: 0,
        transactionId,
        timestamp: new Date(),
        notes: reason || 'Gift card cancelled',
      });
      giftCard.updatedAt = new Date();
      await giftCard.save();

      logInfo('Gift card cancelled', { cardId, transactionId });

      const response: ApiResponse<CancellationResponse> = {
        success: true,
        data: {
          cardId,
          status: 'cancelled',
          originalBalance: giftCard.balance,
          transactionId,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error cancelling gift card', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/gift-cards/:cardId/freeze
 * Freeze a gift card
 */
router.patch(
  '/:cardId/freeze',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const giftCard = await GiftCard.findOneAndUpdate(
        { cardId, status: 'active' },
        {
          status: 'frozen',
          $push: {
            transactionHistory: {
              type: 'cancel',
              amount: 0,
              balanceAfter: 0,
              transactionId: generateTransactionId(),
              timestamp: new Date(),
              notes: 'Gift card frozen',
            },
          },
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Active gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<{ cardId: string; status: string }> = {
        success: true,
        data: {
          cardId,
          status: 'frozen',
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error freezing gift card', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/gift-cards/:cardId/history
 * Get gift card transaction history
 */
router.get(
  '/:cardId/history',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { cardId } = req.params;

      const giftCard = await GiftCard.findOne({ cardId }, { transactionHistory: 1, cardId: 1 });

      if (!giftCard) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Gift card not found: ${cardId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<TransactionHistoryResponse> = {
        success: true,
        data: {
          cardId,
          transactionHistory: giftCard.transactionHistory,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching transaction history', { error: (error as Error).message });
      throw error;
    }
  })
);

export default router;
