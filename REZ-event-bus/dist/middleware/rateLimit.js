"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
const memoryStore = {
    cache: new Map(),
    get(key) {
        const record = this.cache.get(key);
        if (record && Date.now() > record.resetAt) {
            this.cache.delete(key);
            return undefined;
        }
        return record;
    },
    set(key, value) {
        this.cache.set(key, value);
    },
};
function createRateLimiter(config = {}) {
    const { windowMs = 60000, max = 100, keyGenerator = (req) => req.ip || 'unknown', } = config;
    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        const record = memoryStore.get(key);
        if (!record) {
            memoryStore.set(key, { count: 1, resetAt: now + windowMs });
            res.setHeader('X-RateLimit-Limit', String(max));
            res.setHeader('X-RateLimit-Remaining', String(max - 1));
            return next();
        }
        if (record.count >= max) {
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded',
                retryAfter: Math.ceil((record.resetAt - now) / 1000),
            });
            return;
        }
        record.count++;
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
        next();
    };
}
//# sourceMappingURL=rateLimit.js.map