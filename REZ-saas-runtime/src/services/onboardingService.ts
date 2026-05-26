/**
 * REZ SaaS Runtime - Onboarding Service
 */

import { v4 as uuidv4 } from 'uuid';
import {
  OnboardingProgress,
  OnboardingStep,
  OnboardingStepData,
  TenantStatus,
} from '../types';
import { tenantService } from './tenantService';
import { billingService } from './billingService';
import { logger } from '../utils/logger.js';

// In-memory store
const onboardingProgress = new Map<string, OnboardingProgress>();

// Step order
const ONBOARDING_STEPS: OnboardingStep[] = [
  OnboardingStep.ACCOUNT,
  OnboardingStep.COMPANY_INFO,
  OnboardingStep.INTEGRATION,
  OnboardingStep.FIRST_WORKFLOW,
  OnboardingStep.BILLING,
  OnboardingStep.COMPLETE,
];

export class OnboardingService {
  /**
   * Start onboarding for a tenant
   */
  startOnboarding(tenantId: string): OnboardingProgress {
    const progress: OnboardingProgress = {
      tenantId,
      currentStep: OnboardingStep.ACCOUNT,
      completedSteps: [],
      stepData: {} as Record<OnboardingStep, Record<string, unknown>>,
      startedAt: new Date(),
    };

    onboardingProgress.set(tenantId, progress);
    logger.info('Onboarding started', { tenantId });

    return progress;
  }

  /**
   * Get onboarding progress
   */
  getProgress(tenantId: string): OnboardingProgress | undefined {
    return onboardingProgress.get(tenantId);
  }

  /**
   * Complete a step
   */
  completeStep(
    tenantId: string,
    step: OnboardingStep,
    data: Record<string, unknown>
  ): OnboardingProgress | undefined {
    const progress = onboardingProgress.get(tenantId);
    if (!progress) {
      logger.warn('Onboarding not started', { tenantId });
      return undefined;
    }

    // Store step data
    progress.stepData[step] = data;

    // Mark step as completed
    if (!progress.completedSteps.includes(step)) {
      progress.completedSteps.push(step);
    }

    // Move to next step
    const currentIndex = ONBOARDING_STEPS.indexOf(step);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      progress.currentStep = ONBOARDING_STEPS[currentIndex + 1];
    }

    // If billing is complete, activate tenant
    if (step === OnboardingStep.BILLING) {
      tenantService.activateTenant(tenantId);
      progress.completedAt = new Date();
    }

    onboardingProgress.set(tenantId, progress);
    logger.info('Onboarding step completed', { tenantId, step });

    return progress;
  }

  /**
   * Get next step
   */
  getNextStep(tenantId: string): OnboardingStep | undefined {
    const progress = onboardingProgress.get(tenantId);
    if (!progress) return undefined;

    if (progress.completedAt) return OnboardingStep.COMPLETE;
    return progress.currentStep;
  }

  /**
   * Validate step completion
   */
  validateStep(step: OnboardingStep, data: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (step) {
      case OnboardingStep.ACCOUNT:
        if (!data.adminName) errors.push('Admin name is required');
        if (!data.adminEmail) errors.push('Admin email is required');
        else if (!this.isValidEmail(data.adminEmail as string)) {
          errors.push('Invalid email format');
        }
        break;

      case OnboardingStep.COMPANY_INFO:
        if (!data.companyName) errors.push('Company name is required');
        if (!data.industry) errors.push('Industry is required');
        break;

      case OnboardingStep.INTEGRATION:
        if (!data.integrationType) errors.push('Integration type is required');
        break;

      case OnboardingStep.FIRST_WORKFLOW:
        // Optional - can skip
        break;

      case OnboardingStep.BILLING:
        if (!data.planSelected) errors.push('Plan selection is required');
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get onboarding template/blueprint
   */
  getOnboardingBlueprint(): {
    steps: Array<{
      step: OnboardingStep;
      title: string;
      description: string;
      fields: Array<{ name: string; type: string; required: boolean; label: string }>;
    }>;
  } {
    return {
      steps: [
        {
          step: OnboardingStep.ACCOUNT,
          title: 'Create Account',
          description: 'Set up your admin account',
          fields: [
            { name: 'adminName', type: 'text', required: true, label: 'Your Name' },
            { name: 'adminEmail', type: 'email', required: true, label: 'Email Address' },
            { name: 'password', type: 'password', required: false, label: 'Password' },
          ],
        },
        {
          step: OnboardingStep.COMPANY_INFO,
          title: 'Company Information',
          description: 'Tell us about your business',
          fields: [
            { name: 'companyName', type: 'text', required: true, label: 'Company Name' },
            {
              name: 'industry',
              type: 'select',
              required: true,
              label: 'Industry',
            },
            { name: 'size', type: 'select', required: false, label: 'Company Size' },
            { name: 'useCase', type: 'textarea', required: false, label: 'Primary Use Case' },
          ],
        },
        {
          step: OnboardingStep.INTEGRATION,
          title: 'Integration',
          description: 'Choose how to integrate REZ Intelligence',
          fields: [
            {
              name: 'integrationType',
              type: 'radio',
              required: true,
              label: 'Integration Method',
            },
          ],
        },
        {
          step: OnboardingStep.FIRST_WORKFLOW,
          title: 'Create First Workflow',
          description: 'Get started with a template or create from scratch',
          fields: [
            {
              name: 'templateUsed',
              type: 'select',
              required: false,
              label: 'Template',
            },
          ],
        },
        {
          step: OnboardingStep.BILLING,
          title: 'Choose Plan',
          description: 'Select a plan that fits your needs',
          fields: [
            { name: 'planSelected', type: 'radio', required: true, label: 'Select Plan' },
          ],
        },
      ],
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

export const onboardingService = new OnboardingService();
