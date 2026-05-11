/**
 * CrossPlatformLinker - Cross-Platform Account Linking
 * Manages linking between different REZ platform accounts
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { AppType, CrossPlatformLink } from '../types';

export interface PlatformLink {
  link_id: string;
  consumer_id: string;
  source_app: AppType;
  source_user_id: string;
  target_app: AppType;
  target_user_id: string;
  link_type: 'explicit' | 'implicit' | 'inferred';
  confidence: number;
  created_at: string;
  last_sync: string;
  status: 'active' | 'suspended' | 'revoked';
  metadata?: Record<string, any>;
}

export interface LinkingRequest {
  source_app: AppType;
  source_user_id: string;
  target_app: AppType;
  target_user_id: string;
  verification_token?: string;
  link_type?: 'explicit' | 'implicit' | 'inferred';
}

export interface LinkingResult {
  success: boolean;
  link?: PlatformLink;
  error?: string;
}

export class CrossPlatformLinker {
  private links: Map<string, PlatformLink>; // link_id -> PlatformLink
  private userLinks: Map<string, Set<string>>; // userId -> Set<link_ids>
  private appLinks: Map<string, Map<string, PlatformLink>>; // userId -> targetApp -> PlatformLink
  private pendingLinks: Map<string, LinkingRequest>; // token -> LinkingRequest
  private logger: winston.Logger;

  constructor() {
    this.links = new Map();
    this.userLinks = new Map();
    this.appLinks = new Map();
    this.pendingLinks = new Map();
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  // ============================================
  // LINKING OPERATIONS
  // ============================================

  /**
   * Link apps for a user
   */
  async linkApps(
    userId: string,
    sourceApp: AppType,
    targetApp: AppType,
    targetUserId: string,
    linkType: 'explicit' | 'implicit' | 'inferred' = 'explicit',
    metadata?: Record<string, any>
  ): Promise<PlatformLink> {
    // Check for existing link
    const existingLink = this.getLink(userId, sourceApp, targetApp);
    if (existingLink) {
      // Update existing link
      existingLink.target_user_id = targetUserId;
      existingLink.last_sync = new Date().toISOString();
      existingLink.status = 'active';
      this.logger.info('Updated existing app link', { userId, sourceApp, targetApp });
      return existingLink;
    }

    // Create new link
    const link: PlatformLink = {
      link_id: uuidv4(),
      consumer_id: userId,
      source_app: sourceApp,
      source_user_id: '', // Will be set when linked
      target_app: targetApp,
      target_user_id: targetUserId,
      link_type: linkType,
      confidence: this.calculateConfidence(linkType),
      created_at: new Date().toISOString(),
      last_sync: new Date().toISOString(),
      status: 'active',
      metadata,
    };

    // Store the link
    this.links.set(link.link_id, link);
    this.addToIndexes(link);

    this.logger.info('Created new app link', {
      linkId: link.link_id,
      userId,
      sourceApp,
      targetApp,
    });

    return link;
  }

  /**
   * Unlink app
   */
  async unlinkApp(userId: string, app: AppType): Promise<boolean> {
    const userLinks = this.userLinks.get(userId);
    if (!userLinks) return false;

    const linksToRemove: string[] = [];

    for (const linkId of userLinks) {
      const link = this.links.get(linkId);
      if (link && (link.source_app === app || link.target_app === app)) {
        linksToRemove.push(linkId);
        link.status = 'revoked';
      }
    }

    if (linksToRemove.length > 0) {
      this.logger.info('Unlinked app', { userId, app, count: linksToRemove.length });
    }

    return linksToRemove.length > 0;
  }

  /**
   * Verify and complete a pending link
   */
  async verifyAndCompleteLink(
    token: string,
    verificationCode: string
  ): Promise<LinkingResult> {
    const request = this.pendingLinks.get(token);
    if (!request) {
      return { success: false, error: 'Invalid or expired token' };
    }

    // In production, verify the code
    // For now, assume any code is valid for demo
    if (verificationCode.length !== 6) {
      return { success: false, error: 'Invalid verification code' };
    }

    try {
      const link = await this.linkApps(
        request.source_user_id,
        request.source_app,
        request.target_app,
        request.target_user_id,
        request.link_type
      );

      // Remove pending request
      this.pendingLinks.delete(token);

      return { success: true, link };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Create pending link request
   */
  createPendingLink(request: LinkingRequest): string {
    const token = uuidv4();
    this.pendingLinks.set(token, {
      ...request,
      link_type: request.link_type || 'explicit',
    });
    return token;
  }

  // ============================================
  // QUERIES
  // ============================================

  /**
   * Get all links for a user
   */
  getUserLinks(userId: string): PlatformLink[] {
    const linkIds = this.userLinks.get(userId);
    if (!linkIds) return [];
    return Array.from(linkIds)
      .map((id) => this.links.get(id))
      .filter((link): link is PlatformLink => link !== undefined && link.status === 'active');
  }

  /**
   * Get link between specific apps
   */
  getLink(userId: string, sourceApp: AppType, targetApp: AppType): PlatformLink | undefined {
    const userAppLinks = this.appLinks.get(userId);
    if (!userAppLinks) return undefined;

    return (
      userAppLinks.get(`${sourceApp}:${targetApp}`) ||
      userAppLinks.get(`${targetApp}:${sourceApp}`)
    );
  }

  /**
   * Get all linked user IDs across apps
   */
  getLinkedUserIds(userId: string): Map<AppType, string> {
    const result = new Map<AppType, string>();
    const links = this.getUserLinks(userId);

    for (const link of links) {
      if (link.source_user_id === userId) {
        result.set(link.target_app, link.target_user_id);
      } else {
        result.set(link.source_app, link.source_user_id);
      }
    }

    return result;
  }

  /**
   * Check if apps are linked
   */
  areAppsLinked(userId: string, app1: AppType, app2: AppType): boolean {
    return this.getLink(userId, app1, app2) !== undefined;
  }

  /**
   * Get all linked consumers (deduplicated)
   */
  getAllLinkedConsumers(userId: string): string[] {
    const links = this.getUserLinks(userId);
    const consumerIds = new Set<string>();

    for (const link of links) {
      // Add the target consumer (from another app)
      if (link.target_user_id) {
        consumerIds.add(link.target_user_id);
      }
      // Add all other linked consumers through transitive links
    }

    return Array.from(consumerIds);
  }

  // ============================================
  // SYNC & STATUS
  // ============================================

  /**
   * Update sync timestamp
   */
  updateSyncTime(linkId: string): void {
    const link = this.links.get(linkId);
    if (link) {
      link.last_sync = new Date().toISOString();
    }
  }

  /**
   * Suspend a link
   */
  suspendLink(linkId: string, reason?: string): void {
    const link = this.links.get(linkId);
    if (link) {
      link.status = 'suspended';
      if (reason) {
        link.metadata = { ...link.metadata, suspension_reason: reason };
      }
      this.logger.info('Link suspended', { linkId, reason });
    }
  }

  /**
   * Reactivate a suspended link
   */
  reactivateLink(linkId: string): void {
    const link = this.links.get(linkId);
    if (link && link.status === 'suspended') {
      link.status = 'active';
      link.last_sync = new Date().toISOString();
      this.logger.info('Link reactivated', { linkId });
    }
  }

  /**
   * Revoke a link permanently
   */
  revokeLink(linkId: string): void {
    const link = this.links.get(linkId);
    if (link) {
      link.status = 'revoked';
      this.removeFromIndexes(link);
      this.logger.info('Link revoked', { linkId });
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private calculateConfidence(linkType: 'explicit' | 'implicit' | 'inferred'): number {
    switch (linkType) {
      case 'explicit':
        return 1.0;
      case 'implicit':
        return 0.8;
      case 'inferred':
        return 0.5;
      default:
        return 0.5;
    }
  }

  private addToIndexes(link: PlatformLink): void {
    // Add to user links
    if (!this.userLinks.has(link.consumer_id)) {
      this.userLinks.set(link.consumer_id, new Set());
    }
    this.userLinks.get(link.consumer_id)!.add(link.link_id);

    // Add to app links
    if (!this.appLinks.has(link.consumer_id)) {
      this.appLinks.set(link.consumer_id, new Map());
    }
    const appKey = `${link.source_app}:${link.target_app}`;
    this.appLinks.get(link.consumer_id)!.set(appKey, link);
  }

  private removeFromIndexes(link: PlatformLink): void {
    // Remove from user links
    const userLinkSet = this.userLinks.get(link.consumer_id);
    if (userLinkSet) {
      userLinkSet.delete(link.link_id);
      if (userLinkSet.size === 0) {
        this.userLinks.delete(link.consumer_id);
      }
    }

    // Remove from app links
    const userAppLinks = this.appLinks.get(link.consumer_id);
    if (userAppLinks) {
      userAppLinks.delete(`${link.source_app}:${link.target_app}`);
      userAppLinks.delete(`${link.target_app}:${link.source_app}`);
      if (userAppLinks.size === 0) {
        this.appLinks.delete(link.consumer_id);
      }
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get linking statistics
   */
  getStatistics(): {
    totalLinks: number;
    activeLinks: number;
    byAppPair: Record<string, number>;
    avgConfidence: number;
  } {
    let totalLinks = 0;
    let activeLinks = 0;
    const byAppPair: Record<string, number> = {};
    let totalConfidence = 0;

    for (const link of this.links.values()) {
      totalLinks++;
      if (link.status === 'active') {
        activeLinks++;
        totalConfidence += link.confidence;

        const pair = [link.source_app, link.target_app].sort().join(':');
        byAppPair[pair] = (byAppPair[pair] || 0) + 1;
      }
    }

    return {
      totalLinks,
      activeLinks,
      byAppPair,
      avgConfidence: activeLinks > 0 ? totalConfidence / activeLinks : 0,
    };
  }

  /**
   * Find potential linking opportunities
   */
  findPotentialLinks(
    email: string,
    phone?: string
  ): Array<{ userId: string; app: AppType; confidence: number }> {
    // In production, this would query other platforms
    // For now, return empty array
    return [];
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON(): string {
    return JSON.stringify({
      links: Array.from(this.links.entries()),
      userLinks: Array.from(this.userLinks.entries()).map(([k, v]) => [k, Array.from(v)]),
      appLinks: Array.from(this.appLinks.entries()).map(([k, v]) => [
        k,
        Array.from(v.entries()),
      ]),
      pendingLinks: Array.from(this.pendingLinks.entries()),
    });
  }

  static fromJSON(json: string): CrossPlatformLinker {
    const data = JSON.parse(json);
    const linker = new CrossPlatformLinker();
    linker.links = new Map(data.links);
    linker.userLinks = new Map(
      data.userLinks.map(([k, v]: [string, string[]]) => [k, new Set(v)])
    );
    linker.appLinks = new Map(
      data.appLinks.map(([k, v]: [string, [string, PlatformLink][]]) => [
        k,
        new Map(v),
      ])
    );
    linker.pendingLinks = new Map(data.pendingLinks);
    return linker;
  }
}
