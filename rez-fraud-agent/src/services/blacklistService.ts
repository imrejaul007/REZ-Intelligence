import { BlacklistEntry, BlacklistType, BlacklistReason, BlacklistSeverity, IBlacklistEntry } from '../models/Blacklist';
import { logger } from '../utils/logger';

export interface BlacklistCheckResult {
  isBlacklisted: boolean;
  entry?: IBlacklistEntry;
  type?: BlacklistType;
  value?: string;
}

export interface BlacklistAddResult {
  success: boolean;
  entry?: IBlacklistEntry;
  error?: string;
}

export class BlacklistService {
  async check(type: BlacklistType, value: string): Promise<BlacklistCheckResult> {
    try {
      const normalizedValue = value.toLowerCase().trim();

      const entry = await BlacklistEntry.findOne({
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

        logger.info('Blacklist match found', {
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
    } catch (error) {
      logger.error('Blacklist check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        value: value.substring(0, 8) + '...',
      });
      return { isBlacklisted: false };
    }
  }

  async add(data: {
    type: BlacklistType;
    value: string;
    reason: BlacklistReason;
    severity?: BlacklistSeverity;
    userId?: string;
    transactionId?: string;
    fraudCaseId?: string;
    addedBy: string;
    isPermanent?: boolean;
    expiresAt?: Date;
    notes?: string;
    details?: {
      description?: string;
      evidence?: Record<string, unknown>;
    };
  }): Promise<BlacklistAddResult> {
    try {
      const normalizedValue = data.value.toLowerCase().trim();

      // Check if already exists
      const existing = await BlacklistEntry.findOne({
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

        logger.info('Blacklist entry updated', {
          entryId: existing.entryId,
          type: data.type,
          reason: data.reason,
        });

        return { success: true, entry: existing };
      }

      // Create new entry
      const entry = await BlacklistEntry.addToBlacklist({
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

      logger.info('Blacklist entry created', {
        entryId: entry.entryId,
        type: data.type,
        reason: data.reason,
      });

      return { success: true, entry };
    } catch (error) {
      logger.error('Failed to add blacklist entry', {
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

  async remove(type: BlacklistType, value: string, removedBy: string): Promise<boolean> {
    try {
      const normalizedValue = value.toLowerCase().trim();

      const entry = await BlacklistEntry.findOneAndUpdate(
        {
          type,
          value: normalizedValue,
          isActive: true,
        },
        {
          isActive: false,
          notes: `Removed by ${removedBy} at ${new Date().toISOString()}`,
        },
        { new: true }
      );

      if (entry) {
        logger.info('Blacklist entry removed', {
          entryId: entry.entryId,
          type,
          removedBy,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to remove blacklist entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        value: value.substring(0, 8) + '...',
      });
      return false;
    }
  }

  async list(options: {
    type?: BlacklistType;
    reason?: BlacklistReason;
    severity?: BlacklistSeverity;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    entries: IBlacklistEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (options.type) query.type = options.type;
    if (options.reason) query.reason = options.reason;
    if (options.severity) query.severity = options.severity;
    if (options.isActive !== undefined) query.isActive = options.isActive;

    const [entries, total] = await Promise.all([
      BlacklistEntry.find(query)
        .sort({ addedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .then((docs) => docs as unknown as IBlacklistEntry[]),
      BlacklistEntry.countDocuments(query),
    ]);

    return {
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
    byReason: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const [total, active, byType, byReason, bySeverity] = await Promise.all([
      BlacklistEntry.countDocuments(),
      BlacklistEntry.countDocuments({ isActive: true }),
      BlacklistEntry.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      BlacklistEntry.aggregate([
        { $group: { _id: '$reason', count: { $sum: 1 } } },
      ]),
      BlacklistEntry.aggregate([
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
  async isIPBlocked(ip: string): Promise<BlacklistCheckResult> {
    return this.check(BlacklistType.IP_ADDRESS, ip);
  }

  async isDeviceBlocked(fingerprint: string): Promise<BlacklistCheckResult> {
    return this.check(BlacklistType.DEVICE_FINGERPRINT, fingerprint);
  }

  async isUserBlocked(userId: string): Promise<BlacklistCheckResult> {
    return this.check(BlacklistType.USER, userId);
  }

  async isAccountBlocked(accountId: string): Promise<BlacklistCheckResult> {
    return this.check(BlacklistType.ACCOUNT, accountId);
  }

  async blockIP(
    ip: string,
    reason: BlacklistReason,
    addedBy: string,
    options?: { expiresAt?: Date; notes?: string }
  ): Promise<BlacklistAddResult> {
    return this.add({
      type: BlacklistType.IP_ADDRESS,
      value: ip,
      reason,
      addedBy,
      expiresAt: options?.expiresAt,
      notes: options?.notes,
    });
  }

  async blockDevice(
    fingerprint: string,
    reason: BlacklistReason,
    addedBy: string,
    options?: { userId?: string; expiresAt?: Date; notes?: string }
  ): Promise<BlacklistAddResult> {
    return this.add({
      type: BlacklistType.DEVICE_FINGERPRINT,
      value: fingerprint,
      reason,
      addedBy,
      userId: options?.userId,
      expiresAt: options?.expiresAt,
      notes: options?.notes,
    });
  }
}
