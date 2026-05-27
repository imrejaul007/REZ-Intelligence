"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VelocityCheck = void 0;
const logger_js_1 = require("../utils/logger.js");
class VelocityCheck {
    redis = null;
    // Velocity thresholds
    THRESHOLDS = {
        perMinute: 10,
        perHour: 50,
        perDay: 200,
    };
    constructor(redis) {
        if (redis) {
            this.redis = redis;
        }
    }
    async setRedisClient(redis) {
        this.redis = redis;
    }
    async check(context) {
        const baseResult = {
            isViolation: false,
            score: 0,
            evidence: {},
            riskFactors: [],
            details: {
                transactionsPerMinute: 0,
                transactionsPerHour: 0,
                transactionsPerDay: 0,
                maxAllowedPerMinute: this.THRESHOLDS.perMinute,
                maxAllowedPerHour: this.THRESHOLDS.perHour,
                maxAllowedPerDay: this.THRESHOLDS.perDay,
            },
        };
        if (!this.redis || !context.userId) {
            return baseResult;
        }
        const userId = context.userId;
        try {
            // Check all velocity windows
            const [minuteCheck, hourCheck, dayCheck] = await Promise.all([
                this.checkWindow(userId, 'minute'),
                this.checkWindow(userId, 'hour'),
                this.checkWindow(userId, 'day'),
            ]);
            baseResult.details.transactionsPerMinute = minuteCheck.count;
            baseResult.details.transactionsPerHour = hourCheck.count;
            baseResult.details.transactionsPerDay = dayCheck.count;
            // Record current transaction
            await this.recordTransaction(userId);
            // Determine violations
            const violations = [];
            let maxScore = 0;
            if (minuteCheck.isViolation) {
                violations.push(`Per-minute: ${minuteCheck.count}/${this.THRESHOLDS.perMinute}`);
                maxScore = Math.max(maxScore, minuteCheck.score);
            }
            if (hourCheck.isViolation) {
                violations.push(`Per-hour: ${hourCheck.count}/${this.THRESHOLDS.perHour}`);
                maxScore = Math.max(maxScore, hourCheck.score);
            }
            if (dayCheck.isViolation) {
                violations.push(`Per-day: ${dayCheck.count}/${this.THRESHOLDS.perDay}`);
                maxScore = Math.max(maxScore, dayCheck.score);
            }
            // Check for burst patterns (sudden spike)
            if (minuteCheck.count >= this.THRESHOLDS.perMinute * 0.8 && minuteCheck.count > hourCheck.count / 60 * 1.5) {
                baseResult.evidence.burstDetected = true;
                baseResult.riskFactors.push('Burst transaction pattern detected');
                maxScore = Math.max(maxScore, 50);
            }
            if (violations.length > 0) {
                baseResult.isViolation = true;
                baseResult.violationType = violations.join(', ');
                baseResult.score = maxScore;
                baseResult.riskFactors.push(`Velocity exceeded: ${violations.join(', ')}`);
            }
            return baseResult;
        }
        catch (error) {
            logger_js_1.logger.error('Velocity check error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId,
            });
            return baseResult;
        }
    }
    async checkWindow(userId, window) {
        if (!this.redis) {
            return { count: 0, isViolation: false, score: 0 };
        }
        const key = `velocity:${window}:${userId}`;
        const ttl = window === 'minute' ? 60 : window === 'hour' ? 3600 : 86400;
        const threshold = this.THRESHOLDS[window === 'minute' ? 'perMinute' : window === 'hour' ? 'perHour' : 'perDay'];
        try {
            const countStr = await this.redis.get(key);
            const count = countStr ? parseInt(countStr, 10) : 0;
            const isViolation = count >= threshold;
            const score = isViolation ? Math.min(100, 50 + (count - threshold) * 5) : 0;
            return { count, isViolation, score };
        }
        catch {
            return { count: 0, isViolation: false, score: 0 };
        }
    }
    async recordTransaction(userId) {
        if (!this.redis)
            return;
        const now = Date.now();
        const minuteKey = `velocity:minute:${userId}`;
        const hourKey = `velocity:hour:${userId}`;
        const dayKey = `velocity:day:${userId}`;
        const transactionKey = `velocity:transactions:${userId}`;
        try {
            const multi = this.redis.multi();
            // Increment counters
            multi.incr(minuteKey);
            multi.expire(minuteKey, 60);
            multi.incr(hourKey);
            multi.expire(hourKey, 3600);
            multi.incr(dayKey);
            multi.expire(dayKey, 86400);
            // Record transaction with timestamp
            multi.lPush(transactionKey, now.toString());
            multi.lTrim(transactionKey, 0, 999); // Keep last 1000
            multi.expire(transactionKey, 86400);
            await multi.exec();
        }
        catch (error) {
            logger_js_1.logger.error('Failed to record velocity', { error, userId });
        }
    }
    async getVelocityStats(userId) {
        if (!this.redis) {
            return { perMinute: 0, perHour: 0, perDay: 0, recentTransactions: [] };
        }
        const [minuteCount, hourCount, dayCount, transactions] = await Promise.all([
            this.redis.get(`velocity:minute:${userId}`),
            this.redis.get(`velocity:hour:${userId}`),
            this.redis.get(`velocity:day:${userId}`),
            this.redis.lRange(`velocity:transactions:${userId}`, 0, 9),
        ]);
        return {
            perMinute: minuteCount ? parseInt(minuteCount, 10) : 0,
            perHour: hourCount ? parseInt(hourCount, 10) : 0,
            perDay: dayCount ? parseInt(dayCount, 10) : 0,
            recentTransactions: transactions.map((t) => parseInt(t, 10)),
        };
    }
    async resetVelocity(userId) {
        if (!this.redis)
            return;
        try {
            await this.redis.del([
                `velocity:minute:${userId}`,
                `velocity:hour:${userId}`,
                `velocity:day:${userId}`,
                `velocity:transactions:${userId}`,
            ]);
        }
        catch (error) {
            logger_js_1.logger.error('Failed to reset velocity', { error, userId });
        }
    }
    async checkIPVelocity(ipAddress) {
        if (!this.redis) {
            return {
                isViolation: false,
                score: 0,
                evidence: {},
                riskFactors: [],
                details: {
                    transactionsPerMinute: 0,
                    transactionsPerHour: 0,
                    transactionsPerDay: 0,
                    maxAllowedPerMinute: this.THRESHOLDS.perMinute,
                    maxAllowedPerHour: this.THRESHOLDS.perHour,
                    maxAllowedPerDay: this.THRESHOLDS.perDay,
                },
            };
        }
        const key = `velocity:ip:minute:${ipAddress}`;
        const countStr = await this.redis.get(key);
        const count = countStr ? parseInt(countStr, 10) : 0;
        // Increment
        await this.redis.incr(key);
        await this.redis.expire(key, 60);
        const threshold = this.THRESHOLDS.perMinute * 5; // More lenient for IP
        const isViolation = count >= threshold;
        const score = isViolation ? Math.min(100, 40 + (count - threshold)) : 0;
        return {
            isViolation,
            score,
            violationType: isViolation ? `IP per-minute: ${count}/${threshold}` : undefined,
            evidence: { ipAddress, count },
            riskFactors: isViolation ? ['High IP velocity'] : [],
            details: {
                transactionsPerMinute: count,
                transactionsPerHour: 0,
                transactionsPerDay: 0,
                maxAllowedPerMinute: threshold,
                maxAllowedPerHour: 0,
                maxAllowedPerDay: 0,
            },
        };
    }
}
exports.VelocityCheck = VelocityCheck;
//# sourceMappingURL=velocityCheck.js.map