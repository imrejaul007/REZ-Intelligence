import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomInt, randomUUID } from 'crypto';
import { GiftCard, Wallet, Transaction } from '../index.js';

const router = Router();

// Validation helpers
function handleValidationError(error, res) {
  res.status(400).json({
    success: false,
    error: 'Validation Error',
    message: error.message
  });
}

/**
 * POST /api/gift-cards
 * Create/purchase a new gift card
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      value,
      currency = 'INR',
      type = 'digital',
      issuedTo,
      purchasedBy,
      validDays = 365,
      metadata
    } = req.body;

    const minValue = parseInt(process.env.MIN_GIFT_CARD_VALUE) || 100;
    const maxValue = parseInt(process.env.MAX_GIFT_CARD_VALUE) || 50000;

    if (!value || value < minValue || value > maxValue) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Value must be between ${minValue} and ${maxValue}`
      });
    }

    const cardId = `GC-${uuidv4().substring(0, 8).toUpperCase()}`;
    const cardNumber = generateCardNumber();
    const pin = generatePIN();

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const giftCard = new GiftCard({
      cardId,
      cardNumber,
      pin,
      balance: value,
      originalValue: value,
      currency,
      type,
      status: 'active',
      issuedTo,
      purchasedBy,
      validFrom: new Date(),
      validUntil,
      transactionHistory: [{
        type: 'load',
        amount: value,
        balanceAfter: value,
        transactionId: `TX-${uuidv4().substring(0, 8).toUpperCase()}`,
        timestamp: new Date(),
        notes: 'Gift card purchased'
      }],
      metadata
    });

    await giftCard.save();

    // Create transaction record
    const transaction = new Transaction({
      transactionId: `TX-${uuidv4().substring(0, 8).toUpperCase()}`,
      type: 'purchase',
      giftCardId: cardId,
      amount: value,
      balanceBefore: 0,
      balanceAfter: value,
      currency,
      status: 'completed',
      metadata: {
        customerId: purchasedBy?.customerId,
        recipientEmail: issuedTo?.email
      }
    });
    await transaction.save();

    // Create or update wallet for issued user
    if (issuedTo?.customerId) {
      await Wallet.findOneAndUpdate(
        { customerId: issuedTo.customerId },
        {
          $inc: { balance: value, totalGiftCards: 1 },
          $set: { status: 'active', updatedAt: new Date() }
        },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({
      success: true,
      data: {
        cardId,
        cardNumber,
        balance: value,
        currency,
        validUntil,
        message: 'Gift card created successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gift-cards/:cardId
 * Get gift card details
 */
router.get('/:cardId', async (req, res, next) => {
  try {
    const { cardId } = req.params;

    const giftCard = await GiftCard.findOne({ cardId });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Gift card not found: ${cardId}`
      });
    }

    // Check and update expired status
    if (giftCard.status === 'active' && giftCard.validUntil < new Date()) {
      giftCard.status = 'expired';
      giftCard.transactionHistory.push({
        type: 'expire',
        amount: 0,
        balanceAfter: giftCard.balance,
        transactionId: `TX-${uuidv4().substring(0, 8).toUpperCase()}`,
        timestamp: new Date(),
        notes: 'Gift card expired'
      });
      await giftCard.save();
    }

    res.json({
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
        validUntil: giftCard.validUntil,
        issuedTo: giftCard.issuedTo
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gift-cards/balance
 * Check gift card balance
 */
router.post('/balance', async (req, res, next) => {
  try {
    const { cardNumber, pin } = req.body;

    if (!cardNumber || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'cardNumber and pin are required'
      });
    }

    const giftCard = await GiftCard.findOne({ cardNumber, pin });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invalid card number or PIN'
      });
    }

    // Check expiry
    let status = giftCard.status;
    if (status === 'active' && giftCard.validUntil < new Date()) {
      status = 'expired';
    }

    res.json({
      success: true,
      data: {
        cardId: giftCard.cardId,
        cardNumber: giftCard.cardNumber,
        balance: giftCard.balance,
        currency: giftCard.currency,
        status,
        validUntil: giftCard.validUntil
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gift-cards/:cardId/redeem
 * Redeem gift card balance
 */
router.post('/:cardId/redeem', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { amount, pin, storeId, storeName, orderId, customerId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid amount is required'
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'PIN is required for redemption'
      });
    }

    const giftCard = await GiftCard.findOne({ cardId });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Gift card not found: ${cardId}`
      });
    }

    if (giftCard.pin !== pin) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid PIN'
      });
    }

    if (giftCard.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Gift card is ${giftCard.status}`
      });
    }

    if (giftCard.validUntil < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Gift card has expired'
      });
    }

    if (giftCard.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Insufficient balance. Available: ${giftCard.balance}`
      });
    }

    const balanceBefore = giftCard.balance;
    const balanceAfter = balanceBefore - amount;
    const transactionId = `TX-${uuidv4().substring(0, 8).toUpperCase()}`;

    giftCard.balance = balanceAfter;
    giftCard.transactionHistory.push({
      type: 'redeem',
      amount,
      balanceAfter,
      transactionId,
      timestamp: new Date(),
      notes: `Redeemed at ${storeName || storeId}`
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
        customerId
      }
    });
    await transaction.save();

    res.json({
      success: true,
      data: {
        transactionId,
        amountRedeemed: amount,
        newBalance: balanceAfter,
        status: giftCard.status
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gift-cards/:cardId/load
 * Load additional balance to gift card
 */
router.post('/:cardId/load', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { amount, pin } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid amount is required'
      });
    }

    const giftCard = await GiftCard.findOne({ cardId });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Gift card not found: ${cardId}`
      });
    }

    if (giftCard.status === 'redeemed') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cannot load balance to a fully redeemed card'
      });
    }

    if (giftCard.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cannot load balance to a cancelled card'
      });
    }

    const balanceBefore = giftCard.balance;
    const balanceAfter = balanceBefore + amount;
    const transactionId = `TX-${uuidv4().substring(0, 8).toUpperCase()}`;

    giftCard.balance = balanceAfter;
    giftCard.transactionHistory.push({
      type: 'load',
      amount,
      balanceAfter,
      transactionId,
      timestamp: new Date(),
      notes: 'Balance loaded'
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
      status: 'completed'
    });
    await transaction.save();

    res.json({
      success: true,
      data: {
        transactionId,
        amountLoaded: amount,
        newBalance: balanceAfter
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gift-cards/customer/:customerId
 * Get all gift cards for a customer
 */
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { 'issuedTo.customerId': customerId };
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [cards, total] = await Promise.all([
      GiftCard.find(query)
        .select('-pin -transactionHistory')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      GiftCard.countDocuments(query)
    ]);

    // Calculate total balance
    const totalBalance = await GiftCard.aggregate([
      { $match: { 'issuedTo.customerId': customerId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    res.json({
      success: true,
      data: {
        cards,
        totalBalance: totalBalance[0]?.total || 0,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/gift-cards/:cardId/cancel
 * Cancel a gift card
 */
router.patch('/:cardId/cancel', async (req, res, next) => {
  try {
    const { cardId } = req.params;
    const { reason, pin } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'PIN is required for cancellation'
      });
    }

    const giftCard = await GiftCard.findOne({ cardId });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Gift card not found: ${cardId}`
      });
    }

    if (giftCard.pin !== pin) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid PIN'
      });
    }

    if (!['active', 'frozen'].includes(giftCard.status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Cannot cancel a ${giftCard.status} card`
      });
    }

    const transactionId = `TX-${uuidv4().substring(0, 8).toUpperCase()}`;

    giftCard.status = 'cancelled';
    giftCard.transactionHistory.push({
      type: 'cancel',
      amount: giftCard.balance,
      balanceAfter: 0,
      transactionId,
      timestamp: new Date(),
      notes: reason || 'Gift card cancelled'
    });
    giftCard.updatedAt = new Date();
    await giftCard.save();

    res.json({
      success: true,
      data: {
        cardId,
        status: 'cancelled',
        originalBalance: giftCard.balance,
        transactionId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/gift-cards/:cardId/freeze
 * Freeze a gift card
 */
router.patch('/:cardId/freeze', async (req, res, next) => {
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
            balanceAfter: giftCard.balance,
            transactionId: `TX-${uuidv4().substring(0, 8).toUpperCase()}`,
            timestamp: new Date(),
            notes: 'Gift card frozen'
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Active gift card not found: ${cardId}`
      });
    }

    res.json({
      success: true,
      data: {
        cardId,
        status: 'frozen'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gift-cards/:cardId/history
 * Get gift card transaction history
 */
router.get('/:cardId/history', async (req, res, next) => {
  try {
    const { cardId } = req.params;

    const giftCard = await GiftCard.findOne({ cardId }, { transactionHistory: 1, cardId: 1 });

    if (!giftCard) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Gift card not found: ${cardId}`
      });
    }

    res.json({
      success: true,
      data: {
        cardId,
        transactionHistory: giftCard.transactionHistory
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function generateCardNumber() {
  const prefix = process.env.GIFT_CARD_PREFIX || 'GC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`.substring(0, 16);
}

function generatePIN() {
  return randomInt(1000, 9999).toString();
}

export default router;
