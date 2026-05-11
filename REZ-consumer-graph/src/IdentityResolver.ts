/**
 * IdentityResolver - Cross-device Identity Resolution
 * Resolves and links consumer identities across devices and platforms
 */

import { v4 as uuidv4 } from 'uuid';
import {
  IdentitySignal,
  IdentityCluster,
  DeviceGraph,
  CrossPlatformLink,
  Consumer360,
  AppType,
} from './types';

export interface ResolutionResult {
  cluster: IdentityCluster;
  action: 'create_new' | 'merge' | 'link_existing' | 'no_action';
  confidence: number;
}

export interface MatchingStrategy {
  deterministic: {
    enabled: boolean;
    weight: number;
    signals: Array<'email' | 'phone' | 'account_id'>;
  };
  probabilistic: {
    enabled: boolean;
    weight: number;
    device_graph_weight: number;
    behavioral_weight: number;
    threshold: number;
  };
}

export class IdentityResolver {
  private clusters: Map<string, IdentityCluster>;
  private deviceGraphs: Map<string, DeviceGraph>;
  private crossPlatformLinks: Map<string, CrossPlatformLink[]>;
  private strategy: MatchingStrategy;

  constructor(strategy?: Partial<MatchingStrategy>) {
    this.clusters = new Map();
    this.deviceGraphs = new Map();
    this.crossPlatformLinks = new Map();
    this.strategy = this.getDefaultStrategy();
    if (strategy) {
      this.strategy = { ...this.strategy, ...strategy };
    }
  }

  private getDefaultStrategy(): MatchingStrategy {
    return {
      deterministic: {
        enabled: true,
        weight: 1.0,
        signals: ['email', 'phone', 'account_id'],
      },
      probabilistic: {
        enabled: true,
        weight: 0.7,
        device_graph_weight: 0.5,
        behavioral_weight: 0.3,
        threshold: 0.75,
      },
    };
  }

  // ============================================
  // SIGNAL PROCESSING
  // ============================================

  /**
   * Process an incoming identity signal
   */
  async processSignal(signal: IdentitySignal): Promise<ResolutionResult> {
    // Hash the signal value if not already hashed
    const processedSignal = this.processSignalValue(signal);

    // Try deterministic matching first
    if (this.strategy.deterministic.enabled) {
      const deterministicResult = this.findDeterministicMatch(processedSignal);
      if (deterministicResult) {
        return deterministicResult;
      }
    }

    // Try probabilistic matching
    if (this.strategy.probabilistic.enabled) {
      const probabilisticResult = await this.findProbabilisticMatch(processedSignal);
      if (probabilisticResult) {
        return probabilisticResult;
      }
    }

    // Create new cluster for unmatched signal
    return this.createNewCluster(processedSignal);
  }

  private processSignalValue(signal: IdentitySignal): IdentitySignal {
    if (!signal.hashed && ['email', 'phone'].includes(signal.type)) {
      return {
        ...signal,
        value: this.hashValue(signal.value),
        hashed: true,
      };
    }
    return signal;
  }

  private hashValue(value: string): string {
    // Simple hash for demonstration - in production use proper hashing
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // ============================================
  // DETERMINISTIC MATCHING
  // ============================================

  private findDeterministicMatch(signal: IdentitySignal): ResolutionResult | null {
    for (const [clusterId, cluster] of this.clusters) {
      const match = cluster.signals.find(
        (s) => s.type === signal.type && s.value === signal.value
      );

      if (match) {
        // Update signal with new timestamp
        const updatedSignals = cluster.signals.map((s) =>
          s.type === signal.type && s.value === signal.value ? signal : s
        );

        // Add signal if it's new
        if (!updatedSignals.some((s) => s.value === signal.value)) {
          updatedSignals.push(signal);
        }

        cluster.signals = updatedSignals;
        cluster.resolved_at = new Date().toISOString();

        return {
          cluster,
          action: 'link_existing',
          confidence: 1.0,
        };
      }
    }
    return null;
  }

  // ============================================
  // PROBABILISTIC MATCHING
  // ============================================

  private async findProbabilisticMatch(signal: IdentitySignal): Promise<ResolutionResult | null> {
    if (signal.type !== 'device_id' && signal.type !== 'fingerprint') {
      return null;
    }

    // Get or create device graph for this device
    let deviceGraph = this.deviceGraphs.get(signal.value);
    if (!deviceGraph) {
      deviceGraph = await this.buildDeviceGraph(signal.value);
      this.deviceGraphs.set(signal.value, deviceGraph);
    }

    if (!deviceGraph || deviceGraph.consumer_ids.length === 0) {
      return null;
    }

    // Find best matching cluster
    let bestMatch: IdentityCluster | null = null;
    let bestScore = 0;

    for (const consumerId of deviceGraph.consumer_ids) {
      const cluster = this.findClusterByConsumerId(consumerId);
      if (!cluster) continue;

      const score = this.calculateMatchScore(signal, deviceGraph, cluster);
      if (score > bestScore && score >= this.strategy.probabilistic.threshold) {
        bestScore = score;
        bestMatch = cluster;
      }
    }

    if (bestMatch) {
      bestMatch.signals.push(signal);
      bestMatch.resolved_at = new Date().toISOString();
      bestMatch.confidence = bestScore;

      return {
        cluster: bestMatch,
        action: 'merge',
        confidence: bestScore,
      };
    }

    return null;
  }

  private async buildDeviceGraph(deviceId: string): Promise<DeviceGraph> {
    // In production, this would query the graph database
    // for device relationships
    return {
      device_id: deviceId,
      consumer_ids: [],
      shared_ips: [],
      shared_cookies: [],
      behavioral_similarity: 0,
      last_seen: new Date().toISOString(),
    };
  }

  private calculateMatchScore(
    signal: IdentitySignal,
    deviceGraph: DeviceGraph,
    cluster: IdentityCluster
  ): number {
    let score = 0;

    // Device graph similarity
    const deviceWeight = this.strategy.probabilistic.device_graph_weight;
    if (deviceGraph.consumer_ids.includes(cluster.canonical_user_id)) {
      score += deviceWeight * deviceGraph.behavioral_similarity;
    }

    // Behavioral similarity (from AI analysis)
    const behavioralWeight = this.strategy.probabilistic.behavioral_weight;
    const behavioralScore = this.calculateBehavioralScore(signal, cluster);
    score += behavioralWeight * behavioralScore;

    // Normalize by signal confidence
    score *= signal.confidence;

    return Math.min(1, score);
  }

  private calculateBehavioralScore(signal: IdentitySignal, cluster: IdentityCluster): number {
    // Placeholder for behavioral analysis
    // In production, this would analyze browsing patterns, purchase timing, etc.
    return 0.5;
  }

  private findClusterByConsumerId(consumerId: string): IdentityCluster | undefined {
    for (const cluster of this.clusters.values()) {
      if (cluster.canonical_user_id === consumerId) {
        return cluster;
      }
    }
    return undefined;
  }

  // ============================================
  // CLUSTER MANAGEMENT
  // ============================================

  private createNewCluster(signal: IdentitySignal): ResolutionResult {
    const clusterId = uuidv4();
    const canonicalUserId = uuidv4();

    const cluster: IdentityCluster = {
      cluster_id: clusterId,
      canonical_user_id: canonicalUserId,
      signals: [signal],
      resolved_at: new Date().toISOString(),
      resolution_method: 'deterministic',
      confidence: signal.confidence,
    };

    this.clusters.set(clusterId, cluster);

    return {
      cluster,
      action: 'create_new',
      confidence: signal.confidence,
    };
  }

  /**
   * Merge two clusters into one
   */
  async mergeClusters(sourceClusterId: string, targetClusterId: string): Promise<IdentityCluster> {
    const sourceCluster = this.clusters.get(sourceClusterId);
    const targetCluster = this.clusters.get(targetClusterId);

    if (!sourceCluster || !targetCluster) {
      throw new Error('One or both clusters not found');
    }

    // Merge signals, avoiding duplicates
    const mergedSignals = [...targetCluster.signals];
    for (const signal of sourceCluster.signals) {
      if (!mergedSignals.some((s) => s.type === signal.type && s.value === signal.value)) {
        mergedSignals.push(signal);
      }
    }

    // Update target cluster
    targetCluster.signals = mergedSignals;
    targetCluster.resolved_at = new Date().toISOString();
    targetCluster.resolution_method = 'merged';
    targetCluster.confidence = Math.max(targetCluster.confidence, sourceCluster.confidence);

    // Delete source cluster
    this.clusters.delete(sourceClusterId);

    // Transfer cross-platform links
    const sourceLinks = this.crossPlatformLinks.get(sourceClusterId) || [];
    const targetLinks = this.crossPlatformLinks.get(targetClusterId) || [];
    this.crossPlatformLinks.set(targetClusterId, [...targetLinks, ...sourceLinks]);
    this.crossPlatformLinks.delete(sourceClusterId);

    return targetCluster;
  }

  // ============================================
  // CROSS-PLATFORM LINKING
  // ============================================

  /**
   * Link two apps for the same consumer
   */
  linkApps(
    clusterId: string,
    sourceApp: AppType,
    targetApp: AppType,
    linkType: 'explicit' | 'implicit' | 'inferred' = 'explicit'
  ): CrossPlatformLink {
    const link: CrossPlatformLink = {
      source_app: sourceApp,
      target_app: targetApp,
      link_type: linkType,
      confidence: linkType === 'explicit' ? 1.0 : linkType === 'implicit' ? 0.8 : 0.5,
      created_at: new Date().toISOString(),
    };

    const existingLinks = this.crossPlatformLinks.get(clusterId) || [];
    existingLinks.push(link);
    this.crossPlatformLinks.set(clusterId, existingLinks);

    return link;
  }

  /**
   * Get all linked apps for a cluster
   */
  getLinkedApps(clusterId: string): CrossPlatformLink[] {
    return this.crossPlatformLinks.get(clusterId) || [];
  }

  /**
   * Check if two apps are linked
   */
  areAppsLinked(clusterId: string, app1: AppType, app2: AppType): boolean {
    const links = this.crossPlatformLinks.get(clusterId) || [];
    return links.some(
      (link) =>
        (link.source_app === app1 && link.target_app === app2) ||
        (link.source_app === app2 && link.target_app === app1)
    );
  }

  // ============================================
  // CLUSTER QUERIES
  // ============================================

  getCluster(clusterId: string): IdentityCluster | undefined {
    return this.clusters.get(clusterId);
  }

  getClusterByUserId(userId: string): IdentityCluster | undefined {
    for (const cluster of this.clusters.values()) {
      if (cluster.canonical_user_id === userId) {
        return cluster;
      }
    }
    return undefined;
  }

  getAllClusters(): IdentityCluster[] {
    return Array.from(this.clusters.values());
  }

  getSignalsByType(type: IdentitySignal['type']): IdentitySignal[] {
    const signals: IdentitySignal[] = [];
    for (const cluster of this.clusters.values()) {
      signals.push(...cluster.signals.filter((s) => s.type === type));
    }
    return signals;
  }

  // ============================================
  // DEVICE GRAPH OPERATIONS
  // ============================================

  /**
   * Update device graph with new connection information
   */
  updateDeviceGraph(
    deviceId: string,
    consumerId: string,
    sharedIp?: string,
    sharedCookie?: string
  ): void {
    let graph = this.deviceGraphs.get(deviceId);

    if (!graph) {
      graph = {
        device_id: deviceId,
        consumer_ids: [],
        shared_ips: [],
        shared_cookies: [],
        behavioral_similarity: 0,
        last_seen: new Date().toISOString(),
      };
    }

    if (!graph.consumer_ids.includes(consumerId)) {
      graph.consumer_ids.push(consumerId);
    }

    if (sharedIp && !graph.shared_ips.includes(sharedIp)) {
      graph.shared_ips.push(sharedIp);
    }

    if (sharedCookie && !graph.shared_cookies.includes(sharedCookie)) {
      graph.shared_cookies.push(sharedCookie);
    }

    graph.last_seen = new Date().toISOString();
    this.deviceGraphs.set(deviceId, graph);
  }

  /**
   * Find devices that may belong to the same consumer
   */
  findRelatedDevices(deviceId: string): string[] {
    const graph = this.deviceGraphs.get(deviceId);
    if (!graph) return [];

    const relatedDevices: string[] = [];

    for (const [otherDeviceId, otherGraph] of this.deviceGraphs) {
      if (otherDeviceId === deviceId) continue;

      // Check for shared IPs
      const sharedIps = graph.shared_ips.filter((ip) =>
        otherGraph.shared_ips.includes(ip)
      );

      // Check for shared cookies
      const sharedCookies = graph.shared_cookies.filter((cookie) =>
        otherGraph.shared_cookies.includes(cookie)
      );

      if (sharedIps.length > 0 || sharedCookies.length > 0) {
        relatedDevices.push(otherDeviceId);
      }
    }

    return relatedDevices;
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON(): string {
    return JSON.stringify({
      clusters: Array.from(this.clusters.entries()),
      deviceGraphs: Array.from(this.deviceGraphs.entries()),
      crossPlatformLinks: Array.from(this.crossPlatformLinks.entries()),
      strategy: this.strategy,
    });
  }

  static fromJSON(json: string): IdentityResolver {
    const data = JSON.parse(json);
    const resolver = new IdentityResolver(data.strategy);
    resolver.clusters = new Map(data.clusters);
    resolver.deviceGraphs = new Map(data.deviceGraphs);
    resolver.crossPlatformLinks = new Map(data.crossPlatformLinks);
    return resolver;
  }
}
