/**
 * REZ Care Service - Mobile Self-Service API
 *
 * Endpoints for mobile app self-service:
 * - View issue history
 * - Quick actions (retry payment, sync wallet)
 * - Submit feedback
 * - Track refund status
 */

import express, { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { SelfServiceService } from '../services/selfServiceService';
import { CrossPlatformIssueMemory } from '../services/crossPlatformIssueMemory';

const router = express.Router();
const selfService = new SelfServiceService();
const crossPlatformMemory = new CrossPlatformIssueMemory();

// Extended request interface
interface CustomerRequest extends Request {
  customerId?: string;
  phone?: string;
}

// Middleware to extract customer from token/phone
async function extractCustomer(req: CustomerRequest, res: Response, next: Function) {
  // In real app, extract from JWT token
  // For now, use header or body
  const customerId = req.headers['x-customer-id'] || req.body?.customerId;
  const phone = req.headers['x-customer-phone'] || req.body?.phone;

  if (!customerId && !phone) {
    return res.status(401).json({ error: 'Customer ID or phone required' });
  }

  req.customerId = (customerId || phone) as string;
  req.phone = (phone || customerId) as string;
  next();
}

// ============================================
// SELF-SERVICE ACTIONS
// ============================================

/**
 * Get available self-service actions for customer
 */
router.get('/actions', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const actions = await selfService.getAvailableActions(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        actions,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get actions', error);
    res.status(500).json({ error: 'Failed to get actions' });
  }
});

/**
 * Execute self-service action
 */
router.post('/execute', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const { actionType, actionData } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'actionType required' });
    }

    const result = await selfService.executeAction(customerId, actionType, actionData || {});

    res.json({
      success: true,
      data: {
        customerId,
        actionType,
        result,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to execute action', error);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

/**
 * Quick retry payment
 */
router.post('/retry-payment', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId required' });
    }

    const result = await selfService.retryPayment(customerId, orderId);

    res.json({
      success: true,
      data: {
        orderId,
        result,
        message: result.success ? 'Payment retry initiated' : 'Payment retry failed'
      }
    });
  } catch (error) {
    logger.error('Failed to retry payment', error);
    res.status(500).json({ error: 'Failed to retry payment' });
  }
});

/**
 * Quick sync wallet
 */
router.post('/sync-wallet', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const result = await selfService.syncWallet(customerId);

    res.json({
      success: true,
      data: {
        result,
        message: result.success ? 'Wallet synced successfully' : 'Wallet sync failed'
      }
    });
  } catch (error) {
    logger.error('Failed to sync wallet', error);
    res.status(500).json({ error: 'Failed to sync wallet' });
  }
});

/**
 * Retry cashback
 */
router.post('/retry-cashback', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const { transactionId } = req.body;

    const result = await selfService.retryCashback(customerId, transactionId);

    res.json({
      success: true,
      data: {
        transactionId,
        result,
        message: result.success ? 'Cashback retry initiated' : 'Cashback retry failed'
      }
    });
  } catch (error) {
    logger.error('Failed to retry cashback', error);
    res.status(500).json({ error: 'Failed to retry cashback' });
  }
});

// ============================================
// ISSUE HISTORY
// ============================================

/**
 * Get customer's issue history
 */
router.get('/history', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const history = await crossPlatformMemory.getCustomerIssueHistory(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        history,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get history', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * Get similar past issues (for self-help)
 */
router.get('/similar-issues', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const { category, platform } = req.query;

    const issues = await crossPlatformMemory.findSimilarIssues({
      customerId,
      category: category as string,
      platform: platform as string
    });

    res.json({
      success: true,
      data: {
        customerId,
        similarIssues: issues.slice(0, 5),
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get similar issues', error);
    res.status(500).json({ error: 'Failed to get similar issues' });
  }
});

/**
 * Get issue predictions and prevention tips
 */
router.get('/predictions', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const predictions = await crossPlatformMemory.predictCustomerIssues(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        predictions,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get predictions', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// ============================================
// SUBMIT ISSUE
// ============================================

/**
 * Submit new issue (self-service)
 */
router.post('/report-issue', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const phone = req.phone as string;
    const {
      platform,
      category,
      description,
      orderId,
      bookingId,
      merchantId,
      priority
    } = req.body;

    if (!category || !description) {
      return res.status(400).json({ error: 'category and description required' });
    }

    // Record the issue
    const result = await crossPlatformMemory.recordIssue({
      customerId,
      customerPhone: phone,
      platform: platform || 'other',
      partnerId: merchantId || 'unknown',
      partnerName: 'Self-reported',
      partnerType: 'merchant',
      category,
      description,
      orderId,
      bookingId,
      severity: priority || 'medium'
    });

    // Get suggested actions based on issue
    const suggestedActions = await selfService.getAvailableActions(customerId);

    res.json({
      success: true,
      data: {
        issueId: result.issue.issueId,
        isRepeatIssue: result.isRepeatIssue,
        suggestions: result.suggestions,
        suggestedActions: suggestedActions.filter((a) => {
          const action = a as unknown as { category: string; priority: string };
          return action.category === category || action.priority === 'quick';
        }),
        message: 'Issue reported successfully. We\'ll get back to you soon.'
      }
    });
  } catch (error) {
    logger.error('Failed to report issue', error);
    res.status(500).json({ error: 'Failed to report issue' });
  }
});

// ============================================
// FEEDBACK
// ============================================

/**
 * Submit CSAT rating
 */
router.post('/rate', extractCustomer, async (req: CustomerRequest, res: Response) => {
  try {
    const customerId = req.customerId as string;
    const { ticketId, rating, comment } = req.body;

    // In real app, save to CSAT collection
    res.json({
      success: true,
      data: {
        ticketId,
        rating,
        message: 'Thank you for your feedback!'
      }
    });
  } catch (error) {
    logger.error('Failed to submit rating', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

/**
 * Get refund status
 */
router.get('/refund-status/:transactionId', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    // In real app, query payment service
    res.json({
      success: true,
      data: {
        transactionId,
        status: 'processing', // pending, processing, completed, failed
        amount: 0,
        estimatedTime: '3-5 business days',
        message: 'Refund is being processed'
      }
    });
  } catch (error) {
    logger.error('Failed to get refund status', error);
    res.status(500).json({ error: 'Failed to get refund status' });
  }
});

// ============================================
// HELP & FAQ
// ============================================

/**
 * Get help topics
 */
router.get('/help-topics', async (req: Request, res: Response) => {
  const topics = [
    {
      id: 'payment',
      title: 'Payment Issues',
      icon: 'credit-card',
      articles: [
        { id: 'p1', title: 'Payment failed - What to do?', preview: 'If your payment failed, try these steps...' },
        { id: 'p2', title: 'Refund not received', preview: 'Refunds usually take 3-5 business days...' }
      ]
    },
    {
      id: 'order',
      title: 'Order Problems',
      icon: 'package',
      articles: [
        { id: 'o1', title: 'Track your order', preview: 'Use the order tracking feature...' },
        { id: 'o2', title: 'Wrong item received', preview: 'Report within 24 hours for quick resolution...' }
      ]
    },
    {
      id: 'wallet',
      title: 'Wallet & Cashback',
      icon: 'wallet',
      articles: [
        { id: 'w1', title: 'Wallet balance not updated', preview: 'Try syncing your wallet...' },
        { id: 'w2', title: 'Cashback not credited', preview: 'Cashback usually takes 24-48 hours...' }
      ]
    },
    {
      id: 'account',
      title: 'Account & Login',
      icon: 'user',
      articles: [
        { id: 'a1', title: 'Can\'t login', preview: 'Try resetting your password...' },
        { id: 'a2', title: 'Update phone number', preview: 'To update your phone number...' }
      ]
    }
  ];

  res.json({
    success: true,
    data: { topics }
  });
});

/**
 * Get article content
 */
router.get('/help-articles/:articleId', async (req: Request, res: Response) => {
  const { articleId } = req.params;

  // Mock article content
  const articles: Record<string, unknown> = {
    p1: {
      id: 'p1',
      title: 'Payment failed - What to do?',
      content: `# Payment Failed

If your payment didn't go through, here are the steps to resolve it:

## Step 1: Check Payment Method
- Ensure your card/UPI has sufficient balance
- Verify the payment method is active

## Step 2: Try Again
- Wait 5 minutes and try again
- Try a different payment method

## Step 3: Contact Support
If the issue persists, tap "Contact Support" below and we'll help you immediately.`,
      helpful: true,
      notHelpful: false
    }
  };

  res.json({
    success: true,
    data: articles[articleId] || { id: articleId, title: 'Article not found' }
  });
});

export default router;
