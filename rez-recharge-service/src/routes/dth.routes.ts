import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { rechargeService } from '../services/recharge.service.js';
import { operatorService } from '../services/operator.service.js';
import { DTHOperator, RechargeStatus } from '../models/recharge.model.js';

const router = Router();

// Validation schemas
const dthRechargeSchema = z.object({
  userId: z.string().optional(),
  operator: z.nativeEnum(DTHOperator),
  subscriberId: z.string().min(8).max(12),
  amount: z.number().min(100).max(5000),
  planId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const subscriberValidationSchema = z.object({
  operator: z.string(),
  subscriberId: z.string().min(8).max(12),
});

// POST /api/recharge/dth - Process DTH recharge
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = dthRechargeSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { userId, operator, subscriberId, amount, planId, scheduledAt, metadata } = validation.data;

    // Validate subscriber ID format
    if (!operatorService.validateSubscriberId(operator, subscriberId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid subscriber ID format for the selected operator',
      });
      return;
    }

    const response = await rechargeService.processDTHRecharge({
      userId,
      operator,
      subscriberId,
      amount,
      planId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      metadata,
    });

    if (response.success) {
      res.status(201).json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('DTH recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/recharge/dth/operators - Get supported DTH operators
router.get('/operators', (req: Request, res: Response) => {
  const operators = operatorService.getSupportedDTHOperators();

  const operatorNames: Record<string, string> = {
    [DTHOperator.TATA_SKY]: 'Tata Sky',
    [DTHOperator.DISH_TV]: 'Dish TV',
    [DTHOperator.AIRTEL_DIGITAL]: 'Airtel Digital TV',
    [DTHOperator.VIDEOCON]: 'Videocon d2h',
  };

  res.json({
    success: true,
    operators: operators.map((op) => ({
      code: op,
      name: operatorNames[op] || op,
    })),
  });
});

// GET /api/recharge/dth/status/:transactionId - Get transaction status
router.get('/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await rechargeService.getTransactionStatus(transactionId);

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    res.json({
      success: true,
      transaction: {
        transactionId: transaction.transactionId,
        operator: transaction.operator,
        subscriberId: transaction.subscriberNumber,
        amount: transaction.amount,
        status: transaction.status,
        operatorReferenceId: transaction.operatorReferenceId,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/recharge/dth/balance - Check DTH balance/validity
router.post('/balance', async (req: Request, res: Response) => {
  try {
    const validation = subscriberValidationSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { operator, subscriberId } = validation.data;

    if (!operatorService.validateSubscriberId(operator, subscriberId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid subscriber ID format',
      });
      return;
    }

    const balance = await rechargeService.getCustomerBalance(
      operator,
      subscriberId,
      'dth'
    );

    if (!balance) {
      res.status(404).json({
        success: false,
        message: 'Unable to fetch balance',
      });
      return;
    }

    res.json({
      success: true,
      operator,
      subscriberId,
      balance: balance.balance,
      lastUpdated: balance.lastUpdated,
    });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/recharge/dth/details - Get DTH subscriber details
router.post('/details', async (req: Request, res: Response) => {
  try {
    const validation = subscriberValidationSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { operator, subscriberId } = validation.data;

    if (!operatorService.validateSubscriberId(operator, subscriberId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid subscriber ID format',
      });
      return;
    }

    const details = await operatorService.getCustomerDetails(operator, subscriberId, 'dth');

    if (!details) {
      res.status(404).json({
        success: false,
        message: 'Unable to fetch subscriber details',
      });
      return;
    }

    res.json({
      success: true,
      ...details,
    });
  } catch (error) {
    console.error('Subscriber details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/recharge/dth/retry/:transactionId - Retry failed recharge
router.post('/retry/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const response = await rechargeService.retryRecharge(transactionId);

    if (response.success) {
      res.status(200).json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/recharge/dth/history - Get transaction history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { userId, status, operator, page, limit, startDate, endDate } = req.query;

    const history = await rechargeService.getTransactionHistory({
      userId: userId as string | undefined,
      status: status as RechargeStatus | undefined,
      operator: operator as string | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      ...history,
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/recharge/dth/refund/:transactionId - Refund transaction
router.post('/refund/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const response = await rechargeService.refundTransaction(transactionId);

    if (response.success) {
      res.status(200).json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
