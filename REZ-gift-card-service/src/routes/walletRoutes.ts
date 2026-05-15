import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Wallet, GiftCard } from '../models/index.js';
import {
  CreateWalletInputSchema,
  UpdateWalletStatusInputSchema,
  ApiResponse,
  WalletResponse,
  WalletWithGiftCardsResponse,
  WalletBalanceResponse,
} from '../types/index.js';
import { asyncHandler } from '../middleware/index.js';
import { logInfo, logError } from '../services/logger.js';

const router = Router();

/**
 * POST /api/wallets
 * Create a customer wallet
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const validationResult = CreateWalletInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.errors[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { customerId } = validationResult.data;

      const existingWallet = await Wallet.findOne({ customerId });

      if (existingWallet) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'DUPLICATE_WALLET',
            message: 'Wallet already exists for this customer',
          },
        };
        res.status(400).json(response);
        return;
      }

      const walletId = `WAL-${uuidv4().substring(0, 8).toUpperCase()}`;

      const wallet = new Wallet({
        walletId,
        customerId,
        balance: 0,
        currency: 'INR',
        totalGiftCards: 0,
      });

      await wallet.save();

      logInfo('Wallet created', { walletId, customerId });

      const response: ApiResponse<WalletResponse> = {
        success: true,
        data: {
          walletId: wallet.walletId,
          customerId: wallet.customerId,
          balance: wallet.balance,
          currency: wallet.currency,
          totalGiftCards: wallet.totalGiftCards,
          status: wallet.status,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      logError('Error creating wallet', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/wallets/:customerId
 * Get customer wallet
 */
router.get(
  '/:customerId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      const wallet = await Wallet.findOne({ customerId });

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Wallet not found for customer: ${customerId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      // Get gift card details
      const giftCards = await GiftCard.find({
        'issuedTo.customerId': customerId,
        status: 'active',
      }).select('cardId cardNumber balance originalValue validUntil');

      const response: ApiResponse<WalletWithGiftCardsResponse> = {
        success: true,
        data: {
          wallet: {
            walletId: wallet.walletId,
            customerId: wallet.customerId,
            balance: wallet.balance,
            currency: wallet.currency,
            totalGiftCards: wallet.totalGiftCards,
            status: wallet.status,
          },
          giftCards: giftCards.map((card) => ({
            cardId: card.cardId,
            cardNumber: card.cardNumber,
            balance: card.balance,
            originalValue: card.originalValue,
            validUntil: card.validUntil!,
          })),
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching wallet', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * GET /api/wallets/:customerId/balance
 * Get wallet balance summary
 */
router.get(
  '/:customerId/balance',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      const wallet = await Wallet.findOne({ customerId });

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Wallet not found for customer: ${customerId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      // Calculate total across all active gift cards
      const giftCardSummary = await GiftCard.aggregate([
        { $match: { 'issuedTo.customerId': customerId, status: 'active' } },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalOriginalValue: { $sum: '$originalValue' },
            count: { $sum: 1 },
          },
        },
      ]);

      const response: ApiResponse<WalletBalanceResponse> = {
        success: true,
        data: {
          customerId,
          walletBalance: wallet.balance,
          giftCardBalance: giftCardSummary[0]?.totalBalance || 0,
          totalValue: (wallet.balance || 0) + (giftCardSummary[0]?.totalBalance || 0),
          activeGiftCards: giftCardSummary[0]?.count || 0,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error fetching wallet balance', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * PATCH /api/wallets/:customerId/status
 * Update wallet status
 */
router.patch(
  '/:customerId/status',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      const validationResult = UpdateWalletStatusInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.errors[0]?.message || 'Invalid input',
          },
        };
        res.status(400).json(response);
        return;
      }

      const { status } = validationResult.data;

      const wallet = await Wallet.findOneAndUpdate(
        { customerId },
        { status, updatedAt: new Date() },
        { new: true }
      );

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Wallet not found for customer: ${customerId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<WalletResponse> = {
        success: true,
        data: {
          walletId: wallet.walletId,
          customerId: wallet.customerId,
          balance: wallet.balance,
          currency: wallet.currency,
          totalGiftCards: wallet.totalGiftCards,
          status: wallet.status,
        },
      };

      res.json(response);
    } catch (error) {
      logError('Error updating wallet status', { error: (error as Error).message });
      throw error;
    }
  })
);

/**
 * DELETE /api/wallets/:customerId
 * Close a customer wallet
 */
router.delete(
  '/:customerId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      // Check for active gift cards
      const activeCards = await GiftCard.countDocuments({
        'issuedTo.customerId': customerId,
        status: 'active',
        balance: { $gt: 0 },
      });

      if (activeCards > 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'ACTIVE_CARDS_EXIST',
            message: `Customer has ${activeCards} active gift cards with balance. Redeem or cancel them first.`,
          },
        };
        res.status(400).json(response);
        return;
      }

      const result = await Wallet.deleteOne({ customerId });

      if (result.deletedCount === 0) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Wallet not found for customer: ${customerId}`,
          },
        };
        res.status(404).json(response);
        return;
      }

      logInfo('Wallet deleted', { customerId });

      const response: ApiResponse<{ customerId: string; deleted: boolean }> = {
        success: true,
        data: { customerId, deleted: true },
      };

      res.json(response);
    } catch (error) {
      logError('Error deleting wallet', { error: (error as Error).message });
      throw error;
    }
  })
);

export default router;
