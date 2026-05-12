/**
 * Credit Scoring Engine for Agent OS
 *
 * Connects to financial systems:
 * - REZ-payments-brain
 * - Wallet services
 * - Payment history
 * - Spending patterns
 *
 * Provides:
 * - User credit score
 * - Spending analysis
 * - Risk assessment
 * - Lending recommendations
 */

const axios = require('axios');

class CreditEngine {
  constructor(config = {}) {
    this.config = {
      // Services
      WALLET_URL: process.env.WALLET_SERVICE_URL || 'https://rez-wallet.onrender.com',
      PAYMENTS_URL: process.env.PAYMENTS_URL || 'https://rez-payment.onrender.com',
      PAYMENTS_BRAIN_URL: process.env.PAYMENTS_BRAIN_URL || 'http://localhost:4070',
      MERCHANT_OS_URL: process.env.MERCHANT_OS_URL || 'http://localhost:4073',

      // ML model thresholds
      CREDIT_THRESHOLD: 0.7,
      FRAUD_THRESHOLD: 0.8,
      RISK_THRESHOLD: 0.6
    };
  }

  // =========================================================================
  // USER CREDIT SCORING
  // =========================================================================

  /**
   * Calculate user credit score (0-1000)
   */
  async getUserCreditScore(userId) {
    try {
      // Get payment history
      const paymentHistory = await this.getPaymentHistory(userId);

      // Get wallet data
      const walletData = await this.getWalletData(userId);

      // Get spending patterns
      const spending = await this.getSpendingPatterns(userId);

      // Get behavioral score
      const behavioral = await this.getBehavioralScore(userId);

      // Calculate composite score
      const score = this.calculateCreditScore({
        paymentHistory,
        walletData,
        spending,
        behavioral
      });

      return {
        userId,
        score,
        tier: this.getTier(score),
        factors: {
          paymentHistory: paymentHistory.score,
          walletHealth: walletData.score,
          spendingPattern: spending.score,
          behavioral: behavioral.score
        },
        recommendations: this.getRecommendations(score)
      };
    } catch (error) {
      console.error('Credit score error:', error);
      return null;
    }
  }

  /**
   * Get payment history score
   */
  async getPaymentHistory(userId) {
    try {
      const response = await axios.get(`${this.config.PAYMENTS_URL}/api/history/${userId}`, {
        timeout: 5000
      });

      const payments = response.data.payments || [];

      // Calculate payment history score
      const onTime = payments.filter(p => p.status === 'success').length;
      const total = payments.length;
      const rate = total > 0 ? onTime / total : 0.5;

      return {
        score: rate * 300,
        totalPayments: total,
        onTimeRate: rate,
        latePayments: total - onTime
      };
    } catch (error) {
      return { score: 150, totalPayments: 0, onTimeRate: 0.5, latePayments: 0 };
    }
  }

  /**
   * Get wallet health score
   */
  async getWalletData(userId) {
    try {
      const response = await axios.get(`${this.config.WALLET_URL}/api/wallet/${userId}`, {
        timeout: 5000
      });

      const wallet = response.data.wallet || {};
      const balance = wallet.balance || 0;

      // Higher balance = better score (up to a point)
      const balanceScore = Math.min(300, balance / 100);

      return {
        score: balanceScore,
        balance,
        transactions: wallet.transactions || []
      };
    } catch (error) {
      return { score: 150, balance: 0, transactions: [] };
    }
  }

  /**
   * Get spending pattern score
   */
  async getSpendingPatterns(userId) {
    try {
      const response = await axios.get(`${this.config.PAYMENTS_BRAIN_URL}/api/patterns/${userId}`, {
        timeout: 5000
      });

      const patterns = response.data.patterns || {};

      return {
        score: patterns.score || 200,
        frequency: patterns.frequency || 'medium',
        avgTransaction: patterns.avgTransaction || 500
      };
    } catch (error) {
      return { score: 200, frequency: 'medium', avgTransaction: 500 };
    }
  }

  /**
   * Get behavioral score
   */
  async getBehavioralScore(userId) {
    // Behavioral factors
    const factors = await this.getBehavioralFactors(userId);

    return {
      score: factors.score,
      velocity: factors.velocity,
      anomalies: factors.anomalies
    };
  }

  async getBehavioralFactors(userId) {
    // Calculate from multiple sources
    return {
      score: 200,
      velocity: 'normal',
      anomalies: []
    };
  }

  /**
   * Calculate composite score
   */
  calculateCreditScore(data) {
    const weights = {
      paymentHistory: 0.35,
      walletHealth: 0.25,
      spending: 0.25,
      behavioral: 0.15
    };

    const score = Math.round(
      data.paymentHistory.score * weights.paymentHistory +
      data.walletData.score * weights.walletHealth +
      data.spending.score * weights.spending +
      data.behavioral.score * weights.behavioral
    );

    return Math.min(1000, Math.max(300, score));
  }

  /**
   * Get credit tier
   */
  getTier(score) {
    if (score >= 850) return { tier: 'Excellent', color: 'gold' };
    if (score >= 700) return { tier: 'Good', color: 'green' };
    if (score >= 550) return { tier: 'Fair', color: 'yellow' };
    return { tier: 'Building', color: 'red' };
  }

  /**
   * Get recommendations
   */
  getRecommendations(score) {
    if (score >= 800) {
      return [
        'You qualify for premium lending rates',
        'Consider our credit builder program',
        'Unlock BNPL with 0% interest'
      ];
    }
    if (score >= 600) {
      return [
        'Make timely payments to improve score',
        'Keep wallet balance above ₹1000',
        'Use REZ Pay for regular transactions'
      ];
    }
    return [
      'Start with small transactions',
      'Pay on time to build history',
      'Link bank account for verification'
    ];
  }

  // =========================================================================
  // FRAUD DETECTION
  // =========================================================================

  /**
   * Detect potential fraud
   */
  async detectFraud(userId, transaction) {
    try {
      const response = await axios.post(`${this.config.PAYMENTS_BRAIN_URL}/api/fraud-detect`, {
        userId,
        transaction
      }, { timeout: 5000 });

      return response.data;
    } catch (error) {
      return { risk: 'unknown', score: 0.5 };
    }
  }

  // =========================================================================
  // LENDING RECOMMENDATIONS
  // =========================================================================

  /**
   * Get lending recommendations
   */
  async getLendingRecommendation(userId) {
    const creditScore = await this.getUserCreditScore(userId);

    if (!creditScore) {
      return { eligible: false, reason: 'Unable to assess creditworthiness' };
    }

    if (creditScore.score < 500) {
      return {
        eligible: false,
        reason: 'Credit score below minimum threshold',
        score: creditScore.score
      };
    }

    const maxAmount = Math.floor(creditScore.score * 10);
    const interestRate = creditScore.score > 800 ? 1.5 :
                       creditScore.score > 600 ? 2.5 : 3.5;

    return {
      eligible: true,
      maxAmount,
      interestRate,
      tenure: '3-12 months',
      score: creditScore.score,
      tier: creditScore.tier
    };
  }

  // =========================================================================
  // MERCHANT CREDIT (BNPL)
  // =========================================================================

  /**
   * Get merchant BNPL eligibility
   */
  async getMerchantBNPL(merchantId) {
    try {
      const response = await axios.get(`${this.config.MERCHANT_OS_URL}/api/merchant/${merchantId}/bnpl`, {
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      return { eligible: false };
    }
  }

  /**
   * Calculate BNPL for transaction
   */
  async calculateBNPL(userId, merchantId, amount) {
    const creditScore = await this.getUserCreditScore(userId);
    const merchantBNPL = await this.getMerchantBNPL(merchantId);

    if (!creditScore || !merchantBNPL.eligible) {
      return {
        eligible: false,
        reason: 'Not eligible for BNPL'
      };
    }

    // Calculate installments
    const installments = Math.min(3, Math.floor(amount / 500));
    const amountPerInstallment = amount / installments;
    const processingFee = amount * 0.02;

    return {
      eligible: true,
      totalAmount: amount,
      installments,
      amountPerInstallment,
      processingFee,
      firstDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      dueDates: this.getDueDates(installments),
      creditScore: creditScore.score,
      merchant: merchantId
    };
  }

  getDueDates(count) {
    const dates = [];
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() + (i + 1) * 15);
      dates.push(date.toISOString());
    }
    return dates;
  }
}

module.exports = CreditEngine;
