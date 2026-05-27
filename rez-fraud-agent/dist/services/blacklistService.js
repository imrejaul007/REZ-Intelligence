"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlacklistService = void 0;
const Blacklist_1 = require("../models/Blacklist");
const logger_js_1 = require("../utils/logger.js");
class BlacklistService {
    async check(type, value) {
        try {
            const normalizedValue = value.toLowerCase().trim();
            const entry = await Blacklist_1.BlacklistEntry.findOne({
                type,
                value: normalizedValue,
                isActive: true,
                $or: [
                    { isPermanent: true },
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: new Date() } },
                ],
            });
            if (entry) {
                // Record the match
                await entry.recordMatch();
                logger_js_1.logger.info('Blacklist match found', {
                    entryId: entry.entryId,
                    type,
                    value: normalizedValue.substring(0, 8) + '...',
                    reason: entry.reason,
                });
                return {
                    isBlacklisted: true,
                    entry,
                    type,
                    value: normalizedValue,
                };
            }
            return { isBlacklisted: false };
        }
        catch (error) {
            logger_js_1.logger.error('Blacklist check error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                type,
                value: value.substring(0, 8) + '...',
            });
            return { isBlacklisted: false };
        }
    }
    async add(data) {
        try {
            const normalizedValue = data.value.toLowerCase().trim();
            // Check if already exists
            const existing = await Blacklist_1.BlacklistEntry.findOne({
                type: data.type,
                value: normalizedValue,
            });
            if (existing) {
                // Update existing entry
                existing.reason = data.reason;
                existing.severity = data.severity || existing.severity;
                existing.isActive = true;
                existing.addedBy = data.addedBy;
                existing.notes = data.notes || existing.notes;
                existing.details.description = data.details?.description || existing.details.description;
                if (data.isPermanent !== undefined) {
                    existing.isPermanent = data.isPermanent;
                }
                if (data.expiresAt) {
                    existing.expiresAt = data.expiresAt;
                }
                await existing.save();
                logger_js_1.logger.info('Blacklist entry updated', {
                    entryId: existing.entryId,
                    type: data.type,
                    reason: data.reason,
                });
                return { success: true, entry: existing };
            }
            // Create new entry
            const entry = await Blacklist_1.BlacklistEntry.addToBlacklist({
                type: data.type,
                value: data.value,
                reason: data.reason,
                severity: data.severity,
                userId: data.userId,
                addedBy: data.addedBy,
                isPermanent: data.isPermanent,
                expiresAt: data.expiresAt,
                notes: data.notes,
            });
            logger_js_1.logger.info('Blacklist entry created', {
                entryId: entry.entryId,
                type: data.type,
                reason: data.reason,
            });
            return { success: true, entry };
        }
        catch (error) {
            logger_js_1.logger.error('Failed to add blacklist entry', {
                error: error instanceof Error ? error.message : 'Unknown error',
                type: data.type,
                value: data.value.substring(0, 8) + '...',
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async remove(type, value, removedBy) {
        try {
            const normalizedValue = value.toLowerCase().trim();
            const entry = await Blacklist_1.BlacklistEntry.findOneAndUpdate({
                type,
                value: normalizedValue,
                isActive: true,
            }, {
                isActive: false,
                notes: `Removed by ${removedBy} at ${new Date().toISOString()}`,
            }, { new: true });
            if (entry) {
                logger_js_1.logger.info('Blacklist entry removed', {
                    entryId: entry.entryId,
                    type,
                    removedBy,
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger_js_1.logger.error('Failed to remove blacklist entry', {
                error: error instanceof Error ? error.message : 'Unknown error',
                type,
                value: value.substring(0, 8) + '...',
            });
            return false;
        }
    }
    async list(options) {
        const page = options.page || 1;
        const limit = options.limit || 50;
        const skip = (page - 1) * limit;
        const query = {};
        if (options.type)
            query.type = options.type;
        if (options.reason)
            query.reason = options.reason;
        if (options.severity)
            query.severity = options.severity;
        if (options.isActive !== undefined)
            query.isActive = options.isActive;
        const [entries, total] = await Promise.all([
            Blacklist_1.BlacklistEntry.find(query)
                .sort({ addedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .then((docs) => docs),
            Blacklist_1.BlacklistEntry.countDocuments(query),
        ]);
        return {
            entries,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getStats() {
        const [total, active, byType, byReason, bySeverity] = await Promise.all([
            Blacklist_1.BlacklistEntry.countDocuments(),
            Blacklist_1.BlacklistEntry.countDocuments({ isActive: true }),
            Blacklist_1.BlacklistEntry.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),
            Blacklist_1.BlacklistEntry.aggregate([
                { $group: { _id: '$reason', count: { $sum: 1 } } },
            ]),
            Blacklist_1.BlacklistEntry.aggregate([
                { $group: { _id: '$severity', count: { $sum: 1 } } },
            ]),
        ]);
        return {
            total,
            active,
            byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
            byReason: byReason.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
            bySeverity: bySeverity.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        };
    }
    // Quick helpers for common checks
    async isIPBlocked(ip) {
        return this.check(Blacklist_1.BlacklistType.IP_ADDRESS, ip);
    }
    async isDeviceBlocked(fingerprint) {
        return this.check(Blacklist_1.BlacklistType.DEVICE_FINGERPRINT, fingerprint);
    }
    async isUserBlocked(userId) {
        return this.check(Blacklist_1.BlacklistType.USER, userId);
    }
    async isAccountBlocked(accountId) {
        return this.check(Blacklist_1.BlacklistType.ACCOUNT, accountId);
    }
    async blockIP(ip, reason, addedBy, options) {
        return this.add({
            type: Blacklist_1.BlacklistType.IP_ADDRESS,
            value: ip,
            reason,
            addedBy,
            expiresAt: options?.expiresAt,
            notes: options?.notes,
        });
    }
    async blockDevice(fingerprint, reason, addedBy, options) {
        return this.add({
            type: Blacklist_1.BlacklistType.DEVICE_FINGERPRINT,
            value: fingerprint,
            reason,
            addedBy,
            userId: options?.userId,
            expiresAt: options?.expiresAt,
            notes: options?.notes,
        });
    }
}
exports.BlacklistService = BlacklistService;
//# sourceMappingURL=blacklistService.js.map