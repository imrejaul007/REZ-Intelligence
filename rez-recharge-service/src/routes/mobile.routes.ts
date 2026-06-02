import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { rechargeService } from '../services/recharge.service.js';
import { operatorService } from '../services/operator.service.js';
import { MobileOperator, RechargeStatus } from '../models/recharge.model.js';

const router = Router();

// Validation schemas
const mobileRechargeSchema = z.object({
  userId: z.string().optional(),
  operator: z.nativeEnum(MobileOperator),
  mobileNumber: z.string().min(10).max(13),
  amount: z.number().min(10).max(10000),
  planId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const balanceCheckSchema = z.object({
  operator: z.string(),
  mobileNumber: z.string().min(10).max(13),
});

const billDetailsSchema = z.object({
  operator: z.string(),
  mobileNumber: z.string().min(10).max(13),
});

// POST /api/recharge/mobile - Process mobile recharge
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = mobileRechargeSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { userId, operator, mobileNumber, amount, planId, scheduledAt, metadata } = validation.data;

    // Validate mobile number format
    if (!operatorService.validateMobileNumber(operator, mobileNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
      return;
    }

    const response = await rechargeService.processMobileRecharge({
      userId,
      operator,
      mobileNumber,
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
    console.error('Mobile recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/recharge/mobile/operators - Get supported mobile operators
router.get('/operators', (req: Request, res: Response) => {
  const operators = operatorService.getSupportedMobileOperators();

  res.json({
    success: true,
    operators: operators.map((op) => ({
      code: op,
      name: op.charAt(0).toUpperCase() + op.slice(1),
    })),
  });
});

// GET /api/recharge/mobile/status/:transactionId - Get transaction status
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
        mobileNumber: transaction.subscriberNumber,
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

// POST /api/recharge/mobile/balance - Check mobile balance
router.post('/balance', async (req: Request, res: Response) => {
  try {
    const validation = balanceCheckSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { operator, mobileNumber } = validation.data;

    if (!operatorService.validateMobileNumber(operator, mobileNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
      return;
    }

    const balance = await rechargeService.getCustomerBalance(
      operator,
      mobileNumber,
      'mobile'
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
      mobileNumber,
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

// POST /api/recharge/mobile/bill - Get bill details for postpaid
router.post('/bill', async (req: Request, res: Response) => {
  try {
    const validation = billDetailsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { operator, mobileNumber } = validation.data;

    if (!operatorService.validateMobileNumber(operator, mobileNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
      return;
    }

    const bill = await rechargeService.getMobileBillDetails(operator, mobileNumber);

    if (!bill) {
      res.status(404).json({
        success: false,
        message: 'Unable to fetch bill details',
      });
      return;
    }

    res.json({
      success: true,
      operator,
      mobileNumber,
      ...bill,
    });
  } catch (error) {
    console.error('Bill details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/recharge/mobile/retry/:transactionId - Retry failed recharge
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

// GET /api/recharge/mobile/history - Get transaction history
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

// POST /api/recharge/mobile/refund/:transactionId - Refund transaction
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
