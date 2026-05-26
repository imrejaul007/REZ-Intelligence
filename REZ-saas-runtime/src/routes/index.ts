/**
 * REZ SaaS Runtime - Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientType,
  PlanType,
  BillingCycle,
  OnboardingStep,
  CreateTenantRequest,
  CreateSubscriptionRequest,
} from '../types';
import { tenantService } from '../services/tenantService';
import { billingService } from '../services/billingService';
import { onboardingService } from '../services/onboardingService';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// INTERNAL AUTH MIDDLEWARE
// ============================================

function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;
  const expected = process.env.INTERNAL_SERVICE_TOKEN || 'rez-saas-internal-token-change-in-production';

  if (token !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }
  next();
}

// ============================================
// HEALTH
// ============================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ-SaaS-Runtime',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// PLANS
// ============================================

router.get('/api/plans', (_req: Request, res: Response) => {
  const plans = billingService.getPlans();
  res.json({ success: true, data: { plans } });
});

router.get('/api/plans/:planType', (req: Request, res: Response) => {
  const plan = billingService.getPlan(req.params.planType as PlanType);
  if (!plan) {
    res.status(404).json({ success: false, error: 'Plan not found' });
    return;
  }
  res.json({ success: true, data: { plan } });
});

// ============================================
// TENANTS (Admin only)
// ============================================

router.post('/api/tenants', requireInternalToken, async (req: Request, res: Response) => {
  try {
    const request: CreateTenantRequest = {
      clientType: req.body.clientType,
      displayName: req.body.displayName,
      industry: req.body.industry,
      merchantId: req.body.merchantId,
      email: req.body.email,
      phone: req.body.phone,
    };

    if (!request.clientType || !request.displayName || !request.industry || !request.email) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientType, displayName, industry, email',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { tenant, apiKey } = await tenantService.createTenant(request);

    // Start onboarding
    onboardingService.startOnboarding(tenant.tenantId);

    // Create subscription if plan specified
    if (req.body.plan) {
      billingService.createSubscription({
        tenantId: tenant.tenantId,
        plan: req.body.plan as PlanType,
        billingCycle: (req.body.billingCycle as BillingCycle) || BillingCycle.MONTHLY,
      });
    }

    res.status(201).json({
      success: true,
      data: { tenant, apiKey },
      message: 'Tenant created. Save the API key securely - it will not be shown again.',
    });
  } catch (error) {
    logger.error('Create tenant failed', { error });
    res.status(500).json({ success: false, error: 'Failed to create tenant' });
  }
});

router.get('/api/tenants', requireInternalToken, (req: Request, res: Response) => {
  const clientType = req.query.clientType as ClientType | undefined;
  const tenants = tenantService.listTenants(clientType);
  res.json({ success: true, data: { tenants, count: tenants.length } });
});

router.get('/api/tenants/:tenantId', requireInternalToken, (req: Request, res: Response) => {
  const tenant = tenantService.getTenant(req.params.tenantId);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, data: { tenant } });
});

router.put('/api/tenants/:tenantId', requireInternalToken, (req: Request, res: Response) => {
  const tenant = tenantService.updateTenant(req.params.tenantId, req.body);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, data: { tenant } });
});

router.post('/api/tenants/:tenantId/activate', requireInternalToken, (req: Request, res: Response) => {
  const tenant = tenantService.activateTenant(req.params.tenantId);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, data: { tenant } });
});

router.post('/api/tenants/:tenantId/suspend', requireInternalToken, (req: Request, res: Response) => {
  const tenant = tenantService.suspendTenant(req.params.tenantId);
  if (!tenant) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, data: { tenant } });
});

router.delete('/api/tenants/:tenantId', requireInternalToken, (req: Request, res: Response) => {
  const deleted = tenantService.deleteTenant(req.params.tenantId);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, message: 'Tenant deleted' });
});

// ============================================
// SUBSCRIPTIONS
// ============================================

router.post('/api/subscriptions', requireInternalToken, async (req: Request, res: Response) => {
  try {
    const request: CreateSubscriptionRequest = {
      tenantId: req.body.tenantId,
      plan: req.body.plan,
      billingCycle: req.body.billingCycle || BillingCycle.MONTHLY,
      paymentMethodId: req.body.paymentMethodId,
    };

    if (!request.tenantId || !request.plan) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: tenantId, plan',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const subscription = await billingService.createSubscription(request);
    res.status(201).json({ success: true, data: { subscription } });
  } catch (error) {
    logger.error('Create subscription failed', { error });
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

router.get('/api/subscriptions/:tenantId', requireInternalToken, (req: Request, res: Response) => {
  const subscription = billingService.getSubscription(req.params.tenantId);
  if (!subscription) {
    res.status(404).json({ success: false, error: 'Subscription not found' });
    return;
  }
  res.json({ success: true, data: { subscription } });
});

router.post('/api/subscriptions/:tenantId/cancel', requireInternalToken, (req: Request, res: Response) => {
  const immediate = req.body.immediate === true;
  const subscription = billingService.cancelSubscription(req.params.tenantId, immediate);
  if (!subscription) {
    res.status(404).json({ success: false, error: 'Subscription not found' });
    return;
  }
  res.json({ success: true, data: { subscription } });
});

router.post('/api/subscriptions/:tenantId/pause', requireInternalToken, (req: Request, res: Response) => {
  const subscription = billingService.pauseSubscription(req.params.tenantId);
  if (!subscription) {
    res.status(404).json({ success: false, error: 'Subscription not found' });
    return;
  }
  res.json({ success: true, data: { subscription } });
});

router.post('/api/subscriptions/:tenantId/resume', requireInternalToken, (req: Request, res: Response) => {
  const subscription = billingService.resumeSubscription(req.params.tenantId);
  if (!subscription) {
    res.status(404).json({ success: false, error: 'Subscription not found' });
    return;
  }
  res.json({ success: true, data: { subscription } });
});

// ============================================
// USAGE & QUOTAS
// ============================================

router.get('/api/usage/:tenantId', requireInternalToken, (req: Request, res: Response) => {
  const usage = billingService.getUsageMetrics(req.params.tenantId);
  const quota = billingService.checkQuota(req.params.tenantId);
  res.json({
    success: true,
    data: {
      usage,
      quotaAllowed: quota.allowed,
      exceededResources: quota.exceeded,
    },
  });
});

router.post('/api/usage/:tenantId/record', requireInternalToken, (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ success: false, error: 'Endpoint required' });
    return;
  }
  billingService.recordApiUsage(req.params.tenantId, endpoint);
  res.json({ success: true });
});

// ============================================
// ONBOARDING
// ============================================

router.get('/api/onboarding/:tenantId', (req: Request, res: Response) => {
  const progress = onboardingService.getProgress(req.params.tenantId);
  if (!progress) {
    res.status(404).json({ success: false, error: 'Onboarding not found' });
    return;
  }
  res.json({ success: true, data: { progress } });
});

router.post('/api/onboarding/:tenantId/step', (req: Request, res: Response) => {
  const { step, data } = req.body;

  if (!step) {
    res.status(400).json({ success: false, error: 'Step is required' });
    return;
  }

  // Validate step
  const validation = onboardingService.validateStep(step as OnboardingStep, data || {});
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validation.errors,
    });
    return;
  }

  const progress = onboardingService.completeStep(req.params.tenantId, step as OnboardingStep, data || {});
  if (!progress) {
    res.status(404).json({ success: false, error: 'Onboarding not found' });
    return;
  }
  res.json({ success: true, data: { progress } });
});

router.get('/api/onboarding/blueprint', (_req: Request, res: Response) => {
  const blueprint = onboardingService.getOnboardingBlueprint();
  res.json({ success: true, data: blueprint });
});

// ============================================
// API KEY VALIDATION
// ============================================

router.post('/api/validate-key', (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey) {
    res.status(400).json({ success: false, error: 'API key required' });
    return;
  }

  const result = tenantService.validateApiKey(apiKey);
  res.json({
    success: true,
    data: {
      valid: result.valid,
      tenantId: result.tenant?.tenantId,
      clientType: result.clientType,
      status: result.tenant?.status,
    },
  });
});

// ============================================
// EXPORT
// ============================================

export default router;
