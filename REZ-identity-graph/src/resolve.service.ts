import * as CryptoJS from 'crypto-js';
import {
  Identity,
  IIdentity,
  IdentityType,
  IdentityStatus
} from './models/identity.model';
import {
  Cluster,
  ICluster,
  ClusterStatus,
  ClusterConfidence
} from './models/cluster.model';
import { Device, DeviceType } from './models/device.model';
import { Activity } from './models/activity.model';
import { linkService, LinkType } from './link.service';
import { logger } from './utils/logger';

export interface UnifiedProfile {
  clusterId: string;
  confidence: ClusterConfidence;
  primaryIdentity: {
    identityId: string;
    type: IdentityType;
    identifier: string;
  };
  identities: {
    identityId: string;
    type: IdentityType;
    identifier: string;
    status: IdentityStatus;
    lastSeenAt: Date | null;
    metadata: Record<string, unknown>;
  }[];
  devices: {
    deviceId: string;
    type: DeviceType;
    lastSeenAt: Date | null;
    linkedAt: Date;
  }[];
  activity: {
    totalSessions: number;
    firstActivityAt: Date | null;
    lastActivityAt: Date | null;
    channels: string[];
    recentActivityCount: number;
  };
  traits: Record<string, unknown>;
  privacySettings: {
    trackingEnabled: boolean;
    marketingConsent: boolean;
    analyticsConsent: boolean;
  };
}

export interface ResolveOptions {
  includeActivity?: boolean;
  includeDevices?: boolean;
  activityDays?: number;
  privacyFilter?: boolean;
}

export interface ResolveBy {
  type?: IdentityType;
  identifier?: string;
  deviceId?: string;
  deviceFingerprint?: string;
  clusterId?: string;
  sessionId?: string;
}

export class ResolveService {
  private hashIdentifier(identifier: string): string {
    return CryptoJS.SHA256(identifier + process.env.IDENTITY_SALT || 'rez-default-salt').toString();
  }

  async resolve(by: ResolveBy, options: ResolveOptions = {}): Promise<UnifiedProfile | null> {
    const { includeActivity = true, includeDevices = true, activityDays = 30, privacyFilter = true } = options;

    let clusterId: string | null = null;
    let identity: IIdentity | null = null;

    if (by.clusterId) {
      const cluster = await Cluster.findOne({ clusterId: by.clusterId });
      if (cluster && cluster.status !== ClusterStatus.ARCHIVED) {
        clusterId = cluster.clusterId;
      }
    } else if (by.identifier) {
      identity = await Identity.findOne({ identifier: by.identifier });
      if (identity && identity.status !== IdentityStatus.DELETED) {
        clusterId = identity.clusterId;
      }
    } else if (by.type && by.identifier) {
      identity = await Identity.findOne({
        type: by.type,
        hashIdentifier: this.hashIdentifier(by.identifier),
        status: { $ne: IdentityStatus.DELETED }
      });
      if (identity) {
        clusterId = identity.clusterId;
      }
    } else if (by.deviceId) {
      const device = await Device.findOne({ deviceId: by.deviceId });
      if (device && device.clusterId) {
        clusterId = device.clusterId;
      }
    } else if (by.deviceFingerprint) {
      const hash = this.hashIdentifier(by.deviceFingerprint);
      const device = await Device.findOne({ fingerprintHash: hash });
      if (device && device.clusterId) {
        clusterId = device.clusterId;
      }
    } else if (by.sessionId) {
      const activity = await Activity.findOne({ 'metadata.sessionId': by.sessionId });
      if (activity) {
        clusterId = activity.clusterId;
      }
    }

    if (!clusterId) {
      logger.debug('Could not resolve identity', { by });
      return null;
    }

    return this.buildUnifiedProfile(clusterId, {
      includeActivity,
      includeDevices,
      activityDays,
      privacyFilter
    });
  }

  async buildUnifiedProfile(
    clusterId: string,
    options: Partial<ResolveOptions> = {}
  ): Promise<UnifiedProfile | null> {
    const { includeActivity = true, includeDevices = true, activityDays = 30, privacyFilter = true } = options;

    const cluster = await Cluster.findOne({ clusterId });
    if (!cluster || cluster.status === ClusterStatus.ARCHIVED) {
      return null;
    }

    const identities = await Identity.find({
      clusterId,
      status: { $ne: IdentityStatus.DELETED }
    });

    if (identities.length === 0) {
      return null;
    }

    let primaryIdentity = identities.find((i) => i.identityId === cluster.primaryIdentityId);
    if (!primaryIdentity) {
      primaryIdentity = identities[0];
    }

    const privacyEnabled = privacyFilter && !primaryIdentity.privacySettings.trackingEnabled;
    if (privacyEnabled) {
      logger.debug('Privacy mode enabled for cluster', { clusterId });
    }

    let devices: { deviceId: string; type: DeviceType; lastSeenAt: Date | null; linkedAt: Date }[] = [];
    if (includeDevices) {
      const deviceDocs = await Device.find({
        clusterId,
        status: { $ne: 'blocked' }
      }).sort({ 'metadata.lastSeenAt': -1 }).limit(10);

      devices = deviceDocs.map((d) => ({
        deviceId: d.deviceId,
        type: d.type,
        lastSeenAt: d.metadata.lastSeenAt || null,
        linkedAt: d.linkedIdentities[0]?.linkedAt || d.createdAt
      }));
    }

    let activityData = {
      totalSessions: cluster.metadata.totalSessions || 0,
      firstActivityAt: cluster.metadata.firstActivityAt || null,
      lastActivityAt: cluster.metadata.lastActivityAt || null,
      channels: [] as string[],
      recentActivityCount: 0
    };

    if (includeActivity && !privacyEnabled) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - activityDays);

      const recentActivities = await Activity.countDocuments({
        clusterId,
        timestamp: { $gte: cutoffDate }
      });

      const channelAggregation = await Activity.aggregate([
        { $match: { clusterId } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      activityData.recentActivityCount = recentActivities;
      activityData.channels = channelAggregation.map((c) => c._id);
    }

    const traits: Record<string, unknown> = {};
    for (const id of identities) {
      if (id.metadata.traits) {
        Object.assign(traits, id.metadata.traits);
      }
    }

    const preferredChannel = this.determinePreferredChannel(identities);

    return {
      clusterId,
      confidence: cluster.confidence,
      primaryIdentity: {
        identityId: primaryIdentity.identityId,
        type: primaryIdentity.type,
        identifier: privacyEnabled ? this.maskIdentifier(primaryIdentity.identifier, primaryIdentity.type) : primaryIdentity.identifier
      },
      identities: identities.map((i) => ({
        identityId: i.identityId,
        type: i.type,
        identifier: privacyEnabled ? this.maskIdentifier(i.identifier, i.type) : i.identifier,
        status: i.status,
        lastSeenAt: i.metadata.lastSeenAt || null,
        metadata: privacyEnabled ? {} : {
          source: i.metadata.source,
          platform: i.metadata.platform,
          appVersion: i.metadata.appVersion,
          sessionCount: i.metadata.sessionCount
        }
      })),
      devices: privacyEnabled ? [] : devices,
      activity: activityData,
      traits: privacyEnabled ? {} : traits,
      privacySettings: {
        trackingEnabled: primaryIdentity.privacySettings.trackingEnabled,
        marketingConsent: primaryIdentity.privacySettings.marketingConsent,
        analyticsConsent: primaryIdentity.privacySettings.analyticsConsent
      }
    };
  }

  private maskIdentifier(identifier: string, type: IdentityType): string {
    if (type === IdentityType.EMAIL) {
      const [local, domain] = identifier.split('@');
      if (local.length <= 2) {
        return `**@${domain}`;
      }
      return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }

    if (type === IdentityType.PHONE) {
      if (identifier.length <= 4) {
        return '*'.repeat(identifier.length);
      }
      return '*'.repeat(identifier.length - 4) + identifier.slice(-4);
    }

    if (identifier.length <= 4) {
      return '*'.repeat(identifier.length);
    }
    return identifier.slice(0, 2) + '*'.repeat(identifier.length - 4) + identifier.slice(-2);
  }

  private determinePreferredChannel(identities: IIdentity[]): string | null {
    const channelCounts: Record<string, number> = {};

    for (const identity of identities) {
      const type = identity.type;
      if (type === IdentityType.APP_USER) {
        channelCounts['app'] = (channelCounts['app'] || 0) + 3;
      } else if (type === IdentityType.WHATSAPP_USER) {
        channelCounts['whatsapp'] = (channelCounts['whatsapp'] || 0) + 2;
      } else if (type === IdentityType.WEB_USER) {
        channelCounts['web'] = (channelCounts['web'] || 0) + 1;
      } else if (type === IdentityType.QR_USER) {
        channelCounts['qr'] = (channelCounts['qr'] || 0) + 1;
      }
    }

    let preferred: string | null = null;
    let maxCount = 0;

    for (const [channel, count] of Object.entries(channelCounts)) {
      if (count > maxCount) {
        maxCount = count;
        preferred = channel;
      }
    }

    return preferred;
  }

  async mergeClusters(
    sourceClusterId: string,
    targetClusterId: string,
    reason: string
  ): Promise<{ success: boolean; newClusterId?: string; error?: string }> {
    const [sourceCluster, targetCluster] = await Promise.all([
      Cluster.findOne({ clusterId: sourceClusterId }),
      Cluster.findOne({ clusterId: targetClusterId })
    ]);

    if (!sourceCluster || !targetCluster) {
      return { success: false, error: 'One or both clusters not found' };
    }

    const dominantCluster =
      sourceCluster.identityCount >= targetCluster.identityCount
        ? sourceCluster
        : targetCluster;
    const subordinateCluster =
      sourceCluster.identityCount >= targetCluster.identityCount
        ? targetCluster
        : sourceCluster;

    await linkService.linkIdentities({
      sourceIdentityId: sourceCluster.primaryIdentityId,
      targetIdentityId: targetCluster.primaryIdentityId,
      linkType: LinkType.MERGE,
      confidence: ClusterConfidence.HIGH,
      reason: reason
    });

    return {
      success: true,
      newClusterId: dominantCluster.clusterId
    };
  }

  async getClusterStats(): Promise<{
    totalClusters: number;
    activeClusters: number;
    mergedClusters: number;
    averageIdentitiesPerCluster: number;
    clustersByConfidence: Record<ClusterConfidence, number>;
  }> {
    const [totalClusters, clusters, activeClusters, mergedClusters] = await Promise.all([
      Cluster.countDocuments(),
      Cluster.find(),
      Cluster.countDocuments({ status: ClusterStatus.ACTIVE }),
      Cluster.countDocuments({ status: ClusterStatus.MERGED })
    ]);

    const totalIdentities = clusters.reduce((sum, c) => sum + c.identityCount, 0);
    const averageIdentitiesPerCluster = totalClusters > 0 ? totalIdentities / totalClusters : 0;

    const clustersByConfidence: Record<string, number> = {};
    for (const confidence of Object.values(ClusterConfidence)) {
      clustersByConfidence[confidence] = 0;
    }
    clusters.forEach((c) => {
      clustersByConfidence[c.confidence]++;
    });

    return {
      totalClusters,
      activeClusters,
      mergedClusters,
      averageIdentitiesPerCluster,
      clustersByConfidence: clustersByConfidence as Record<ClusterConfidence, number>
    };
  }

  async predictUser(
    clusterId: string,
    traits: Record<string, unknown>
  ): Promise<{
    predictedUserId?: string;
    confidence: number;
    attributes: Record<string, unknown>;
  }> {
    const cluster = await Cluster.findOne({ clusterId });
    if (!cluster) {
      return { confidence: 0, attributes: {} };
    }

    const attributes: Record<string, unknown> = {
      totalSessions: cluster.metadata.totalSessions || 0,
      preferredChannel: cluster.metadata.preferredChannel,
      identityCount: cluster.identityCount
    };

    const confidence = this.calculatePredictionConfidence(cluster, traits);

    return {
      predictedUserId: cluster.metadata.predictedUserId,
      confidence,
      attributes
    };
  }

  private calculatePredictionConfidence(
    cluster: ICluster,
    traits: Record<string, unknown>
  ): number {
    let confidence = 0;

    if (cluster.identityCount >= 3) {
      confidence += 30;
    } else if (cluster.identityCount >= 2) {
      confidence += 20;
    } else {
      confidence += 10;
    }

    if (cluster.metadata.totalSessions && cluster.metadata.totalSessions >= 10) {
      confidence += 30;
    } else if (cluster.metadata.totalSessions && cluster.metadata.totalSessions >= 5) {
      confidence += 20;
    } else {
      confidence += 10;
    }

    if (cluster.confidence === ClusterConfidence.HIGH) {
      confidence += 40;
    } else if (cluster.confidence === ClusterConfidence.MEDIUM) {
      confidence += 25;
    } else {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }
}

export const resolveService = new ResolveService();
