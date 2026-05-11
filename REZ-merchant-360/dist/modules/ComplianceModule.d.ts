/**
 * ComplianceModule.ts - Compliance & Verification for Merchant360
 */
import { Compliance } from '../MerchantProfile';
export interface KYCVerification {
    id: string;
    merchant_id: string;
    status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
    business_name: string;
    business_type: string;
    tax_id: string;
    registration_number?: string;
    document_type: 'passport' | 'drivers_license' | 'national_id' | 'business_license';
    document_url: string;
    document_verified: boolean;
    address_verified: boolean;
    sanctions_screened: boolean;
    risk_score: number;
    rejection_reason?: string;
    submitted_at: string;
    verified_at?: string;
    expires_at?: string;
    reviewed_by?: string;
}
export interface TaxInfo {
    id: string;
    merchant_id: string;
    tax_id: string;
    tax_id_type: 'ein' | 'ssn' | 'vat' | 'gst';
    business_name: string;
    address: string;
    state: string;
    is_verified: boolean;
    verification_date?: string;
    filing_status: 'current' | 'delinquent' | 'exempt';
    exemption_certificate_url?: string;
    created_at: string;
    updated_at: string;
}
export interface License {
    id: string;
    merchant_id: string;
    type: string;
    name: string;
    issuing_authority: string;
    license_number: string;
    status: 'valid' | 'pending' | 'expired' | 'revoked';
    issue_date?: string;
    expiry_date?: string;
    renewal_date?: string;
    document_urls: string[];
    auto_renew: boolean;
    created_at: string;
    updated_at: string;
}
export interface ComplianceCheck {
    id: string;
    merchant_id: string;
    check_type: 'kyc' | 'tax' | 'license' | 'sanctions' | 'aml' | 'fraud';
    status: 'pass' | 'fail' | 'pending' | 'warning';
    score?: number;
    details: Record<string, unknown>;
    next_check_date?: string;
    completed_at?: string;
}
export interface ComplianceSummary {
    kyc_status: Compliance['kyc_status'];
    kyc_verified_at?: string;
    kyc_expiry?: string;
    tax_verified: boolean;
    license_status: Record<string, 'valid' | 'expired' | 'pending'>;
    risk_score: number;
    sanctions_check: boolean;
    pending_issues: number;
    critical_issues: number;
    last_compliance_check?: string;
    next_kyc_renewal?: string;
}
export declare class ComplianceModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get compliance summary for a merchant
     */
    getCompliance(merchantId: string): Promise<Compliance>;
    /**
     * Get detailed compliance summary
     */
    getComplianceSummary(merchantId: string): Promise<ComplianceSummary>;
    /**
     * Get KYC verification status
     */
    getKYC(merchantId: string): Promise<KYCVerification | null>;
    /**
     * Submit KYC verification
     */
    submitKYC(merchantId: string, data: {
        business_name: string;
        business_type: string;
        tax_id: string;
        registration_number?: string;
        document_type: KYCVerification['document_type'];
        document_url: string;
        address: string;
    }): Promise<{
        success: boolean;
        verification_id?: string;
        error?: string;
    }>;
    /**
     * Get tax information
     */
    getTaxInfo(merchantId: string): Promise<TaxInfo | null>;
    /**
     * Submit tax information
     */
    submitTaxInfo(merchantId: string, data: {
        tax_id: string;
        tax_id_type: TaxInfo['tax_id_type'];
        business_name: string;
        address: string;
        state: string;
        exemption_certificate_url?: string;
    }): Promise<TaxInfo>;
    /**
     * Get licenses
     */
    getLicenses(merchantId: string): Promise<License[]>;
    /**
     * Add a license
     */
    addLicense(merchantId: string, license: {
        type: string;
        name: string;
        issuing_authority: string;
        license_number: string;
        issue_date?: string;
        expiry_date?: string;
        document_urls: string[];
        auto_renew?: boolean;
    }): Promise<License>;
    /**
     * Update license
     */
    updateLicense(merchantId: string, licenseId: string, updates: Partial<License>): Promise<License>;
    /**
     * Run sanctions check
     */
    runSanctionsCheck(merchantId: string): Promise<{
        cleared: boolean;
        matches: {
            name: string;
            type: string;
            score: number;
        }[];
        checked_at: string;
    }>;
    /**
     * Get compliance checks
     */
    getComplianceChecks(merchantId: string, options?: {
        type?: ComplianceCheck['check_type'];
        status?: ComplianceCheck['status'];
        from_date?: string;
        to_date?: string;
    }): Promise<ComplianceCheck[]>;
    /**
     * Run compliance check
     */
    runComplianceCheck(merchantId: string, checkType: ComplianceCheck['check_type']): Promise<ComplianceCheck>;
    /**
     * Get compliance alerts
     */
    getAlerts(merchantId: string, options?: {
        severity?: 'low' | 'medium' | 'high' | 'critical';
        acknowledged?: boolean;
    }): Promise<{
        id: string;
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        action_required: string;
        created_at: string;
        acknowledged_at?: string;
    }[]>;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(merchantId: string, alertId: string): Promise<boolean>;
    /**
     * Generate compliance report
     */
    generateReport(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<{
        report_url: string;
        expires_at: string;
    }>;
    /**
     * Sync compliance from external source
     */
    syncCompliance(merchantId: string, sourceData: Partial<Compliance>): Promise<Compliance>;
    private getDefaultCompliance;
    private getDefaultComplianceSummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=ComplianceModule.d.ts.map