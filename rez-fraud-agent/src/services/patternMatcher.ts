import { TransactionContext } from './fraudDetector';
import { IRiskProfile } from '../models/RiskProfile';
import { FRAUD_PATTERNS, FraudPatternType, FraudPattern } from '../config/patterns';
import { logger } from '../utils/logger';

export interface PatternMatch {
  patternType: FraudPatternType;
  pattern: FraudPattern;
  score: number;
  confidence: number;
  evidence: Record<string, unknown>;
  context: Record<string, unknown>;
  riskFactors: string[];
}

export class PatternMatcher {
  async analyze(
    context: TransactionContext,
    riskProfile: IRiskProfile | null
  ): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    // Run all pattern checks
    const patternChecks = [
      this.checkCardTesting(context),
      this.checkImpossibleTravel(context, riskProfile),
      this.checkBillingShippingMismatch(context),
      this.checkNewDeviceAnomaly(context, riskProfile),
      this.checkUnusualAmount(context, riskProfile),
      this.checkBotBehavior(context),
      this.checkGeoAnomaly(context, riskProfile),
      this.checkSessionAnomaly(context),
    ];

    const results = await Promise.all(patternChecks);

    for (const result of results) {
      if (result.isMatch) {
        matches.push(result.match!);
      }
    }

    logger.debug('Pattern matching complete', {
      transactionId: context.transactionId,
      matchesFound: matches.length,
      patterns: matches.map(m => m.patternType),
    });

    return matches;
  }

  private async checkCardTesting(context: TransactionContext): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.CARD_TESTING];

    // Card testing indicators:
    // 1. Small transaction amount
    // 2. Sequential card numbers (would need to be passed in context)
    // 3. Rapid timing (would need velocity data)

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    // Check for small transaction (typical for card testing)
    if (context.amount <= pattern.thresholds.maxAmount) {
      evidence.isSmallAmount = true;
      riskFactors.push(`Small transaction amount: ${context.amount}`);
      score += 30;
    }

    // Check for new payment method
    if (context.isNewPaymentMethod) {
      evidence.isNewPaymentMethod = true;
      riskFactors.push('New payment method');
      score += 25;
    }

    // Check for unverified account
    if (!context.isVerified) {
      evidence.isUnverifiedAccount = true;
      riskFactors.push('Unverified account');
      score += 20;
    }

    // Calculate confidence
    const matchedIndicators = Object.keys(evidence).length;
    const confidence = Math.min(100, (matchedIndicators / 3) * 100);

    if (score >= 40) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.CARD_TESTING,
          pattern,
          score,
          confidence,
          evidence,
          context: { transactionAmount: context.amount, isNewPaymentMethod: context.isNewPaymentMethod },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkImpossibleTravel(
    context: TransactionContext,
    riskProfile: IRiskProfile | null
  ): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.IMPOSSIBLE_TRAVEL];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    if (!riskProfile || !context.billingCoordinates) {
      return { isMatch: false };
    }

    // Get last login location from risk profile for impossible travel check
    const lastLogin = riskProfile.loginHistory[riskProfile.loginHistory.length - 1];

    if (!lastLogin || !lastLogin.location?.coordinates) {
      return { isMatch: false };
    }

    // Calculate distance (simplified - would use proper geo library in production)
    const [lastLat, lastLon] = lastLogin.location.coordinates;
    const [currLat, currLon] = context.billingCoordinates;
    const distance = this.calculateDistance(lastLat, lastLon, currLat, currLon);

    if (distance > pattern.thresholds.minDistanceKm) {
      evidence.distanceKm = distance;
      riskFactors.push(`Impossible travel: ${distance}km in short time`);
      score += pattern.baseScore;

      // Calculate time between logins
      const timeDiffHours = (Date.now() - lastLogin.timestamp.getTime()) / (1000 * 60 * 60);
      if (timeDiffHours < pattern.thresholds.minTimeHours) {
        evidence.timeDiffHours = timeDiffHours;
        score += 20;
      }

      evidence.calculationDetails = {
        from: lastLogin.location.coordinates,
        to: context.billingCoordinates,
        timeDiffHours,
      };
    }

    if (score >= 60) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.IMPOSSIBLE_TRAVEL,
          pattern,
          score,
          confidence: 80,
          evidence,
          context: { distance, timeDiffHours: 0 },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkBillingShippingMismatch(context: TransactionContext): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.BILLING_SHIPPING_MISMATCH];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    if (!context.billingCountry || !context.shippingCountry) {
      return { isMatch: false };
    }

    // Country mismatch
    if (context.billingCountry !== context.shippingCountry) {
      evidence.countryMismatch = true;
      evidence.billingCountry = context.billingCountry;
      evidence.shippingCountry = context.shippingCountry;
      riskFactors.push(`Country mismatch: ${context.billingCountry} vs ${context.shippingCountry}`);
      score += pattern.thresholds.countryMismatchWeight;
    }

    // City mismatch
    if (context.billingCity && context.shippingCity && context.billingCity !== context.shippingCity) {
      evidence.cityMismatch = true;
      riskFactors.push(`City mismatch: ${context.billingCity} vs ${context.shippingCity}`);
      score += pattern.thresholds.cityMismatchWeight;
    }

    // Known freight forwarder addresses (simplified check)
    if (context.shippingCity && this.isFreightForwarderCity(context.shippingCity)) {
      evidence.freightForwarderSuspected = true;
      riskFactors.push('Shipping to freight forwarder location');
      score += 25;
    }

    if (score >= 40) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.BILLING_SHIPPING_MISMATCH,
          pattern,
          score,
          confidence: score >= 60 ? 90 : 70,
          evidence,
          context: {
            billingCountry: context.billingCountry,
            shippingCountry: context.shippingCountry,
          },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkNewDeviceAnomaly(
    context: TransactionContext,
    riskProfile: IRiskProfile | null
  ): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.NEW_DEVICE_ANOMALY];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    if (!context.deviceFingerprint || !riskProfile) {
      return { isMatch: false };
    }

    // Check if device is in history
    const isKnownDevice = riskProfile.usualDevices.includes(context.deviceFingerprint);

    if (!isKnownDevice) {
      evidence.newDevice = true;
      evidence.deviceFingerprint = context.deviceFingerprint.substring(0, 8) + '...';
      riskFactors.push('Transaction from new/unknown device');
      score += pattern.baseScore;

      // New device + new payment method = higher risk
      if (context.isNewPaymentMethod) {
        evidence.combinedWithNewPayment = true;
        score += 20;
      }

      // New device + high value = higher risk
      if (context.amount >= 1000) {
        evidence.combinedWithHighValue = true;
        score += 15;
      }
    }

    // Check for emulator/virtual machine
    if (context.userAgent && this.isSuspiciousUserAgent(context.userAgent)) {
      evidence.suspiciousUserAgent = true;
      riskFactors.push('Suspicious user agent (possible emulator/VM)');
      score += 30;
    }

    if (score >= 40) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.NEW_DEVICE_ANOMALY,
          pattern,
          score,
          confidence: isKnownDevice ? 0 : 85,
          evidence,
          context: { deviceFingerprint: context.deviceFingerprint, userAgent: context.userAgent },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkUnusualAmount(
    context: TransactionContext,
    riskProfile: IRiskProfile | null
  ): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.UNUSUAL_AMOUNT];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    // Check against absolute threshold
    if (context.amount >= pattern.thresholds.highValueAmount) {
      evidence.highValue = true;
      evidence.amount = context.amount;
      riskFactors.push(`High value transaction: ${context.amount}`);
      score += 30;
    }

    // Check against user's average
    if (riskProfile && riskProfile.averageTransactionAmount > 0) {
      const ratio = context.amount / riskProfile.averageTransactionAmount;
      evidence.amountToAverageRatio = ratio;

      if (ratio >= pattern.thresholds.amountMultiplier) {
        evidence.exceedsAverageBy = ratio;
        riskFactors.push(`Amount ${ratio.toFixed(1)}x higher than user's average`);
        score += 40;
      }
    }

    // Check against user's max
    if (riskProfile && riskProfile.maxTransactionAmount > 0) {
      if (context.amount > riskProfile.maxTransactionAmount * 1.5) {
        evidence.exceedsMax = true;
        evidence.maxAmount = riskProfile.maxTransactionAmount;
        score += 35;
      }
    }

    // Round number check
    if (context.amount % 100 === 0 && context.amount >= 5000) {
      evidence.isRoundNumber = true;
      score += 10;
    }

    if (score >= 40) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.UNUSUAL_AMOUNT,
          pattern,
          score,
          confidence: score >= 60 ? 85 : 70,
          evidence,
          context: { amount: context.amount },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkBotBehavior(context: TransactionContext): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.BOT_BEHAVIOR];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    // Very short session
    if (context.sessionDuration !== undefined && context.sessionDuration < 5) {
      evidence.veryShortSession = true;
      evidence.sessionDuration = context.sessionDuration;
      riskFactors.push(`Extremely short session: ${context.sessionDuration}s`);
      score += 40;
    }

    // Minimal page views
    if (context.pageViews !== undefined && context.pageViews < 3) {
      evidence.minimalPageViews = true;
      evidence.pageViewCount = context.pageViews;
      riskFactors.push(`Minimal page views: ${context.pageViews}`);
      score += 30;
    }

    // Suspicious navigation pattern (no browse, direct to checkout)
    if (context.navigationPattern && context.navigationPattern.length > 0) {
      const hasNoProductPages = !context.navigationPattern.some(p =>
        p.includes('product') || p.includes('browse') || p.includes('search')
      );
      if (hasNoProductPages) {
        evidence.noProductPages = true;
        evidence.navigationPattern = context.navigationPattern;
        riskFactors.push('Navigation skipped product browsing');
        score += 25;
      }
    }

    if (score >= 50) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.BOT_BEHAVIOR,
          pattern,
          score,
          confidence: score >= 70 ? 90 : 75,
          evidence,
          context: {
            sessionDuration: context.sessionDuration,
            pageViews: context.pageViews,
          },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkGeoAnomaly(
    context: TransactionContext,
    riskProfile: IRiskProfile | null
  ): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.GEO_ANOMALY];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    if (!context.billingCountry) {
      return { isMatch: false };
    }

    // Check if country is new for this user
    if (riskProfile && riskProfile.usualLocations.length > 0) {
      const isKnownCountry = riskProfile.usualLocations.some(
        loc => loc.country === context.billingCountry
      );

      if (!isKnownCountry) {
        evidence.newCountry = true;
        evidence.billingCountry = context.billingCountry;
        evidence.knownCountries = riskProfile.usualLocations.map(l => l.country);
        riskFactors.push(`First transaction from ${context.billingCountry}`);
        score += pattern.thresholds.newCountryPenalty;
      }
    }

    // VPN/Proxy detection (would need IP intelligence data)
    if (context.ipAddress && this.isKnownVPNRange(context.ipAddress)) {
      evidence.vpnDetected = true;
      riskFactors.push('VPN/Proxy IP address detected');
      score += 30;
    }

    if (score >= 35) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.GEO_ANOMALY,
          pattern,
          score,
          confidence: score >= 50 ? 80 : 60,
          evidence,
          context: { billingCountry: context.billingCountry, ipAddress: context.ipAddress },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  private async checkSessionAnomaly(context: TransactionContext): Promise<{
    isMatch: boolean;
    match?: PatternMatch;
  }> {
    const pattern = FRAUD_PATTERNS[FraudPatternType.SESSION_ANOMALY];

    const evidence: Record<string, unknown> = {};
    const riskFactors: string[] = [];
    let score = 0;

    // Very short session
    if (context.sessionDuration !== undefined &&
        context.sessionDuration < pattern.thresholds.minSessionDurationSeconds) {
      evidence.tooShortSession = true;
      evidence.sessionDuration = context.sessionDuration;
      riskFactors.push(`Session too short: ${context.sessionDuration}s`);
      score += 20;
    }

    if (score >= 30) {
      return {
        isMatch: true,
        match: {
          patternType: FraudPatternType.SESSION_ANOMALY,
          pattern,
          score,
          confidence: 60,
          evidence,
          context: { sessionDuration: context.sessionDuration },
          riskFactors,
        },
      };
    }

    return { isMatch: false };
  }

  // Utility methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula (simplified)
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private isFreightForwarderCity(city: string): boolean {
    const knownCities = ['shenzhen', 'guangzhou', 'yiwu', 'hong kong'];
    return knownCities.some(c => city.toLowerCase().includes(c));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'bot', 'crawler', 'spider', 'curl', 'wget', 'python',
      'headless', 'phantom', 'selenium', 'playwright',
    ];
    const ua = userAgent.toLowerCase();
    return suspiciousPatterns.some(p => ua.includes(p));
  }

  private isKnownVPNRange(ip: string): boolean {
    // Simplified check - in production would use IP intelligence database
    const vpnIndicators = ['vpn', 'tor', 'proxy', 'datacenter'];
    // This would be replaced with actual IP range checking
    return false;
  }
}
