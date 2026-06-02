import { MobileOperator, DTHOperator } from '../models/recharge.model.js';

// API Configuration
interface OperatorConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

const OPERATOR_CONFIGS: Record<string, OperatorConfig> = {
  airtel: {
    baseUrl: process.env.AIRTEL_API_URL || 'https://api.airtel.in',
    apiKey: process.env.AIRTEL_API_KEY || '',
    apiSecret: process.env.AIRTEL_API_SECRET || '',
  },
  jio: {
    baseUrl: process.env.JIO_API_URL || 'https://api.jio.com',
    apiKey: process.env.JIO_API_KEY || '',
    apiSecret: process.env.JIO_API_SECRET || '',
  },
  vi: {
    baseUrl: process.env.VI_API_URL || 'https://api.vi.in',
    apiKey: process.env.VI_API_KEY || '',
    apiSecret: process.env.VI_API_SECRET || '',
  },
  bsnl: {
    baseUrl: process.env.BSNL_API_URL || 'https://api.bsnl.co.in',
    apiKey: process.env.BSNL_API_KEY || '',
    apiSecret: process.env.BSNL_API_SECRET || '',
  },
  tata_sky: {
    baseUrl: process.env.TATA_SKY_API_URL || 'https://api.tatasky.com',
    apiKey: process.env.TATA_SKY_API_KEY || '',
    apiSecret: process.env.TATA_SKY_API_SECRET || '',
  },
  dish_tv: {
    baseUrl: process.env.DISH_TV_API_URL || 'https://api.dishtv.in',
    apiKey: process.env.DISH_TV_API_KEY || '',
    apiSecret: process.env.DISH_TV_API_SECRET || '',
  },
  airtel_digital: {
    baseUrl: process.env.AIRTEL_DIGITAL_API_URL || 'https://api.airteldigital.in',
    apiKey: process.env.AIRTEL_DIGITAL_API_KEY || '',
    apiSecret: process.env.AIRTEL_DIGITAL_API_SECRET || '',
  },
  videocon: {
    baseUrl: process.env.VIDEOCON_API_URL || 'https://api.videocon.in',
    apiKey: process.env.VIDEOCON_API_KEY || '',
    apiSecret: process.env.VIDEOCON_API_SECRET || '',
  },
};

// Response types
export interface OperatorResponse {
  success: boolean;
  referenceId?: string;
  status?: 'success' | 'pending' | 'failed';
  message?: string;
  errorCode?: string;
  operatorData?: Record<string, unknown>;
  timestamp: Date;
}

export interface BalanceCheckResponse {
  operator: string;
  balance: number;
  lastUpdated: Date;
}

export interface OperatorStatusResponse {
  operator: string;
  status: 'active' | 'degraded' | 'down';
  latency: number;
  lastChecked: Date;
}

// Operator Service Class
export class OperatorService {
  private static instance: OperatorService;

  private constructor() {}

  static getInstance(): OperatorService {
    if (!OperatorService.instance) {
      OperatorService.instance = new OperatorService();
    }
    return OperatorService.instance;
  }

  /**
   * Get operator configuration
   */
  private getConfig(operator: string): OperatorConfig {
    const config = OPERATOR_CONFIGS[operator.toLowerCase()];
    if (!config) {
      throw new Error(`Unknown operator: ${operator}`);
    }
    return config;
  }

  /**
   * Validate mobile number format based on operator
   */
  validateMobileNumber(operator: string, number: string): boolean {
    const cleaned = number.replace(/\D/g, '');

    // Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
    const mobileRegex = /^[6-9]\d{9}$/;

    switch (operator.toLowerCase()) {
      case MobileOperator.AIRTEL:
      case MobileOperator.JIO:
      case MobileOperator.VI:
      case MobileOperator.BSNL:
        return mobileRegex.test(cleaned);
      default:
        return false;
    }
  }

  /**
   * Validate DTH subscriber ID format based on operator
   */
  validateSubscriberId(operator: string, subscriberId: string): boolean {
    switch (operator.toLowerCase()) {
      case DTHOperator.TATA_SKY:
        // Tata Sky uses 10-digit numeric ID or alphanumeric
        return /^[0-9]{10}$/.test(subscriberId) || /^[A-Z0-9]{10,12}$/.test(subscriberId.toUpperCase());
      case DTHOperator.DISH_TV:
        // Dish TV uses 11-digit numeric ID
        return /^[0-9]{11}$/.test(subscriberId);
      case DTHOperator.AIRTEL_DIGITAL:
        // Airtel Digital uses 10-digit numeric ID
        return /^[0-9]{10}$/.test(subscriberId);
      case DTHOperator.VIDEOCON:
        // Videocon uses alphanumeric ID
        return /^[A-Z0-9]{8,12}$/i.test(subscriberId);
      default:
        return false;
    }
  }

  /**
   * Validate recharge amount
   */
  validateAmount(amount: number, operatorType: 'mobile' | 'dth'): boolean {
    const minAmount = operatorType === 'mobile' ? 10 : 100;
    const maxAmount = operatorType === 'mobile' ? 10000 : 5000;

    return amount >= minAmount && amount <= maxAmount;
  }

  /**
   * Check operator balance
   */
  async checkBalance(operator: string): Promise<BalanceCheckResponse> {
    const config = this.getConfig(operator);

    // In production, this would call the actual operator API
    // For now, return mock data
    return {
      operator,
      balance: 100000, // Mock balance
      lastUpdated: new Date(),
    };
  }

  /**
   * Process mobile recharge
   */
  async processMobileRecharge(
    operator: MobileOperator,
    mobileNumber: string,
    amount: number,
    planId?: string
  ): Promise<OperatorResponse> {
    // Validate inputs
    if (!this.validateMobileNumber(operator, mobileNumber)) {
      return {
        success: false,
        status: 'failed',
        message: 'Invalid mobile number format',
        errorCode: 'INVALID_NUMBER',
        timestamp: new Date(),
      };
    }

    if (!this.validateAmount(amount, 'mobile')) {
      return {
        success: false,
        status: 'failed',
        message: 'Invalid recharge amount',
        errorCode: 'INVALID_AMOUNT',
        timestamp: new Date(),
      };
    }

    // In production, this would call the actual operator API
    // Simulate API call
    const response = await this.simulateOperatorApi(operator, mobileNumber, amount);

    return response;
  }

  /**
   * Process DTH recharge
   */
  async processDTHRecharge(
    operator: DTHOperator,
    subscriberId: string,
    amount: number,
    planId?: string
  ): Promise<OperatorResponse> {
    // Validate inputs
    if (!this.validateSubscriberId(operator, subscriberId)) {
      return {
        success: false,
        status: 'failed',
        message: 'Invalid subscriber ID format',
        errorCode: 'INVALID_SUBSCRIBER',
        timestamp: new Date(),
      };
    }

    if (!this.validateAmount(amount, 'dth')) {
      return {
        success: false,
        status: 'failed',
        message: 'Invalid recharge amount',
        errorCode: 'INVALID_AMOUNT',
        timestamp: new Date(),
      };
    }

    // In production, this would call the actual operator API
    const response = await this.simulateOperatorApi(operator, subscriberId, amount);

    return response;
  }

  /**
   * Check operator status
   */
  async checkOperatorStatus(operator: string): Promise<OperatorStatusResponse> {
    const startTime = Date.now();

    // Simulate health check
    const latency = Math.floor(Math.random() * 100) + 50;

    return {
      operator,
      status: 'active',
      latency,
      lastChecked: new Date(),
    };
  }

  /**
   * Get bill details for mobile postpaid
   */
  async getMobileBillDetails(
    operator: string,
    mobileNumber: string
  ): Promise<{ amount: number; dueDate: Date; billNumber: string } | null> {
    if (!this.validateMobileNumber(operator, mobileNumber)) {
      return null;
    }

    // Mock bill details
    return {
      amount: Math.floor(Math.random() * 500) + 200,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      billNumber: `BL${Date.now()}`,
    };
  }

  /**
   * Get customer details from operator
   */
  async getCustomerDetails(
    operator: string,
    subscriberNumber: string,
    type: 'mobile' | 'dth'
  ): Promise<Record<string, unknown> | null> {
    if (type === 'mobile' && !this.validateMobileNumber(operator, subscriberNumber)) {
      return null;
    }
    if (type === 'dth' && !this.validateSubscriberId(operator, subscriberNumber)) {
      return null;
    }

    // Mock customer details
    return {
      name: 'Customer',
      operator,
      number: subscriberNumber,
      plan: 'Prepaid',
      status: 'Active',
      balance: Math.floor(Math.random() * 500) + 100,
    };
  }

  /**
   * Simulate operator API call (for development/testing)
   */
  private async simulateOperatorApi(
    operator: string,
    subscriberId: string,
    amount: number
  ): Promise<OperatorResponse> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 200));

    // 95% success rate for simulation
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
      return {
        success: true,
        referenceId: `REF${Date.now()}${Math.floor(Math.random() * 1000)}`,
        status: 'success',
        message: 'Recharge successful',
        operatorData: {
          operator,
          subscriberId,
          amount,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        status: 'failed',
        message: 'Operator service temporarily unavailable',
        errorCode: 'SERVICE_UNAVAILABLE',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get all supported mobile operators
   */
  getSupportedMobileOperators(): MobileOperator[] {
    return Object.values(MobileOperator);
  }

  /**
   * Get all supported DTH operators
   */
  getSupportedDTHOperators(): DTHOperator[] {
    return Object.values(DTHOperator);
  }
}

// Export singleton instance
export const operatorService = OperatorService.getInstance();
