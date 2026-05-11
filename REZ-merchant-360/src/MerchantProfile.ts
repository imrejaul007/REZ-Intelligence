/**
 * MerchantProfile.ts - Canonical Merchant Model for REZ Commerce OS
 * Defines the unified merchant identity structure used across all modules
 */

import { z } from 'zod';

// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================

export const AddressSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['billing', 'shipping', 'business', 'warehouse', 'registered']),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string().default('US'),
  is_primary: z.boolean().default(false),
  coordinates: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
});

export const BusinessHoursSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  open: z.string().optional(),
  close: z.string().optional(),
  is_closed: z.boolean().default(false),
});

export const FinancesSchema = z.object({
  wallet_balance: z.number().min(0).default(0),
  pending_payouts: z.number().min(0).default(0),
  monthly_revenue: z.number().min(0).default(0),
  lifetime_revenue: z.number().min(0).default(0),
  credit_score: z.number().min(0).max(1000).default(500),
  currency: z.string().default('USD'),
  last_earned: z.string().datetime().optional(),
  last_payout: z.string().datetime().optional(),
});

export const CatalogSchema = z.object({
  total_products: z.number().int().min(0).default(0),
  active_products: z.number().int().min(0).default(0),
  categories: z.array(z.string()).default([]),
  last_product_update: z.string().datetime().optional(),
  avg_product_rating: z.number().min(0).max(5).optional(),
});

export const InventorySchema = z.object({
  total_items: z.number().int().min(0).default(0),
  low_stock_alerts: z.number().int().min(0).default(0),
  out_of_stock: z.number().int().min(0).default(0),
  suppliers: z.array(z.string()).default([]),
  warehouse_count: z.number().int().min(0).default(0),
  last_inventory_sync: z.string().datetime().optional(),
});

export const CRMSchema = z.object({
  total_customers: z.number().int().min(0).default(0),
  monthly_customers: z.number().int().min(0).default(0),
  avg_rating: z.number().min(0).max(5).default(0),
  reviews_count: z.number().int().min(0).default(0),
  total_feedback: z.number().int().min(0).default(0),
  satisfaction_rate: z.number().min(0).max(100).optional(),
});

export const LoyaltySchema = z.object({
  program_active: z.boolean().default(false),
  active_members: z.number().int().min(0).default(0),
  monthly_points_issued: z.number().int().min(0).default(0),
  points_balance_total: z.number().int().min(0).default(0),
  monthly_redemptions: z.number().int().min(0).default(0),
  conversion_rate: z.number().min(0).max(100).optional(),
});

export const StaffSchema = z.object({
  total: z.number().int().min(0).default(0),
  admins: z.number().int().min(0).default(0),
  employees: z.number().int().min(0).default(0),
  roles: z.record(z.string(), z.number().int()).optional(),
  last_hire_date: z.string().datetime().optional(),
});

export const ComplianceSchema = z.object({
  kyc_status: z.enum(['pending', 'verified', 'rejected', 'expired']).default('pending'),
  kyc_verified_at: z.string().datetime().optional(),
  kyc_expiry: z.string().datetime().optional(),
  tax_verified: z.boolean().default(false),
  license_status: z.record(z.string(), z.enum(['valid', 'expired', 'pending'])).optional(),
  risk_score: z.number().min(0).max(100).default(0),
  sanctions_check: z.boolean().default(false),
});

export const AnalyticsSchema = z.object({
  monthly_orders: z.number().int().min(0).default(0),
  avg_order_value: z.number().min(0).default(0),
  customer_retention_rate: z.number().min(0).max(100).optional(),
  growth_rate: z.number().min(-100).max(1000).optional(),
  top_category: z.string().optional(),
  peak_hours: z.array(z.string()).optional(),
});

export const AIMemorySchema = z.object({
  preferences_set: z.boolean().default(false),
  automation_rules: z.number().int().min(0).default(0),
  last_interaction: z.string().datetime().optional(),
  conversation_count: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  sentiment_trend: z.enum(['positive', 'neutral', 'negative']).optional(),
});

export const MerchantProfileSchema = z.object({
  // Identity
  merchant_id: z.string().min(1),
  business_name: z.string().min(1),
  brand_names: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),

  // Contact
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addresses: z.array(AddressSchema).default([]),
  website: z.string().url().optional(),
  social_media: z.record(z.string(), z.string()).optional(),

  // Business Info
  business_type: z.enum(['sole_proprietor', 'partnership', 'llc', 'corporation', 'nonprofit']).optional(),
  tax_id: z.string().optional(),
  registration_number: z.string().optional(),
  founded_date: z.string().datetime().optional(),
  business_hours: z.array(BusinessHoursSchema).optional(),

  // Module Data
  finances: FinancesSchema.default({}),
  catalog: CatalogSchema.default({}),
  inventory: InventorySchema.default({}),
  crm: CRMSchema.default({}),
  loyalty: LoyaltySchema.default({}),
  staff: StaffSchema.default({}),
  compliance: ComplianceSchema.default({}),
  analytics: AnalyticsSchema.default({}),
  ai_memory: AIMemorySchema.default({}),

  // Status
  status: z.enum(['active', 'suspended', 'pending_verification', 'closed']).default('active'),
  onboarding_complete: z.boolean().default(false),

  // Timestamps
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_sync_at: z.string().datetime().optional(),
});

// ============================================
// TYPESCRIPT INTERFACES
// ============================================

export interface Address {
  id?: string;
  type: 'billing' | 'shipping' | 'business' | 'warehouse' | 'registered';
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  is_primary?: boolean;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
}

export interface BusinessHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open?: string;
  close?: string;
  is_closed?: boolean;
}

export interface Finances {
  wallet_balance: number;
  pending_payouts: number;
  monthly_revenue: number;
  lifetime_revenue: number;
  credit_score: number;
  currency?: string;
  last_earned?: string;
  last_payout?: string;
}

export interface Catalog {
  total_products: number;
  active_products: number;
  categories: string[];
  last_product_update?: string;
  avg_product_rating?: number;
}

export interface Inventory {
  total_items: number;
  low_stock_alerts: number;
  out_of_stock?: number;
  suppliers: string[];
  warehouse_count?: number;
  last_inventory_sync?: string;
}

export interface CRM {
  total_customers: number;
  monthly_customers: number;
  avg_rating: number;
  reviews_count: number;
  total_feedback?: number;
  satisfaction_rate?: number;
}

export interface Loyalty {
  program_active: boolean;
  active_members: number;
  monthly_points_issued: number;
  points_balance_total?: number;
  monthly_redemptions?: number;
  conversion_rate?: number;
}

export interface Staff {
  total: number;
  admins: number;
  employees: number;
  roles?: Record<string, number>;
  last_hire_date?: string;
}

export interface Compliance {
  kyc_status: 'pending' | 'verified' | 'rejected' | 'expired';
  kyc_verified_at?: string;
  kyc_expiry?: string;
  tax_verified?: boolean;
  license_status?: Record<string, 'valid' | 'expired' | 'pending'>;
  risk_score?: number;
  sanctions_check?: boolean;
}

export interface Analytics {
  monthly_orders?: number;
  avg_order_value?: number;
  customer_retention_rate?: number;
  growth_rate?: number;
  top_category?: string;
  peak_hours?: string[];
}

export interface AIMemory {
  preferences_set: boolean;
  automation_rules: number;
  last_interaction?: string;
  conversation_count?: number;
  tags?: string[];
  sentiment_trend?: 'positive' | 'neutral' | 'negative';
}

export interface Merchant360 {
  // Identity
  merchant_id: string;
  business_name: string;
  brand_names: string[];
  verticals: string[];

  // Contact
  email?: string;
  phone?: string;
  addresses: Address[];
  website?: string;
  social_media?: Record<string, string>;

  // Business Info
  business_type?: 'sole_proprietor' | 'partnership' | 'llc' | 'corporation' | 'nonprofit';
  tax_id?: string;
  registration_number?: string;
  founded_date?: string;
  business_hours?: BusinessHours[];

  // Module Data
  finances: Finances;
  catalog: Catalog;
  inventory: Inventory;
  crm: CRM;
  loyalty: Loyalty;
  staff: Staff;
  compliance: Compliance;
  analytics: Analytics;
  ai_memory: AIMemory;

  // Status
  status: 'active' | 'suspended' | 'pending_verification' | 'closed';
  onboarding_complete: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  last_sync_at?: string;
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createMerchantProfile(data: Partial<Merchant360> & { merchant_id: string; business_name: string }): Merchant360 {
  const now = new Date().toISOString();

  return MerchantProfileSchema.parse({
    ...data,
    finances: FinancesSchema.parse(data.finances || {}),
    catalog: CatalogSchema.parse(data.catalog || {}),
    inventory: InventorySchema.parse(data.inventory || {}),
    crm: CRMSchema.parse(data.crm || {}),
    loyalty: LoyaltySchema.parse(data.loyalty || {}),
    staff: StaffSchema.parse(data.staff || {}),
    compliance: ComplianceSchema.parse(data.compliance || {}),
    analytics: AnalyticsSchema.parse(data.analytics || {}),
    ai_memory: AIMemorySchema.parse(data.ai_memory || {}),
    created_at: data.created_at || now,
    updated_at: now,
  });
}

export function validateMerchantProfile(data: unknown): Merchant360 {
  return MerchantProfileSchema.parse(data);
}
