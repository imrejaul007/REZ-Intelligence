"use strict";
/**
 * ComplianceModule.ts - Compliance & Verification for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceModule = void 0;
const axios_1 = __importDefault(require("axios"));
class ComplianceModule {
    client;
    cache = new Map();
    cacheTTL = 600000; // 10 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:4007',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
    }
    /**
     * Get compliance summary for a merchant
     */
    async getCompliance(merchantId) {
        const cacheKey = `compliance:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getComplianceSummary(merchantId);
            const compliance = {
                kyc_status: summary.kyc_status,
                kyc_verified_at: summary.kyc_verified_at,
                kyc_expiry: summary.kyc_expiry,
                tax_verified: summary.tax_verified,
                license_status: summary.license_status,
                risk_score: summary.risk_score,
                sanctions_check: summary.sanctions_check,
            };
            this.cache.set(cacheKey, { data: compliance, timestamp: Date.now() });
            return compliance;
        }
        catch (error) {
            console.error(`Failed to fetch compliance for merchant ${merchantId}:`, error);
            return this.getDefaultCompliance();
        }
    }
    /**
     * Get detailed compliance summary
     */
    async getComplianceSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch compliance summary for merchant ${merchantId}:`, error);
            return this.getDefaultComplianceSummary();
        }
    }
    /**
     * Get KYC verification status
     */
    async getKYC(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/kyc`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch KYC for merchant ${merchantId}:`, error);
            return null;
        }
    }
    /**
     * Submit KYC verification
     */
    async submitKYC(merchantId, data) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/kyc`, data);
            this.cache.delete(`compliance:${merchantId}`);
            return { success: true, verification_id: response.data.verification_id };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'KYC submission failed',
            };
        }
    }
    /**
     * Get tax information
     */
    async getTaxInfo(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/tax`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch tax info for merchant ${merchantId}:`, error);
            return null;
        }
    }
    /**
     * Submit tax information
     */
    async submitTaxInfo(merchantId, data) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/tax`, data);
            this.cache.delete(`compliance:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to submit tax info:`, error);
            throw error;
        }
    }
    /**
     * Get licenses
     */
    async getLicenses(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/licenses`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch licenses for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Add a license
     */
    async addLicense(merchantId, license) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/licenses`, license);
            this.cache.delete(`compliance:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to add license:`, error);
            throw error;
        }
    }
    /**
     * Update license
     */
    async updateLicense(merchantId, licenseId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/compliance/licenses/${licenseId}`, updates);
            this.cache.delete(`compliance:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update license:`, error);
            throw error;
        }
    }
    /**
     * Run sanctions check
     */
    async runSanctionsCheck(merchantId) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/sanctions-check`);
            this.cache.delete(`compliance:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to run sanctions check:`, error);
            throw error;
        }
    }
    /**
     * Get compliance checks
     */
    async getComplianceChecks(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/checks`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch compliance checks:`, error);
            return [];
        }
    }
    /**
     * Run compliance check
     */
    async runComplianceCheck(merchantId, checkType) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/checks`, { check_type: checkType });
            this.cache.delete(`compliance:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to run compliance check:`, error);
            throw error;
        }
    }
    /**
     * Get compliance alerts
     */
    async getAlerts(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/compliance/alerts`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch compliance alerts:`, error);
            return [];
        }
    }
    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(merchantId, alertId) {
        try {
            await this.client.patch(`/merchants/${merchantId}/compliance/alerts/${alertId}`, { acknowledged_at: new Date().toISOString() });
            return true;
        }
        catch (error) {
            console.error(`Failed to acknowledge alert:`, error);
            return false;
        }
    }
    /**
     * Generate compliance report
     */
    async generateReport(merchantId, period) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/compliance/report`, period);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to generate compliance report:`, error);
            throw error;
        }
    }
    /**
     * Sync compliance from external source
     */
    async syncCompliance(merchantId, sourceData) {
        const current = await this.getCompliance(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`compliance:${merchantId}`);
        return updated;
    }
    getDefaultCompliance() {
        return {
            kyc_status: 'pending',
            tax_verified: false,
            risk_score: 0,
            sanctions_check: false,
        };
    }
    getDefaultComplianceSummary() {
        return {
            kyc_status: 'pending',
            tax_verified: false,
            license_status: {},
            risk_score: 0,
            sanctions_check: false,
            pending_issues: 0,
            critical_issues: 0,
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`compliance:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.ComplianceModule = ComplianceModule;
//# sourceMappingURL=ComplianceModule.js.map