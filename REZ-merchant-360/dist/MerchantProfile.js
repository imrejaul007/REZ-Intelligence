"use strict";
/**
 * MerchantProfile.ts - Canonical Merchant Model for REZ Commerce OS
 * Defines the unified merchant identity structure used across all modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantProfileSchema = exports.AIMemorySchema = exports.AnalyticsSchema = exports.ComplianceSchema = exports.StaffSchema = exports.LoyaltySchema = exports.CRMSchema = exports.InventorySchema = exports.CatalogSchema = exports.FinancesSchema = exports.BusinessHoursSchema = exports.AddressSchema = void 0;
exports.createMerchantProfile = createMerchantProfile;
exports.validateMerchantProfile = validateMerchantProfile;
const zod_1 = require("zod");
// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================
exports.AddressSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    type: zod_1.z.enum(['billing', 'shipping', 'business', 'warehouse', 'registered']),
    street: zod_1.z.string(),
    city: zod_1.z.string(),
    state: zod_1.z.string(),
    postal_code: zod_1.z.string(),
    country: zod_1.z.string().default('US'),
    is_primary: zod_1.z.boolean().default(false),
    coordinates: zod_1.z.object({
        lat: zod_1.z.number().optional(),
        lng: zod_1.z.number().optional(),
    }).optional(),
});
exports.BusinessHoursSchema = zod_1.z.object({
    day: zod_1.z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    open: zod_1.z.string().optional(),
    close: zod_1.z.string().optional(),
    is_closed: zod_1.z.boolean().default(false),
});
exports.FinancesSchema = zod_1.z.object({
    wallet_balance: zod_1.z.number().min(0).default(0),
    pending_payouts: zod_1.z.number().min(0).default(0),
    monthly_revenue: zod_1.z.number().min(0).default(0),
    lifetime_revenue: zod_1.z.number().min(0).default(0),
    credit_score: zod_1.z.number().min(0).max(1000).default(500),
    currency: zod_1.z.string().default('USD'),
    last_earned: zod_1.z.string().datetime().optional(),
    last_payout: zod_1.z.string().datetime().optional(),
});
exports.CatalogSchema = zod_1.z.object({
    total_products: zod_1.z.number().int().min(0).default(0),
    active_products: zod_1.z.number().int().min(0).default(0),
    categories: zod_1.z.array(zod_1.z.string()).default([]),
    last_product_update: zod_1.z.string().datetime().optional(),
    avg_product_rating: zod_1.z.number().min(0).max(5).optional(),
});
exports.InventorySchema = zod_1.z.object({
    total_items: zod_1.z.number().int().min(0).default(0),
    low_stock_alerts: zod_1.z.number().int().min(0).default(0),
    out_of_stock: zod_1.z.number().int().min(0).default(0),
    suppliers: zod_1.z.array(zod_1.z.string()).default([]),
    warehouse_count: zod_1.z.number().int().min(0).default(0),
    last_inventory_sync: zod_1.z.string().datetime().optional(),
});
exports.CRMSchema = zod_1.z.object({
    total_customers: zod_1.z.number().int().min(0).default(0),
    monthly_customers: zod_1.z.number().int().min(0).default(0),
    avg_rating: zod_1.z.number().min(0).max(5).default(0),
    reviews_count: zod_1.z.number().int().min(0).default(0),
    total_feedback: zod_1.z.number().int().min(0).default(0),
    satisfaction_rate: zod_1.z.number().min(0).max(100).optional(),
});
exports.LoyaltySchema = zod_1.z.object({
    program_active: zod_1.z.boolean().default(false),
    active_members: zod_1.z.number().int().min(0).default(0),
    monthly_points_issued: zod_1.z.number().int().min(0).default(0),
    points_balance_total: zod_1.z.number().int().min(0).default(0),
    monthly_redemptions: zod_1.z.number().int().min(0).default(0),
    conversion_rate: zod_1.z.number().min(0).max(100).optional(),
});
exports.StaffSchema = zod_1.z.object({
    total: zod_1.z.number().int().min(0).default(0),
    admins: zod_1.z.number().int().min(0).default(0),
    employees: zod_1.z.number().int().min(0).default(0),
    roles: zod_1.z.record(zod_1.z.string(), zod_1.z.number().int()).optional(),
    last_hire_date: zod_1.z.string().datetime().optional(),
});
exports.ComplianceSchema = zod_1.z.object({
    kyc_status: zod_1.z.enum(['pending', 'verified', 'rejected', 'expired']).default('pending'),
    kyc_verified_at: zod_1.z.string().datetime().optional(),
    kyc_expiry: zod_1.z.string().datetime().optional(),
    tax_verified: zod_1.z.boolean().default(false),
    license_status: zod_1.z.record(zod_1.z.string(), zod_1.z.enum(['valid', 'expired', 'pending'])).optional(),
    risk_score: zod_1.z.number().min(0).max(100).default(0),
    sanctions_check: zod_1.z.boolean().default(false),
});
exports.AnalyticsSchema = zod_1.z.object({
    monthly_orders: zod_1.z.number().int().min(0).default(0),
    avg_order_value: zod_1.z.number().min(0).default(0),
    customer_retention_rate: zod_1.z.number().min(0).max(100).optional(),
    growth_rate: zod_1.z.number().min(-100).max(1000).optional(),
    top_category: zod_1.z.string().optional(),
    peak_hours: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.AIMemorySchema = zod_1.z.object({
    preferences_set: zod_1.z.boolean().default(false),
    automation_rules: zod_1.z.number().int().min(0).default(0),
    last_interaction: zod_1.z.string().datetime().optional(),
    conversation_count: zod_1.z.number().int().min(0).default(0),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    sentiment_trend: zod_1.z.enum(['positive', 'neutral', 'negative']).optional(),
});
exports.MerchantProfileSchema = zod_1.z.object({
    // Identity
    merchant_id: zod_1.z.string().min(1),
    business_name: zod_1.z.string().min(1),
    brand_names: zod_1.z.array(zod_1.z.string()).default([]),
    verticals: zod_1.z.array(zod_1.z.string()).default([]),
    // Contact
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    addresses: zod_1.z.array(exports.AddressSchema).default([]),
    website: zod_1.z.string().url().optional(),
    social_media: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    // Business Info
    business_type: zod_1.z.enum(['sole_proprietor', 'partnership', 'llc', 'corporation', 'nonprofit']).optional(),
    tax_id: zod_1.z.string().optional(),
    registration_number: zod_1.z.string().optional(),
    founded_date: zod_1.z.string().datetime().optional(),
    business_hours: zod_1.z.array(exports.BusinessHoursSchema).optional(),
    // Module Data
    finances: exports.FinancesSchema.default({}),
    catalog: exports.CatalogSchema.default({}),
    inventory: exports.InventorySchema.default({}),
    crm: exports.CRMSchema.default({}),
    loyalty: exports.LoyaltySchema.default({}),
    staff: exports.StaffSchema.default({}),
    compliance: exports.ComplianceSchema.default({}),
    analytics: exports.AnalyticsSchema.default({}),
    ai_memory: exports.AIMemorySchema.default({}),
    // Status
    status: zod_1.z.enum(['active', 'suspended', 'pending_verification', 'closed']).default('active'),
    onboarding_complete: zod_1.z.boolean().default(false),
    // Timestamps
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime(),
    last_sync_at: zod_1.z.string().datetime().optional(),
});
// ============================================
// FACTORY FUNCTION
// ============================================
function createMerchantProfile(data) {
    const now = new Date().toISOString();
    return exports.MerchantProfileSchema.parse({
        ...data,
        finances: exports.FinancesSchema.parse(data.finances || {}),
        catalog: exports.CatalogSchema.parse(data.catalog || {}),
        inventory: exports.InventorySchema.parse(data.inventory || {}),
        crm: exports.CRMSchema.parse(data.crm || {}),
        loyalty: exports.LoyaltySchema.parse(data.loyalty || {}),
        staff: exports.StaffSchema.parse(data.staff || {}),
        compliance: exports.ComplianceSchema.parse(data.compliance || {}),
        analytics: exports.AnalyticsSchema.parse(data.analytics || {}),
        ai_memory: exports.AIMemorySchema.parse(data.ai_memory || {}),
        created_at: data.created_at || now,
        updated_at: now,
    });
}
function validateMerchantProfile(data) {
    return exports.MerchantProfileSchema.parse(data);
}
//# sourceMappingURL=MerchantProfile.js.map