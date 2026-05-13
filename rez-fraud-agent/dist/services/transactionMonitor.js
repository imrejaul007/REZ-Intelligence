"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionMonitor = void 0;
const logger_1 = require("../utils/logger");
class TransactionMonitor {
    redis = null;
    KEYS = {
        failedAttempts: (userId) => `fraud:failed:${userId}`,
        transactionAmounts: (userId) => `fraud:amounts:${userId}`,
        transactionCountries: (userId) => `fraud:countries:${userId}`,
        merchantCategories: (userId) => `fraud:mcc:${userId}`,
    };
    constructor(redis) {
        if (redis) {
            this.redis = redis;
        }
    }
    async setRedisClient(redis) {
        this.redis = redis;
    }
    async monitor(context) {
        const anomalies = [];
        if (!context.userId) {
            return {
                isAnomalous: false,
                anomalies: [],
                overallScore: 0,
            };
        }
        // Check failed attempts
        const failedAttemptAnomalies = await this.checkFailedAttempts(context);
        anomalies.push(...failedAttemptAnomalies);
        // Check amount patterns
        const amountAnomalies = await this.checkAmountPatterns(context);
        anomalies.push(...amountAnomalies);
        // Check location patterns
        const locationAnomalies = await this.checkLocationPatterns(context);
        anomalies.push(...locationAnomalies);
        // Check merchant category patterns
        const merchantAnomalies = await this.checkMerchantPatterns(context);
        anomalies.push(...merchantAnomalies);
        // Calculate overall score
        const overallScore = anomalies.length > 0
            ? Math.max(...anomalies.map(a => a.score))
            : 0;
        return {
            isAnomalous: anomalies.length > 0,
            anomalies,
            overallScore,
        };
    }
    async checkFailedAttempts(context) {
        if (!this.redis || !context.userId)
            return [];
        const anomalies = [];
        try {
            const key = this.KEYS.failedAttempts(context.userId);
            const failedAttempts = await this.redis.get(key);
            const count = failedAttempts ? parseInt(failedAttempts, 10) : 0;
            if (count >= 5) {
                anomalies.push({
                    type: 'EXCESSIVE_FAILED_ATTEMPTS',
                    description: `User has ${count} failed payment attempts`,
                    severity: 'high',
                    score: 70,
                    metadata: { count },
                });
            }
            else if (count >= 3) {
                anomalies.push({
                    type: 'MULTIPLE_FAILED_ATTEMPTS',
                    description: `User has ${count} failed payment attempts`,
                    severity: 'medium',
                    score: 40,
                    metadata: { count },
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to check failed attempts', { error, userId: context.userId });
        }
        return anomalies;
    }
    async checkAmountPatterns(context) {
        if (!this.redis || !context.userId)
            return [];
        const anomalies = [];
        try {
            const key = this.KEYS.transactionAmounts(context.userId);
            // Get recent amounts (last 10 transactions)
            const recentAmounts = await this.redis.lRange(key, 0, 9);
            const amounts = recentAmounts.map((a) => parseFloat(a)).filter((a) => !isNaN(a));
            if (amounts.length >= 3) {
                const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
                // Check for round number (potential fraud indicator)
                if (context.amount % 100 === 0 && context.amount >= 1000) {
                    anomalies.push({
                        type: 'ROUND_NUMBER_AMOUNT',
                        description: `Transaction amount ${context.amount} is a round number`,
                        severity: 'low',
                        score: 15,
                        metadata: { amount: context.amount },
                    });
                }
                // Check for just-under-limit amounts
                if (context.amount > 9000 && context.amount < 10000) {
                    anomalies.push({
                        type: 'LIMIT_PROXIMITY',
                        description: 'Transaction just under common limit',
                        severity: 'medium',
                        score: 30,
                        metadata: { amount: context.amount },
                    });
                }
                // Check for deviation from average
                if (context.amount > average * 5) {
                    anomalies.push({
                        type: 'AMOUNT_DEVIATION',
                        description: `Amount ${context.amount} is ${(context.amount / average).toFixed(1)}x higher than average`,
                        severity: 'medium',
                        score: 35,
                        metadata: { amount: context.amount, average },
                    });
                }
                // Add current amount to history
                await this.redis.lPush(key, context.amount.toString());
                await this.redis.lTrim(key, 0, 9);
                await this.redis.expire(key, 86400); // 24 hours
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to check amount patterns', { error, userId: context.userId });
        }
        return anomalies;
    }
    async checkLocationPatterns(context) {
        if (!this.redis || !context.userId)
            return [];
        const anomalies = [];
        try {
            const key = this.KEYS.transactionCountries(context.userId);
            // Get recent countries
            const recentCountries = await this.redis.lRange(key, 0, 4);
            const countries = recentCountries.filter((c) => c !== '');
            if (context.billingCountry) {
                // Check for new country
                if (countries.length > 0 && !countries.includes(context.billingCountry)) {
                    anomalies.push({
                        type: 'NEW_COUNTRY',
                        description: `First transaction from ${context.billingCountry}`,
                        severity: 'medium',
                        score: 25,
                        metadata: {
                            currentCountry: context.billingCountry,
                            previousCountries: countries,
                        },
                    });
                }
                // Check for impossible travel (multiple countries in short time)
                if (countries.length >= 2) {
                    const uniqueCountries = new Set(countries);
                    if (uniqueCountries.size >= 2) {
                        anomalies.push({
                            type: 'MULTIPLE_COUNTRIES',
                            description: 'Transactions from multiple countries detected',
                            severity: 'high',
                            score: 45,
                            metadata: { countries: Array.from(uniqueCountries) },
                        });
                    }
                }
                // Add current country to history
                await this.redis.lPush(key, context.billingCountry);
                await this.redis.lTrim(key, 0, 9);
                await this.redis.expire(key, 86400 * 7); // 7 days
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to check location patterns', { error, userId: context.userId });
        }
        return anomalies;
    }
    async checkMerchantPatterns(context) {
        if (!this.redis || !context.userId)
            return [];
        const anomalies = [];
        if (!context.merchantCategory)
            return anomalies;
        try {
            const key = this.KEYS.merchantCategories(context.userId);
            // Get recent merchant categories
            const recentMCCs = await this.redis.lRange(key, 0, 19);
            const mccs = recentMCCs.filter((m) => m !== '');
            // Check for unusual merchant category
            const highRiskMCCs = ['5967', '7995', '5966', '4814', '6051']; // Direct marketing, gambling, etc.
            if (highRiskMCCs.includes(context.merchantCategory)) {
                // Check if user has used this category before
                const previousUsage = mccs.filter((m) => m === context.merchantCategory).length;
                if (previousUsage === 0) {
                    anomalies.push({
                        type: 'HIGH_RISK_MERCHANT_NEW',
                        description: `First transaction with high-risk merchant category ${context.merchantCategory}`,
                        severity: 'medium',
                        score: 35,
                        metadata: { merchantCategory: context.merchantCategory },
                    });
                }
            }
            // Add current MCC to history
            await this.redis.lPush(key, context.merchantCategory);
            await this.redis.lTrim(key, 0, 19);
            await this.redis.expire(key, 86400 * 30); // 30 days
        }
        catch (error) {
            logger_1.logger.error('Failed to check merchant patterns', { error, userId: context.userId });
        }
        return anomalies;
    }
    async recordFailedAttempt(userId) {
        if (!this.redis)
            return;
        try {
            const key = this.KEYS.failedAttempts(userId);
            await this.redis.incr(key);
            await this.redis.expire(key, 600); // 10 minutes
        }
        catch (error) {
            logger_1.logger.error('Failed to record failed attempt', { error, userId });
        }
    }
    async clearFailedAttempts(userId) {
        if (!this.redis)
            return;
        try {
            const key = this.KEYS.failedAttempts(userId);
            await this.redis.del(key);
        }
        catch (error) {
            logger_1.logger.error('Failed to clear failed attempts', { error, userId });
        }
    }
}
exports.TransactionMonitor = TransactionMonitor;
//# sourceMappingURL=transactionMonitor.js.map