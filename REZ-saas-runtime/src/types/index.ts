/**
 * REZ SaaS Runtime - Types
 */

// ============================================
// ENUMS
// ============================================

export enum ClientType {
  REZ_ECOSYSTEM = 'REZ_ECOSYSTEM',
  NON_REZ = 'NON_REZ',
  RABTUL_SAAS = 'RABTUL_SAAS',
}

export enum IntelligenceLevel {
  FULL = 'FULL',
  ISOLATED = 'ISOLATED',
  ANONYMIZED = 'ANONYMIZED',
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

// ============================================
// TENANT
// ============================================

export interface Tenant {
  id: string;
  tenantId: string;
  clientType: ClientType;
  displayName: string;
  industry: string;
  merchantId?: string;
  email: string;
  phone?: string;
  status: TenantStatus;
  intelligenceLevel: IntelligenceLevel;
  dataIsolation: 'shared' | 'strict';
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantRequest {
  clientType: ClientType;
  displayName: string;
  industry: string;
  merchantId?: string;
  email: string;
  phone?: string;
  plan?: PlanType;
}

export interface UpdateTenantRequest {
  displayName?: string;
  industry?: string;
  email?: string;
  phone?: string;
  status?: TenantStatus;
}

// ============================================
// SUBSCRIPTION & BILLING
// ============================================

export interface Subscription {
  id: string;
  tenantId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionRequest {
  tenantId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  paymentMethodId?: string;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: PlanFeature[];
  limits: PlanLimits;
}

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  apiRequestsPerMonth: number;
  workflows: number;
  users: number;
  storage: number; // in MB
  support: 'email' | 'chat' | 'phone';
}

// ============================================
// ONBOARDING
// ============================================

export interface OnboardingProgress {
  tenantId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  stepData: Record<OnboardingStep, Record<string, unknown>>;
  startedAt: Date;
  completedAt?: Date;
}

export enum OnboardingStep {
  ACCOUNT = 'account',
  COMPANY_INFO = 'company_info',
  INTEGRATION = 'integration',
  FIRST_WORKFLOW = 'first_workflow',
  BILLING = 'billing',
  COMPLETE = 'complete',
}

export interface OnboardingStepData {
  [OnboardingStep.ACCOUNT]: {
    adminName: string;
    adminEmail: string;
    password?: string;
  };
  [OnboardingStep.COMPANY_INFO]: {
    companyName: string;
    industry: string;
    size: string;
    useCase: string;
  };
  [OnboardingStep.INTEGRATION]: {
    integrationType: 'api' | 'sdk' | 'webhook';
    connectedServices: string[];
  };
  [OnboardingStep.FIRST_WORKFLOW]: {
    workflowId?: string;
    templateUsed?: string;
  };
  [OnboardingStep.BILLING]: {
    planSelected: PlanType;
    paymentCompleted: boolean;
  };
}

// ============================================
// USAGE & QUOTAS
// ============================================

export interface UsageMetrics {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  apiRequests: number;
  workflowExecutions: number;
  activeUsers: number;
  storageUsed: number;
  apiCallsByEndpoint: Record<string, number>;
}

export interface QuotaExceeded {
  resource: string;
  limit: number;
  used: number;
  resetAt: Date;
}

// ============================================
// WEBHOOKS
// ============================================

export interface WebhookEvent {
  id: string;
  tenantId: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  createdAt: Date;
}

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

// ============================================
// API RESPONSE
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
