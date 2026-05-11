/**
 * DeviceResolver - Cross-Device Identity Resolution
 * Resolves device fingerprints and IDs to consumer identities
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { IdentitySignal } from '../types';

export interface DeviceProfile {
  device_id: string;
  consumer_ids: string[];
  fingerprints: string[];
  ip_addresses: string[];
  user_agents: string[];
  first_seen: string;
  last_seen: string;
  trust_score: number;
  behavioral_patterns: BehavioralPattern[];
}

export interface BehavioralPattern {
  pattern_type: string;
  frequency: number;
  typical_time: string;
  typical_location?: string;
  confidence: number;
}

export interface DeviceGraph {
  device_id: string;
  related_devices: string[];
  shared_ips: string[];
  shared_cookies: string[];
  behavioral_similarity: number;
}

export class DeviceResolver {
  private deviceProfiles: Map<string, DeviceProfile>;
  private deviceGraph: Map<string, DeviceGraph>;
  private fingerprintIndex: Map<string, string>; // fingerprint -> deviceId
  private ipIndex: Map<string, Set<string>>; // ip -> deviceIds
  private enabled: boolean;
  private logger: winston.Logger;

  constructor(enabled: boolean = true) {
    this.deviceProfiles = new Map();
    this.deviceGraph = new Map();
    this.fingerprintIndex = new Map();
    this.ipIndex = new Map();
    this.enabled = enabled;
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

  /**
   * Resolve device to consumer
   */
  async resolve(
    deviceId: string,
    signals: IdentitySignal[]
  ): Promise<{ userId: string | null; confidence: number }> {
    if (!this.enabled) {
      return { userId: null, confidence: 0 };
    }

    // Get or create device profile
    let profile = this.deviceProfiles.get(deviceId);
    if (!profile) {
      profile = this.createDeviceProfile(deviceId);
    }

    // Update profile with signals
    this.updateProfileWithSignals(profile, signals);

    // Find consumer based on signals
    const consumerId = this.findConsumerFromSignals(profile);
    const confidence = this.calculateConfidence(profile, signals);

    if (consumerId) {
      profile.consumer_ids = [consumerId];
    }

    // Update device graph
    await this.updateDeviceGraph(deviceId, signals);

    this.logger.debug('Device resolved', { deviceId, consumerId, confidence });
    return { userId: consumerId, confidence };
  }

  private createDeviceProfile(deviceId: string): DeviceProfile {
    const now = new Date().toISOString();
    const profile: DeviceProfile = {
      device_id: deviceId,
      consumer_ids: [],
      fingerprints: [],
      ip_addresses: [],
      user_agents: [],
      first_seen: now,
      last_seen: now,
      trust_score: 0.5,
      behavioral_patterns: [],
    };
    this.deviceProfiles.set(deviceId, profile);
    return profile;
  }

  private updateProfileWithSignals(profile: DeviceProfile, signals: IdentitySignal[]): void {
    for (const signal of signals) {
      switch (signal.type) {
        case 'device_id':
          // Already handled
          break;
        case 'fingerprint':
          if (!profile.fingerprints.includes(signal.value)) {
            profile.fingerprints.push(signal.value);
            this.fingerprintIndex.set(signal.value, profile.device_id);
          }
          break;
        case 'ip_address':
          if (!profile.ip_addresses.includes(signal.value)) {
            profile.ip_addresses.push(signal.value);
            if (!this.ipIndex.has(signal.value)) {
              this.ipIndex.set(signal.value, new Set());
            }
            this.ipIndex.get(signal.value)!.add(profile.device_id);
          }
          break;
        case 'email':
        case 'phone':
          // These are indirect signals
          break;
      }
    }
    profile.last_seen = new Date().toISOString();
  }

  private findConsumerFromSignals(profile: DeviceProfile): string | null {
    // If device is already linked to a consumer, return it
    if (profile.consumer_ids.length === 1) {
      return profile.consumer_ids[0];
    }

    // Check fingerprints for other linked devices
    for (const fingerprint of profile.fingerprints) {
      const linkedDeviceId = this.fingerprintIndex.get(fingerprint);
      if (linkedDeviceId && linkedDeviceId !== profile.device_id) {
        const linkedProfile = this.deviceProfiles.get(linkedDeviceId);
        if (linkedProfile && linkedProfile.consumer_ids.length > 0) {
          return linkedProfile.consumer_ids[0];
        }
      }
    }

    // Check IPs for other linked devices
    for (const ip of profile.ip_addresses) {
      const deviceIds = this.ipIndex.get(ip);
      if (deviceIds) {
        for (const deviceId of deviceIds) {
          if (deviceId !== profile.device_id) {
            const linkedProfile = this.deviceProfiles.get(deviceId);
            if (linkedProfile && linkedProfile.consumer_ids.length > 0) {
              return linkedProfile.consumer_ids[0];
            }
          }
        }
      }
    }

    return null;
  }

  private calculateConfidence(profile: DeviceProfile, signals: IdentitySignal[]): number {
    let confidence = 0.5;

    // Strong signals
    const strongSignals = signals.filter((s) => s.confidence >= 0.9);
    confidence += strongSignals.length * 0.1;

    // Device profile completeness
    if (profile.fingerprints.length > 0) confidence += 0.1;
    if (profile.ip_addresses.length > 0) confidence += 0.05;
    if (profile.user_agents.length > 0) confidence += 0.05;

    // Already linked to consumer
    if (profile.consumer_ids.length > 0) confidence += 0.2;

    // Recency
    const lastSeen = new Date(profile.last_seen).getTime();
    const daysSinceLastSeen = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen < 1) confidence += 0.05;

    return Math.min(1, confidence);
  }

  private async updateDeviceGraph(deviceId: string, signals: IdentitySignal[]): Promise<void> {
    let graph = this.deviceGraph.get(deviceId);
    if (!graph) {
      graph = {
        device_id: deviceId,
        related_devices: [],
        shared_ips: [],
        shared_cookies: [],
        behavioral_similarity: 0,
      };
      this.deviceGraph.set(deviceId, graph);
    }

    // Find related devices by shared IPs
    const ips = signals
      .filter((s) => s.type === 'ip_address')
      .map((s) => s.value);

    for (const ip of ips) {
      const deviceIds = this.ipIndex.get(ip);
      if (deviceIds) {
        for (const relatedDeviceId of deviceIds) {
          if (relatedDeviceId !== deviceId && !graph.related_devices.includes(relatedDeviceId)) {
            graph.related_devices.push(relatedDeviceId);
            graph.shared_ips.push(ip);
          }
        }
      }
    }

    // Update reverse relationships
    for (const relatedDeviceId of graph.related_devices) {
      let relatedGraph = this.deviceGraph.get(relatedDeviceId);
      if (!relatedGraph) {
        relatedGraph = {
          device_id: relatedDeviceId,
          related_devices: [],
          shared_ips: [],
          shared_cookies: [],
          behavioral_similarity: 0,
        };
        this.deviceGraph.set(relatedDeviceId, relatedGraph);
      }
      if (!relatedGraph.related_devices.includes(deviceId)) {
        relatedGraph.related_devices.push(deviceId);
      }
    }
  }

  // ============================================
  // DEVICE LINKING
  // ============================================

  /**
   * Link device to consumer
   */
  async linkDevice(userId: string, deviceId: string): Promise<void> {
    let profile = this.deviceProfiles.get(deviceId);
    if (!profile) {
      profile = this.createDeviceProfile(deviceId);
    }

    if (!profile.consumer_ids.includes(userId)) {
      profile.consumer_ids.push(userId);
    }

    // Update trust score for linked devices
    profile.trust_score = Math.min(1, profile.trust_score + 0.2);

    this.logger.info('Device linked to consumer', { deviceId, userId });
  }

  /**
   * Unlink device from consumer
   */
  async unlinkDevice(userId: string, deviceId: string): Promise<void> {
    const profile = this.deviceProfiles.get(deviceId);
    if (profile) {
      profile.consumer_ids = profile.consumer_ids.filter((id) => id !== userId);
      profile.trust_score = Math.max(0, profile.trust_score - 0.2);
      this.logger.info('Device unlinked from consumer', { deviceId, userId });
    }
  }

  /**
   * Set device as primary for consumer
   */
  async setPrimaryDevice(userId: string, deviceId: string): Promise<void> {
    // Remove primary from all other devices for this consumer
    for (const profile of this.deviceProfiles.values()) {
      if (profile.consumer_ids.includes(userId)) {
        // In a real system, you'd track which is primary
        profile.trust_score = profile.device_id === deviceId ? 1 : profile.trust_score * 0.8;
      }
    }
  }

  // ============================================
  // DEVICE QUERIES
  // ============================================

  /**
   * Get all devices for a consumer
   */
  getDevicesForConsumer(userId: string): DeviceProfile[] {
    const devices: DeviceProfile[] = [];
    for (const profile of this.deviceProfiles.values()) {
      if (profile.consumer_ids.includes(userId)) {
        devices.push(profile);
      }
    }
    return devices;
  }

  /**
   * Get device profile
   */
  getDeviceProfile(deviceId: string): DeviceProfile | undefined {
    return this.deviceProfiles.get(deviceId);
  }

  /**
   * Find related devices
   */
  findRelatedDevices(deviceId: string): string[] {
    const graph = this.deviceGraph.get(deviceId);
    return graph?.related_devices || [];
  }

  /**
   * Check if devices are related
   */
  areDevicesRelated(deviceId1: string, deviceId2: string): boolean {
    const graph = this.deviceGraph.get(deviceId1);
    return graph?.related_devices.includes(deviceId2) || false;
  }

  /**
   * Get devices sharing IP
   */
  getDevicesSharingIP(ip: string): string[] {
    const deviceIds = this.ipIndex.get(ip);
    return deviceIds ? Array.from(deviceIds) : [];
  }

  // ============================================
  // BEHAVIORAL PATTERNS
  // ============================================

  /**
   * Record behavioral pattern
   */
  recordBehavioralPattern(
    deviceId: string,
    pattern: Omit<BehavioralPattern, 'confidence'>
  ): void {
    const profile = this.deviceProfiles.get(deviceId);
    if (!profile) return;

    // Check if similar pattern exists
    const existing = profile.behavioral_patterns.find(
      (p) => p.pattern_type === pattern.pattern_type
    );

    if (existing) {
      // Update frequency
      existing.frequency += 1;
      // Decay confidence slightly
      existing.confidence = Math.max(0.1, existing.confidence * 0.95);
    } else {
      profile.behavioral_patterns.push({
        ...pattern,
        confidence: 0.5,
      });
    }
  }

  /**
   * Match device by behavioral pattern
   */
  matchByBehavioralPattern(
    deviceId: string,
    targetPattern: Partial<BehavioralPattern>
  ): { deviceId: string; similarity: number }[] {
    const targetProfile = this.deviceProfiles.get(deviceId);
    if (!targetProfile) return [];

    const matches: { deviceId: string; similarity: number }[] = [];

    for (const [otherDeviceId, profile] of this.deviceProfiles) {
      if (otherDeviceId === deviceId) continue;

      let similarity = 0;
      let matchCount = 0;

      for (const targetPat of targetProfile.behavioral_patterns) {
        const match = profile.behavioral_patterns.find(
          (p) =>
            targetPat.pattern_type === p.pattern_type &&
            targetPat.typical_time === p.typical_time
        );
        if (match) {
          similarity += match.confidence;
          matchCount++;
        }
      }

      if (matchCount > 0) {
        similarity /= matchCount;
        matches.push({ deviceId: otherDeviceId, similarity });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  // ============================================
  // TRUST SCORING
  // ============================================

  /**
   * Update device trust score
   */
  updateTrustScore(deviceId: string, delta: number): void {
    const profile = this.deviceProfiles.get(deviceId);
    if (profile) {
      profile.trust_score = Math.min(1, Math.max(0, profile.trust_score + delta));
    }
  }

  /**
   * Get trust score
   */
  getTrustScore(deviceId: string): number {
    const profile = this.deviceProfiles.get(deviceId);
    return profile?.trust_score ?? 0;
  }

  /**
   * Check if device is trusted
   */
  isDeviceTrusted(deviceId: string, threshold: number = 0.7): boolean {
    return this.getTrustScore(deviceId) >= threshold;
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  toJSON(): string {
    return JSON.stringify({
      deviceProfiles: Array.from(this.deviceProfiles.entries()),
      deviceGraph: Array.from(this.deviceGraph.entries()),
      fingerprintIndex: Array.from(this.fingerprintIndex.entries()),
      ipIndex: Array.from(this.ipIndex.entries()).map(([k, v]) => [k, Array.from(v)]),
    });
  }

  static fromJSON(json: string): DeviceResolver {
    const data = JSON.parse(json);
    const resolver = new DeviceResolver();
    resolver.deviceProfiles = new Map(data.deviceProfiles);
    resolver.deviceGraph = new Map(data.deviceGraph);
    resolver.fingerprintIndex = new Map(data.fingerprintIndex);
    resolver.ipIndex = new Map(data.ipIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)]));
    return resolver;
  }
}
