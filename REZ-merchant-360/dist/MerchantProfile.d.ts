/**
 * MerchantProfile.ts - Canonical Merchant Model for REZ Commerce OS
 * Defines the unified merchant identity structure used across all modules
 */
import { z } from 'zod';
export declare const AddressSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["billing", "shipping", "business", "warehouse", "registered"]>;
    street: z.ZodString;
    city: z.ZodString;
    state: z.ZodString;
    postal_code: z.ZodString;
    country: z.ZodDefault<z.ZodString>;
    is_primary: z.ZodDefault<z.ZodBoolean>;
    coordinates: z.ZodOptional<z.ZodObject<{
        lat: z.ZodOptional<z.ZodNumber>;
        lng: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        lat?: number | undefined;
        lng?: number | undefined;
    }, {
        lat?: number | undefined;
        lng?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "billing" | "shipping" | "business" | "warehouse" | "registered";
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_primary: boolean;
    id?: string | undefined;
    coordinates?: {
        lat?: number | undefined;
        lng?: number | undefined;
    } | undefined;
}, {
    type: "billing" | "shipping" | "business" | "warehouse" | "registered";
    street: string;
    city: string;
    state: string;
    postal_code: string;
    id?: string | undefined;
    country?: string | undefined;
    is_primary?: boolean | undefined;
    coordinates?: {
        lat?: number | undefined;
        lng?: number | undefined;
    } | undefined;
}>;
export declare const BusinessHoursSchema: z.ZodObject<{
    day: z.ZodEnum<["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]>;
    open: z.ZodOptional<z.ZodString>;
    close: z.ZodOptional<z.ZodString>;
    is_closed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
    is_closed: boolean;
    open?: string | undefined;
    close?: string | undefined;
}, {
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
    open?: string | undefined;
    close?: string | undefined;
    is_closed?: boolean | undefined;
}>;
export declare const FinancesSchema: z.ZodObject<{
    wallet_balance: z.ZodDefault<z.ZodNumber>;
    pending_payouts: z.ZodDefault<z.ZodNumber>;
    monthly_revenue: z.ZodDefault<z.ZodNumber>;
    lifetime_revenue: z.ZodDefault<z.ZodNumber>;
    credit_score: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    last_earned: z.ZodOptional<z.ZodString>;
    last_payout: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    wallet_balance: number;
    pending_payouts: number;
    monthly_revenue: number;
    lifetime_revenue: number;
    credit_score: number;
    currency: string;
    last_earned?: string | undefined;
    last_payout?: string | undefined;
}, {
    wallet_balance?: number | undefined;
    pending_payouts?: number | undefined;
    monthly_revenue?: number | undefined;
    lifetime_revenue?: number | undefined;
    credit_score?: number | undefined;
    currency?: string | undefined;
    last_earned?: string | undefined;
    last_payout?: string | undefined;
}>;
export declare const CatalogSchema: z.ZodObject<{
    total_products: z.ZodDefault<z.ZodNumber>;
    active_products: z.ZodDefault<z.ZodNumber>;
    categories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    last_product_update: z.ZodOptional<z.ZodString>;
    avg_product_rating: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    total_products: number;
    active_products: number;
    categories: string[];
    last_product_update?: string | undefined;
    avg_product_rating?: number | undefined;
}, {
    total_products?: number | undefined;
    active_products?: number | undefined;
    categories?: string[] | undefined;
    last_product_update?: string | undefined;
    avg_product_rating?: number | undefined;
}>;
export declare const InventorySchema: z.ZodObject<{
    total_items: z.ZodDefault<z.ZodNumber>;
    low_stock_alerts: z.ZodDefault<z.ZodNumber>;
    out_of_stock: z.ZodDefault<z.ZodNumber>;
    suppliers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    warehouse_count: z.ZodDefault<z.ZodNumber>;
    last_inventory_sync: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    total_items: number;
    low_stock_alerts: number;
    out_of_stock: number;
    suppliers: string[];
    warehouse_count: number;
    last_inventory_sync?: string | undefined;
}, {
    total_items?: number | undefined;
    low_stock_alerts?: number | undefined;
    out_of_stock?: number | undefined;
    suppliers?: string[] | undefined;
    warehouse_count?: number | undefined;
    last_inventory_sync?: string | undefined;
}>;
export declare const CRMSchema: z.ZodObject<{
    total_customers: z.ZodDefault<z.ZodNumber>;
    monthly_customers: z.ZodDefault<z.ZodNumber>;
    avg_rating: z.ZodDefault<z.ZodNumber>;
    reviews_count: z.ZodDefault<z.ZodNumber>;
    total_feedback: z.ZodDefault<z.ZodNumber>;
    satisfaction_rate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    total_customers: number;
    monthly_customers: number;
    avg_rating: number;
    reviews_count: number;
    total_feedback: number;
    satisfaction_rate?: number | undefined;
}, {
    total_customers?: number | undefined;
    monthly_customers?: number | undefined;
    avg_rating?: number | undefined;
    reviews_count?: number | undefined;
    total_feedback?: number | undefined;
    satisfaction_rate?: number | undefined;
}>;
export declare const LoyaltySchema: z.ZodObject<{
    program_active: z.ZodDefault<z.ZodBoolean>;
    active_members: z.ZodDefault<z.ZodNumber>;
    monthly_points_issued: z.ZodDefault<z.ZodNumber>;
    points_balance_total: z.ZodDefault<z.ZodNumber>;
    monthly_redemptions: z.ZodDefault<z.ZodNumber>;
    conversion_rate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    program_active: boolean;
    active_members: number;
    monthly_points_issued: number;
    points_balance_total: number;
    monthly_redemptions: number;
    conversion_rate?: number | undefined;
}, {
    program_active?: boolean | undefined;
    active_members?: number | undefined;
    monthly_points_issued?: number | undefined;
    points_balance_total?: number | undefined;
    monthly_redemptions?: number | undefined;
    conversion_rate?: number | undefined;
}>;
export declare const StaffSchema: z.ZodObject<{
    total: z.ZodDefault<z.ZodNumber>;
    admins: z.ZodDefault<z.ZodNumber>;
    employees: z.ZodDefault<z.ZodNumber>;
    roles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    last_hire_date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    total: number;
    admins: number;
    employees: number;
    roles?: Record<string, number> | undefined;
    last_hire_date?: string | undefined;
}, {
    total?: number | undefined;
    admins?: number | undefined;
    employees?: number | undefined;
    roles?: Record<string, number> | undefined;
    last_hire_date?: string | undefined;
}>;
export declare const ComplianceSchema: z.ZodObject<{
    kyc_status: z.ZodDefault<z.ZodEnum<["pending", "verified", "rejected", "expired"]>>;
    kyc_verified_at: z.ZodOptional<z.ZodString>;
    kyc_expiry: z.ZodOptional<z.ZodString>;
    tax_verified: z.ZodDefault<z.ZodBoolean>;
    license_status: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<["valid", "expired", "pending"]>>>;
    risk_score: z.ZodDefault<z.ZodNumber>;
    sanctions_check: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kyc_status: "pending" | "verified" | "rejected" | "expired";
    tax_verified: boolean;
    risk_score: number;
    sanctions_check: boolean;
    kyc_verified_at?: string | undefined;
    kyc_expiry?: string | undefined;
    license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
}, {
    kyc_status?: "pending" | "verified" | "rejected" | "expired" | undefined;
    kyc_verified_at?: string | undefined;
    kyc_expiry?: string | undefined;
    tax_verified?: boolean | undefined;
    license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
    risk_score?: number | undefined;
    sanctions_check?: boolean | undefined;
}>;
export declare const AnalyticsSchema: z.ZodObject<{
    monthly_orders: z.ZodDefault<z.ZodNumber>;
    avg_order_value: z.ZodDefault<z.ZodNumber>;
    customer_retention_rate: z.ZodOptional<z.ZodNumber>;
    growth_rate: z.ZodOptional<z.ZodNumber>;
    top_category: z.ZodOptional<z.ZodString>;
    peak_hours: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    monthly_orders: number;
    avg_order_value: number;
    customer_retention_rate?: number | undefined;
    growth_rate?: number | undefined;
    top_category?: string | undefined;
    peak_hours?: string[] | undefined;
}, {
    monthly_orders?: number | undefined;
    avg_order_value?: number | undefined;
    customer_retention_rate?: number | undefined;
    growth_rate?: number | undefined;
    top_category?: string | undefined;
    peak_hours?: string[] | undefined;
}>;
export declare const AIMemorySchema: z.ZodObject<{
    preferences_set: z.ZodDefault<z.ZodBoolean>;
    automation_rules: z.ZodDefault<z.ZodNumber>;
    last_interaction: z.ZodOptional<z.ZodString>;
    conversation_count: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sentiment_trend: z.ZodOptional<z.ZodEnum<["positive", "neutral", "negative"]>>;
}, "strip", z.ZodTypeAny, {
    preferences_set: boolean;
    automation_rules: number;
    conversation_count: number;
    tags: string[];
    last_interaction?: string | undefined;
    sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
}, {
    preferences_set?: boolean | undefined;
    automation_rules?: number | undefined;
    last_interaction?: string | undefined;
    conversation_count?: number | undefined;
    tags?: string[] | undefined;
    sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
}>;
export declare const MerchantProfileSchema: z.ZodObject<{
    merchant_id: z.ZodString;
    business_name: z.ZodString;
    brand_names: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    verticals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    addresses: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["billing", "shipping", "business", "warehouse", "registered"]>;
        street: z.ZodString;
        city: z.ZodString;
        state: z.ZodString;
        postal_code: z.ZodString;
        country: z.ZodDefault<z.ZodString>;
        is_primary: z.ZodDefault<z.ZodBoolean>;
        coordinates: z.ZodOptional<z.ZodObject<{
            lat: z.ZodOptional<z.ZodNumber>;
            lng: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            lat?: number | undefined;
            lng?: number | undefined;
        }, {
            lat?: number | undefined;
            lng?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "billing" | "shipping" | "business" | "warehouse" | "registered";
        street: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
        is_primary: boolean;
        id?: string | undefined;
        coordinates?: {
            lat?: number | undefined;
            lng?: number | undefined;
        } | undefined;
    }, {
        type: "billing" | "shipping" | "business" | "warehouse" | "registered";
        street: string;
        city: string;
        state: string;
        postal_code: string;
        id?: string | undefined;
        country?: string | undefined;
        is_primary?: boolean | undefined;
        coordinates?: {
            lat?: number | undefined;
            lng?: number | undefined;
        } | undefined;
    }>, "many">>;
    website: z.ZodOptional<z.ZodString>;
    social_media: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    business_type: z.ZodOptional<z.ZodEnum<["sole_proprietor", "partnership", "llc", "corporation", "nonprofit"]>>;
    tax_id: z.ZodOptional<z.ZodString>;
    registration_number: z.ZodOptional<z.ZodString>;
    founded_date: z.ZodOptional<z.ZodString>;
    business_hours: z.ZodOptional<z.ZodArray<z.ZodObject<{
        day: z.ZodEnum<["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]>;
        open: z.ZodOptional<z.ZodString>;
        close: z.ZodOptional<z.ZodString>;
        is_closed: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        is_closed: boolean;
        open?: string | undefined;
        close?: string | undefined;
    }, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        open?: string | undefined;
        close?: string | undefined;
        is_closed?: boolean | undefined;
    }>, "many">>;
    finances: z.ZodDefault<z.ZodObject<{
        wallet_balance: z.ZodDefault<z.ZodNumber>;
        pending_payouts: z.ZodDefault<z.ZodNumber>;
        monthly_revenue: z.ZodDefault<z.ZodNumber>;
        lifetime_revenue: z.ZodDefault<z.ZodNumber>;
        credit_score: z.ZodDefault<z.ZodNumber>;
        currency: z.ZodDefault<z.ZodString>;
        last_earned: z.ZodOptional<z.ZodString>;
        last_payout: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        wallet_balance: number;
        pending_payouts: number;
        monthly_revenue: number;
        lifetime_revenue: number;
        credit_score: number;
        currency: string;
        last_earned?: string | undefined;
        last_payout?: string | undefined;
    }, {
        wallet_balance?: number | undefined;
        pending_payouts?: number | undefined;
        monthly_revenue?: number | undefined;
        lifetime_revenue?: number | undefined;
        credit_score?: number | undefined;
        currency?: string | undefined;
        last_earned?: string | undefined;
        last_payout?: string | undefined;
    }>>;
    catalog: z.ZodDefault<z.ZodObject<{
        total_products: z.ZodDefault<z.ZodNumber>;
        active_products: z.ZodDefault<z.ZodNumber>;
        categories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        last_product_update: z.ZodOptional<z.ZodString>;
        avg_product_rating: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        total_products: number;
        active_products: number;
        categories: string[];
        last_product_update?: string | undefined;
        avg_product_rating?: number | undefined;
    }, {
        total_products?: number | undefined;
        active_products?: number | undefined;
        categories?: string[] | undefined;
        last_product_update?: string | undefined;
        avg_product_rating?: number | undefined;
    }>>;
    inventory: z.ZodDefault<z.ZodObject<{
        total_items: z.ZodDefault<z.ZodNumber>;
        low_stock_alerts: z.ZodDefault<z.ZodNumber>;
        out_of_stock: z.ZodDefault<z.ZodNumber>;
        suppliers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        warehouse_count: z.ZodDefault<z.ZodNumber>;
        last_inventory_sync: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        total_items: number;
        low_stock_alerts: number;
        out_of_stock: number;
        suppliers: string[];
        warehouse_count: number;
        last_inventory_sync?: string | undefined;
    }, {
        total_items?: number | undefined;
        low_stock_alerts?: number | undefined;
        out_of_stock?: number | undefined;
        suppliers?: string[] | undefined;
        warehouse_count?: number | undefined;
        last_inventory_sync?: string | undefined;
    }>>;
    crm: z.ZodDefault<z.ZodObject<{
        total_customers: z.ZodDefault<z.ZodNumber>;
        monthly_customers: z.ZodDefault<z.ZodNumber>;
        avg_rating: z.ZodDefault<z.ZodNumber>;
        reviews_count: z.ZodDefault<z.ZodNumber>;
        total_feedback: z.ZodDefault<z.ZodNumber>;
        satisfaction_rate: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        total_customers: number;
        monthly_customers: number;
        avg_rating: number;
        reviews_count: number;
        total_feedback: number;
        satisfaction_rate?: number | undefined;
    }, {
        total_customers?: number | undefined;
        monthly_customers?: number | undefined;
        avg_rating?: number | undefined;
        reviews_count?: number | undefined;
        total_feedback?: number | undefined;
        satisfaction_rate?: number | undefined;
    }>>;
    loyalty: z.ZodDefault<z.ZodObject<{
        program_active: z.ZodDefault<z.ZodBoolean>;
        active_members: z.ZodDefault<z.ZodNumber>;
        monthly_points_issued: z.ZodDefault<z.ZodNumber>;
        points_balance_total: z.ZodDefault<z.ZodNumber>;
        monthly_redemptions: z.ZodDefault<z.ZodNumber>;
        conversion_rate: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        program_active: boolean;
        active_members: number;
        monthly_points_issued: number;
        points_balance_total: number;
        monthly_redemptions: number;
        conversion_rate?: number | undefined;
    }, {
        program_active?: boolean | undefined;
        active_members?: number | undefined;
        monthly_points_issued?: number | undefined;
        points_balance_total?: number | undefined;
        monthly_redemptions?: number | undefined;
        conversion_rate?: number | undefined;
    }>>;
    staff: z.ZodDefault<z.ZodObject<{
        total: z.ZodDefault<z.ZodNumber>;
        admins: z.ZodDefault<z.ZodNumber>;
        employees: z.ZodDefault<z.ZodNumber>;
        roles: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        last_hire_date: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        total: number;
        admins: number;
        employees: number;
        roles?: Record<string, number> | undefined;
        last_hire_date?: string | undefined;
    }, {
        total?: number | undefined;
        admins?: number | undefined;
        employees?: number | undefined;
        roles?: Record<string, number> | undefined;
        last_hire_date?: string | undefined;
    }>>;
    compliance: z.ZodDefault<z.ZodObject<{
        kyc_status: z.ZodDefault<z.ZodEnum<["pending", "verified", "rejected", "expired"]>>;
        kyc_verified_at: z.ZodOptional<z.ZodString>;
        kyc_expiry: z.ZodOptional<z.ZodString>;
        tax_verified: z.ZodDefault<z.ZodBoolean>;
        license_status: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<["valid", "expired", "pending"]>>>;
        risk_score: z.ZodDefault<z.ZodNumber>;
        sanctions_check: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        kyc_status: "pending" | "verified" | "rejected" | "expired";
        tax_verified: boolean;
        risk_score: number;
        sanctions_check: boolean;
        kyc_verified_at?: string | undefined;
        kyc_expiry?: string | undefined;
        license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
    }, {
        kyc_status?: "pending" | "verified" | "rejected" | "expired" | undefined;
        kyc_verified_at?: string | undefined;
        kyc_expiry?: string | undefined;
        tax_verified?: boolean | undefined;
        license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
        risk_score?: number | undefined;
        sanctions_check?: boolean | undefined;
    }>>;
    analytics: z.ZodDefault<z.ZodObject<{
        monthly_orders: z.ZodDefault<z.ZodNumber>;
        avg_order_value: z.ZodDefault<z.ZodNumber>;
        customer_retention_rate: z.ZodOptional<z.ZodNumber>;
        growth_rate: z.ZodOptional<z.ZodNumber>;
        top_category: z.ZodOptional<z.ZodString>;
        peak_hours: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        monthly_orders: number;
        avg_order_value: number;
        customer_retention_rate?: number | undefined;
        growth_rate?: number | undefined;
        top_category?: string | undefined;
        peak_hours?: string[] | undefined;
    }, {
        monthly_orders?: number | undefined;
        avg_order_value?: number | undefined;
        customer_retention_rate?: number | undefined;
        growth_rate?: number | undefined;
        top_category?: string | undefined;
        peak_hours?: string[] | undefined;
    }>>;
    ai_memory: z.ZodDefault<z.ZodObject<{
        preferences_set: z.ZodDefault<z.ZodBoolean>;
        automation_rules: z.ZodDefault<z.ZodNumber>;
        last_interaction: z.ZodOptional<z.ZodString>;
        conversation_count: z.ZodDefault<z.ZodNumber>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        sentiment_trend: z.ZodOptional<z.ZodEnum<["positive", "neutral", "negative"]>>;
    }, "strip", z.ZodTypeAny, {
        preferences_set: boolean;
        automation_rules: number;
        conversation_count: number;
        tags: string[];
        last_interaction?: string | undefined;
        sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
    }, {
        preferences_set?: boolean | undefined;
        automation_rules?: number | undefined;
        last_interaction?: string | undefined;
        conversation_count?: number | undefined;
        tags?: string[] | undefined;
        sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
    }>>;
    status: z.ZodDefault<z.ZodEnum<["active", "suspended", "pending_verification", "closed"]>>;
    onboarding_complete: z.ZodDefault<z.ZodBoolean>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    last_sync_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended" | "pending_verification" | "closed";
    merchant_id: string;
    business_name: string;
    brand_names: string[];
    verticals: string[];
    addresses: {
        type: "billing" | "shipping" | "business" | "warehouse" | "registered";
        street: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
        is_primary: boolean;
        id?: string | undefined;
        coordinates?: {
            lat?: number | undefined;
            lng?: number | undefined;
        } | undefined;
    }[];
    finances: {
        wallet_balance: number;
        pending_payouts: number;
        monthly_revenue: number;
        lifetime_revenue: number;
        credit_score: number;
        currency: string;
        last_earned?: string | undefined;
        last_payout?: string | undefined;
    };
    catalog: {
        total_products: number;
        active_products: number;
        categories: string[];
        last_product_update?: string | undefined;
        avg_product_rating?: number | undefined;
    };
    inventory: {
        total_items: number;
        low_stock_alerts: number;
        out_of_stock: number;
        suppliers: string[];
        warehouse_count: number;
        last_inventory_sync?: string | undefined;
    };
    crm: {
        total_customers: number;
        monthly_customers: number;
        avg_rating: number;
        reviews_count: number;
        total_feedback: number;
        satisfaction_rate?: number | undefined;
    };
    loyalty: {
        program_active: boolean;
        active_members: number;
        monthly_points_issued: number;
        points_balance_total: number;
        monthly_redemptions: number;
        conversion_rate?: number | undefined;
    };
    staff: {
        total: number;
        admins: number;
        employees: number;
        roles?: Record<string, number> | undefined;
        last_hire_date?: string | undefined;
    };
    compliance: {
        kyc_status: "pending" | "verified" | "rejected" | "expired";
        tax_verified: boolean;
        risk_score: number;
        sanctions_check: boolean;
        kyc_verified_at?: string | undefined;
        kyc_expiry?: string | undefined;
        license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
    };
    analytics: {
        monthly_orders: number;
        avg_order_value: number;
        customer_retention_rate?: number | undefined;
        growth_rate?: number | undefined;
        top_category?: string | undefined;
        peak_hours?: string[] | undefined;
    };
    ai_memory: {
        preferences_set: boolean;
        automation_rules: number;
        conversation_count: number;
        tags: string[];
        last_interaction?: string | undefined;
        sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
    };
    onboarding_complete: boolean;
    created_at: string;
    updated_at: string;
    email?: string | undefined;
    phone?: string | undefined;
    website?: string | undefined;
    social_media?: Record<string, string> | undefined;
    business_type?: "sole_proprietor" | "partnership" | "llc" | "corporation" | "nonprofit" | undefined;
    tax_id?: string | undefined;
    registration_number?: string | undefined;
    founded_date?: string | undefined;
    business_hours?: {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        is_closed: boolean;
        open?: string | undefined;
        close?: string | undefined;
    }[] | undefined;
    last_sync_at?: string | undefined;
}, {
    merchant_id: string;
    business_name: string;
    created_at: string;
    updated_at: string;
    status?: "active" | "suspended" | "pending_verification" | "closed" | undefined;
    brand_names?: string[] | undefined;
    verticals?: string[] | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    addresses?: {
        type: "billing" | "shipping" | "business" | "warehouse" | "registered";
        street: string;
        city: string;
        state: string;
        postal_code: string;
        id?: string | undefined;
        country?: string | undefined;
        is_primary?: boolean | undefined;
        coordinates?: {
            lat?: number | undefined;
            lng?: number | undefined;
        } | undefined;
    }[] | undefined;
    website?: string | undefined;
    social_media?: Record<string, string> | undefined;
    business_type?: "sole_proprietor" | "partnership" | "llc" | "corporation" | "nonprofit" | undefined;
    tax_id?: string | undefined;
    registration_number?: string | undefined;
    founded_date?: string | undefined;
    business_hours?: {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        open?: string | undefined;
        close?: string | undefined;
        is_closed?: boolean | undefined;
    }[] | undefined;
    finances?: {
        wallet_balance?: number | undefined;
        pending_payouts?: number | undefined;
        monthly_revenue?: number | undefined;
        lifetime_revenue?: number | undefined;
        credit_score?: number | undefined;
        currency?: string | undefined;
        last_earned?: string | undefined;
        last_payout?: string | undefined;
    } | undefined;
    catalog?: {
        total_products?: number | undefined;
        active_products?: number | undefined;
        categories?: string[] | undefined;
        last_product_update?: string | undefined;
        avg_product_rating?: number | undefined;
    } | undefined;
    inventory?: {
        total_items?: number | undefined;
        low_stock_alerts?: number | undefined;
        out_of_stock?: number | undefined;
        suppliers?: string[] | undefined;
        warehouse_count?: number | undefined;
        last_inventory_sync?: string | undefined;
    } | undefined;
    crm?: {
        total_customers?: number | undefined;
        monthly_customers?: number | undefined;
        avg_rating?: number | undefined;
        reviews_count?: number | undefined;
        total_feedback?: number | undefined;
        satisfaction_rate?: number | undefined;
    } | undefined;
    loyalty?: {
        program_active?: boolean | undefined;
        active_members?: number | undefined;
        monthly_points_issued?: number | undefined;
        points_balance_total?: number | undefined;
        monthly_redemptions?: number | undefined;
        conversion_rate?: number | undefined;
    } | undefined;
    staff?: {
        total?: number | undefined;
        admins?: number | undefined;
        employees?: number | undefined;
        roles?: Record<string, number> | undefined;
        last_hire_date?: string | undefined;
    } | undefined;
    compliance?: {
        kyc_status?: "pending" | "verified" | "rejected" | "expired" | undefined;
        kyc_verified_at?: string | undefined;
        kyc_expiry?: string | undefined;
        tax_verified?: boolean | undefined;
        license_status?: Record<string, "valid" | "pending" | "expired"> | undefined;
        risk_score?: number | undefined;
        sanctions_check?: boolean | undefined;
    } | undefined;
    analytics?: {
        monthly_orders?: number | undefined;
        avg_order_value?: number | undefined;
        customer_retention_rate?: number | undefined;
        growth_rate?: number | undefined;
        top_category?: string | undefined;
        peak_hours?: string[] | undefined;
    } | undefined;
    ai_memory?: {
        preferences_set?: boolean | undefined;
        automation_rules?: number | undefined;
        last_interaction?: string | undefined;
        conversation_count?: number | undefined;
        tags?: string[] | undefined;
        sentiment_trend?: "positive" | "negative" | "neutral" | undefined;
    } | undefined;
    onboarding_complete?: boolean | undefined;
    last_sync_at?: string | undefined;
}>;
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
    merchant_id: string;
    business_name: string;
    brand_names: string[];
    verticals: string[];
    email?: string;
    phone?: string;
    addresses: Address[];
    website?: string;
    social_media?: Record<string, string>;
    business_type?: 'sole_proprietor' | 'partnership' | 'llc' | 'corporation' | 'nonprofit';
    tax_id?: string;
    registration_number?: string;
    founded_date?: string;
    business_hours?: BusinessHours[];
    finances: Finances;
    catalog: Catalog;
    inventory: Inventory;
    crm: CRM;
    loyalty: Loyalty;
    staff: Staff;
    compliance: Compliance;
    analytics: Analytics;
    ai_memory: AIMemory;
    status: 'active' | 'suspended' | 'pending_verification' | 'closed';
    onboarding_complete: boolean;
    created_at: string;
    updated_at: string;
    last_sync_at?: string;
}
export declare function createMerchantProfile(data: Partial<Merchant360> & {
    merchant_id: string;
    business_name: string;
}): Merchant360;
export declare function validateMerchantProfile(data: unknown): Merchant360;
export type Vertical = 'restaurant' | 'hotel' | 'salon' | 'fitness' | 'retail' | 'grocery' | 'pharmacy';
export interface Supplier {
    supplier_id: string;
    name: string;
    lead_time_days: number;
    moq: number;
    cost_per_unit: number;
}
//# sourceMappingURL=MerchantProfile.d.ts.map