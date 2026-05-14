import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Wallet, GiftCard } from '../index.js';

const router = Router();

/**
 * POST /api/wallets
 * Create a customer wallet
 */
router.post('/', async (req, res, next) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'customerId is required'
      });
    }

    const existingWallet = await Wallet.findOne({ customerId });

    if (existingWallet) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Wallet already exists for this customer'
      });
    }

    const walletId = `WAL-${uuidv4().substring(0, 8).toUpperCase()}`;

    const wallet = new Wallet({
      walletId,
      customerId,
      balance: 0,
      currency: 'INR',
      totalGiftCards: 0
    });

    await wallet.save();

    res.status(201).json({
      success: true,
      data: wallet
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallets/:customerId
 * Get customer wallet
 */
router.get('/:customerId', async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const wallet = await Wallet.findOne({ customerId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Wallet not found for customer: ${customerId}`
      });
    }

    // Get gift card details
    const giftCards = await GiftCard.find({
      'issuedTo.customerId': customerId,
      status: 'active'
    }).select('cardId cardNumber balance originalValue validUntil');

    res.json({
      success: true,
      data: {
        wallet,
        giftCards
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallets/:customerId/balance
 * Get wallet balance summary
 */
router.get('/:customerId/balance', async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const wallet = await Wallet.findOne({ customerId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Wallet not found for customer: ${customerId}`
      });
    }

    // Calculate total across all active gift cards
    const giftCardSummary = await GiftCard.aggregate([
      { $match: { 'issuedTo.customerId': customerId, status: 'active' } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalOriginalValue: { $sum: '$originalValue' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        customerId,
        walletBalance: wallet.balance,
        giftCardBalance: giftCardSummary[0]?.totalBalance || 0,
        totalValue: (wallet.balance || 0) + (giftCardSummary[0]?.totalBalance || 0),
        activeGiftCards: giftCardSummary[0]?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/wallets/:customerId/status
 * Update wallet status
 */
router.patch('/:customerId/status', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { customerId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Wallet not found for customer: ${customerId}`
      });
    }

    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/wallets/:customerId
 * Close a customer wallet
 */
router.delete('/:customerId', async (req, res, next) => {
  try {
    const { customerId } = req.params;

    // Check for active gift cards
    const activeCards = await GiftCard.countDocuments({
      'issuedTo.customerId': customerId,
      status: 'active',
      balance: { $gt: 0 }
    });

    if (activeCards > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Customer has ${activeCards} active gift cards with balance. Redeem or cancel them first.`
      });
    }

    const result = await Wallet.deleteOne({ customerId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Wallet not found for customer: ${customerId}`
      });
    }

    res.json({
      success: true,
      data: { customerId, deleted: true }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
