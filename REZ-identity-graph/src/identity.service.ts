import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
import {
  Identity,
  IIdentity,
  IdentityType,
  IdentityStatus
} from './models/identity.model';
import { Cluster, ClusterConfidence } from './models/cluster.model';
import { logger } from './utils/logger';

export interface CreateIdentityOptions {
  type: IdentityType;
  identifier: string;
  metadata?: Partial<IIdentity['metadata']>;
  privacySettings?: Partial<IIdentity['privacySettings']>;
}

export interface UpdateIdentityOptions {
  metadata?: Partial<IIdentity['metadata']>;
  privacySettings?: Partial<IIdentity['privacySettings']>;
}

export interface IdentityWithCluster {
  identity: IIdentity;
  cluster: {
    clusterId: string;
    identityCount: number;
    confidence: ClusterConfidence;
  };
}

export class IdentityService {
  private hashIdentifier(identifier: string): string {
    return CryptoJS.SHA256(identifier + process.env.IDENTITY_SALT || 'rez-default-salt').toString();
  }

  async createIdentity(options: CreateIdentityOptions): Promise<IIdentity> {
    const { type, identifier, metadata, privacySettings } = options;

    const existingIdentity = await Identity.findOne({
      type,
      hashIdentifier: this.hashIdentifier(identifier)
    });

    if (existingIdentity) {
      logger.info('Identity already exists', { identityId: existingIdentity.identityId });
      return existingIdentity;
    }

    const clusterId = uuidv4();

    const cluster = new Cluster({
      clusterId,
      primaryIdentityId: '',
      status: 'active',
      identityCount: 0,
      identityLinks: [],
      confidence: ClusterConfidence.HIGH
    });
    await cluster.save();

    const identityId = uuidv4();
    const now = new Date();

    const identity = new Identity({
      identityId,
      type,
      identifier,
      hashIdentifier: this.hashIdentifier(identifier),
      clusterId,
      status: IdentityStatus.ACTIVE,
      metadata: {
        source: metadata?.source || 'api',
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        platform: metadata?.platform,
        appVersion: metadata?.appVersion,
        firstSeenAt: now,
        lastSeenAt: now,
        sessionCount: 1,
        traits: metadata?.traits || {}
      },
      privacySettings: {
        trackingEnabled: privacySettings?.trackingEnabled ?? true,
        dataRetentionDays: privacySettings?.dataRetentionDays ?? 365,
        marketingConsent: privacySettings?.marketingConsent ?? false,
        analyticsConsent: privacySettings?.analyticsConsent ?? true,
        thirdPartySharing: privacySettings?.thirdPartySharing ?? false
      }
    });

    await identity.save();

    cluster.primaryIdentityId = identityId;
    cluster.identityCount = 1;
    cluster.identityLinks.push({
      identityId,
      linkType: 'primary',
      confidence: ClusterConfidence.HIGH,
      linkedAt: now
    });
    cluster.metadata.firstActivityAt = now;
    cluster.metadata.lastActivityAt = now;
    cluster.metadata.totalSessions = 1;
    await cluster.save();

    logger.info('Identity created', {
      identityId,
      type,
      clusterId
    });

    return identity;
  }

  async getIdentity(identityId: string): Promise<IdentityWithCluster | null> {
    const identity = await Identity.findOne({ identityId });
    if (!identity) {
      return null;
    }

    const cluster = await Cluster.findOne({ clusterId: identity.clusterId });
    if (!cluster) {
      return null;
    }

    return {
      identity,
      cluster: {
        clusterId: cluster.clusterId,
        identityCount: cluster.identityCount,
        confidence: cluster.confidence
      }
    };
  }

  async getIdentityByTypeAndIdentifier(
    type: IdentityType,
    identifier: string
  ): Promise<IdentityWithCluster | null> {
    const identity = await Identity.findOne({
      type,
      hashIdentifier: this.hashIdentifier(identifier)
    });

    if (!identity) {
      return null;
    }

    return this.getIdentity(identity.identityId);
  }

  async updateIdentity(
    identityId: string,
    options: UpdateIdentityOptions
  ): Promise<IIdentity | null> {
    const identity = await Identity.findOne({ identityId });
    if (!identity) {
      return null;
    }

    if (options.metadata) {
      identity.metadata = {
        ...identity.metadata,
        ...options.metadata,
        lastSeenAt: new Date()
      };
      identity.metadata.sessionCount = (identity.metadata.sessionCount || 0) + 1;
    }

    if (options.privacySettings) {
      identity.privacySettings = {
        ...identity.privacySettings,
        ...options.privacySettings
      };
    }

    await identity.save();

    if (identity.metadata.lastSeenAt) {
      await Cluster.updateOne(
        { clusterId: identity.clusterId },
        { 'metadata.lastActivityAt': new Date() }
      );
    }

    logger.info('Identity updated', { identityId });

    return identity;
  }

  async getIdentitiesByCluster(clusterId: string): Promise<IIdentity[]> {
    return Identity.find({
      clusterId,
      status: { $ne: IdentityStatus.DELETED }
    }).sort({ createdAt: 1 });
  }

  async getIdentitiesByType(type: IdentityType): Promise<IIdentity[]> {
    return Identity.find({
      type,
      status: { $ne: IdentityStatus.DELETED }
    }).sort({ 'metadata.lastSeenAt': -1 });
  }

  async softDeleteIdentity(identityId: string): Promise<boolean> {
    const identity = await Identity.findOne({ identityId });
    if (!identity) {
      return false;
    }

    identity.status = IdentityStatus.DELETED;
    await identity.save();

    await Cluster.updateOne(
      { clusterId: identity.clusterId },
      { $inc: { identityCount: -1 } }
    );

    logger.info('Identity soft deleted', { identityId });

    return true;
  }

  async recordActivity(
    identityId: string,
    activityType: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const identity = await Identity.findOne({ identityId });
    if (!identity) {
      logger.warn('Activity record failed: identity not found', { identityId });
      return;
    }

    identity.metadata.sessionCount = (identity.metadata.sessionCount || 0) + 1;
    identity.metadata.lastSeenAt = new Date();
    await identity.save();

    logger.debug('Activity recorded', { identityId, activityType });
  }

  async getAnonymousIdentity(
    deviceFingerprint: string
  ): Promise<IdentityWithCluster | null> {
    const hash = this.hashIdentifier(deviceFingerprint);
    const identity = await Identity.findOne({
      type: IdentityType.ANONYMOUS,
      hashIdentifier: hash
    });

    if (!identity) {
      return null;
    }

    return this.getIdentity(identity.identityId);
  }

  async promoteAnonymousToIdentified(
    anonymousIdentityId: string,
    newType: IdentityType,
    newIdentifier: string
  ): Promise<IIdentity | null> {
    const anonymousIdentity = await Identity.findOne({
      identityId: anonymousIdentityId,
      type: IdentityType.ANONYMOUS
    });

    if (!anonymousIdentity) {
      return null;
    }

    const newIdentity = await this.createIdentity({
      type: newType,
      identifier: newIdentifier,
      metadata: {
        ...anonymousIdentity.metadata,
        source: 'promotion'
      }
    });

    return newIdentity;
  }

  async searchIdentities(
    query: string,
    limit: number = 50
  ): Promise<IIdentity[]> {
    const searchRegex = new RegExp(query, 'i');

    return Identity.find({
      $and: [
        { status: { $ne: IdentityStatus.DELETED } },
        {
          $or: [
            { identityId: searchRegex },
            { identifier: searchRegex },
            { 'metadata.traits.name': searchRegex }
          ]
        }
      ]
    })
      .limit(limit)
      .sort({ 'metadata.lastSeenAt': -1 });
  }
}

export const identityService = new IdentityService();
