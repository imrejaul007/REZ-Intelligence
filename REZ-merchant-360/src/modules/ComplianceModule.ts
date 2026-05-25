/**
 * ComplianceModule.ts - Compliance & Verification for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
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

export class ComplianceModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Compliance; timestamp: number }> = new Map();
  private cacheTTL: number = 600000; // 10 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:4007',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get compliance summary for a merchant
   */
  async getCompliance(merchantId: string): Promise<Compliance> {
    const cacheKey = `compliance:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getComplianceSummary(merchantId);

      const compliance: Compliance = {
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
    } catch (error) {
      console.error(`Failed to fetch compliance for merchant ${merchantId}:`, error);
      return this.getDefaultCompliance();
    }
  }

  /**
   * Get detailed compliance summary
   */
  async getComplianceSummary(merchantId: string): Promise<ComplianceSummary> {
    try {
      const response = await this.client.get<ComplianceSummary>(
        `/merchants/${merchantId}/compliance/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch compliance summary for merchant ${merchantId}:`, error);
      return this.getDefaultComplianceSummary();
    }
  }

  /**
   * Get KYC verification status
   */
  async getKYC(merchantId: string): Promise<KYCVerification | null> {
    try {
      const response = await this.client.get<KYCVerification>(
        `/merchants/${merchantId}/compliance/kyc`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch KYC for merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Submit KYC verification
   */
  async submitKYC(
    merchantId: string,
    data: {
      business_name: string;
      business_type: string;
      tax_id: string;
      registration_number?: string;
      document_type: KYCVerification['document_type'];
      document_url: string;
      address: string;
    }
  ): Promise<{ success: boolean; verification_id?: string; error?: string }> {
    try {
      const response = await this.client.post<{ verification_id: string }>(
        `/merchants/${merchantId}/compliance/kyc`,
        data
      );
      this.cache.delete(`compliance:${merchantId}`);
      return { success: true, verification_id: response.data.verification_id };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'KYC submission failed',
      };
    }
  }

  /**
   * Get tax information
   */
  async getTaxInfo(merchantId: string): Promise<TaxInfo | null> {
    try {
      const response = await this.client.get<TaxInfo>(
        `/merchants/${merchantId}/compliance/tax`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch tax info for merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Submit tax information
   */
  async submitTaxInfo(
    merchantId: string,
    data: {
      tax_id: string;
      tax_id_type: TaxInfo['tax_id_type'];
      business_name: string;
      address: string;
      state: string;
      exemption_certificate_url?: string;
    }
  ): Promise<TaxInfo> {
    try {
      const response = await this.client.post<TaxInfo>(
        `/merchants/${merchantId}/compliance/tax`,
        data
      );
      this.cache.delete(`compliance:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to submit tax info:`, error);
      throw error;
    }
  }

  /**
   * Get licenses
   */
  async getLicenses(merchantId: string): Promise<License[]> {
    try {
      const response = await this.client.get<License[]>(
        `/merchants/${merchantId}/compliance/licenses`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch licenses for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Add a license
   */
  async addLicense(
    merchantId: string,
    license: {
      type: string;
      name: string;
      issuing_authority: string;
      license_number: string;
      issue_date?: string;
      expiry_date?: string;
      document_urls: string[];
      auto_renew?: boolean;
    }
  ): Promise<License> {
    try {
      const response = await this.client.post<License>(
        `/merchants/${merchantId}/compliance/licenses`,
        license
      );
      this.cache.delete(`compliance:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to add license:`, error);
      throw error;
    }
  }

  /**
   * Update license
   */
  async updateLicense(
    merchantId: string,
    licenseId: string,
    updates: Partial<License>
  ): Promise<License> {
    try {
      const response = await this.client.patch<License>(
        `/merchants/${merchantId}/compliance/licenses/${licenseId}`,
        updates
      );
      this.cache.delete(`compliance:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update license:`, error);
      throw error;
    }
  }

  /**
   * Run sanctions check
   */
  async runSanctionsCheck(merchantId: string): Promise<{
    cleared: boolean;
    matches: { name: string; type: string; score: number }[];
    checked_at: string;
  }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/compliance/sanctions-check`
      );
      this.cache.delete(`compliance:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to run sanctions check:`, error);
      throw error;
    }
  }

  /**
   * Get compliance checks
   */
  async getComplianceChecks(
    merchantId: string,
    options: {
      type?: ComplianceCheck['check_type'];
      status?: ComplianceCheck['status'];
      from_date?: string;
      to_date?: string;
    } = {}
  ): Promise<ComplianceCheck[]> {
    try {
      const response = await this.client.get<ComplianceCheck[]>(
        `/merchants/${merchantId}/compliance/checks`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch compliance checks:`, error);
      return [];
    }
  }

  /**
   * Run compliance check
   */
  async runComplianceCheck(
    merchantId: string,
    checkType: ComplianceCheck['check_type']
  ): Promise<ComplianceCheck> {
    try {
      const response = await this.client.post<ComplianceCheck>(
        `/merchants/${merchantId}/compliance/checks`,
        { check_type: checkType }
      );
      this.cache.delete(`compliance:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to run compliance check:`, error);
      throw error;
    }
  }

  /**
   * Get compliance alerts
   */
  async getAlerts(
    merchantId: string,
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      acknowledged?: boolean;
    } = {}
  ): Promise<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    action_required: string;
    created_at: string;
    acknowledged_at?: string;
  }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/compliance/alerts`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch compliance alerts:`, error);
      return [];
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(merchantId: string, alertId: string): Promise<boolean> {
    try {
      await this.client.patch(
        `/merchants/${merchantId}/compliance/alerts/${alertId}`,
        { acknowledged_at: new Date().toISOString() }
      );
      return true;
    } catch (error) {
      console.error(`Failed to acknowledge alert:`, error);
      return false;
    }
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<{ report_url: string; expires_at: string }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/compliance/report`,
        period
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to generate compliance report:`, error);
      throw error;
    }
  }

  /**
   * Sync compliance from external source
   */
  async syncCompliance(merchantId: string, sourceData: Partial<Compliance>): Promise<Compliance> {
    const current = await this.getCompliance(merchantId);
    const updated: Compliance = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`compliance:${merchantId}`);
    return updated;
  }

  private getDefaultCompliance(): Compliance {
    return {
      kyc_status: 'pending',
      tax_verified: false,
      risk_score: 0,
      sanctions_check: false,
    };
  }

  private getDefaultComplianceSummary(): ComplianceSummary {
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

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`compliance:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
