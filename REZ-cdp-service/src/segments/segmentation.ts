import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { ProfileManager, Profile, ProfileAttributes } from '../profiles/profile-manager';

/**
 * Segment definition
 */
export interface Segment {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
  rules: SegmentRule[];
  operator: 'AND' | 'OR';
  memberCount: number;
  estimatedReach?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Segment rule types
 */
export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface SegmentRule {
  id: string;
  field: string;
  operator: RuleOperator;
  value: unknown;
  fieldType: 'string' | 'number' | 'date' | 'boolean' | 'array';
}

/**
 * Segment evaluation result
 */
export interface SegmentEvaluationResult {
  segmentId: string;
  profileId: string;
  matched: boolean;
  matchedRules: string[];
  evaluatedAt: string;
}

/**
 * Predefined segment templates
 */
export interface SegmentTemplate {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  operator: 'AND' | 'OR';
}

/**
 * Segmentation Engine - Create and evaluate customer segments
 */
export class SegmentationEngine {
  private segments: Map<string, Segment> = new Map();
  private profileManager: ProfileManager;
  private logger: Logger;

  constructor(logger: Logger, profileManager: ProfileManager) {
    this.logger = logger;
    this.profileManager = profileManager;
    this.initializeSampleSegments();
  }

  /**
   * Initialize with sample segments
   */
  private initializeSampleSegments(): void {
    const sampleSegments: Segment[] = [
      {
        id: 'seg_premium_users',
        name: 'Premium Users',
        description: 'High-value customers with score >= 80',
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-06-01').toISOString(),
        status: 'active',
        rules: [
          {
            id: 'rule_1',
            field: 'score',
            operator: 'greater_than',
            value: 80,
            fieldType: 'number'
          }
        ],
        operator: 'AND',
        memberCount: 1
      },
      {
        id: 'seg_recent_signups',
        name: 'Recent Signups',
        description: 'Profiles created in the last 30 days',
        createdAt: new Date('2024-02-01').toISOString(),
        updatedAt: new Date('2024-06-01').toISOString(),
        status: 'active',
        rules: [
          {
            id: 'rule_1',
            field: 'createdAt',
            operator: 'greater_than',
            value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            fieldType: 'date'
          }
        ],
        operator: 'AND',
        memberCount: 2
      },
      {
        id: 'seg_tech_enthusiasts',
        name: 'Tech Enthusiasts',
        description: 'Users interested in technology',
        createdAt: new Date('2024-03-01').toISOString(),
        updatedAt: new Date('2024-06-01').toISOString(),
        status: 'active',
        rules: [
          {
            id: 'rule_1',
            field: 'tags',
            operator: 'contains',
            value: 'tech-savvy',
            fieldType: 'array'
          }
        ],
        operator: 'AND',
        memberCount: 1
      },
      {
        id: 'seg_mobile_users',
        name: 'Mobile App Users',
        description: 'Users from mobile app source',
        createdAt: new Date('2024-04-01').toISOString(),
        updatedAt: new Date('2024-06-01').toISOString(),
        status: 'active',
        rules: [
          {
            id: 'rule_1',
            field: 'source',
            operator: 'equals',
            value: 'mobile-app',
            fieldType: 'string'
          }
        ],
        operator: 'AND',
        memberCount: 1
      }
    ];

    sampleSegments.forEach(segment => {
      this.segments.set(segment.id, segment);
    });

    this.logger.info('Segmentation engine initialized with sample segments', { count: sampleSegments.length });
  }

  /**
   * Create a new segment
   */
  async createSegment(data: {
    name: string;
    description?: string;
    rules: SegmentRule[];
    operator?: 'AND' | 'OR';
    metadata?: Record<string, unknown>;
  }): Promise<Segment> {
    const id = `seg_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const segment: Segment = {
      id,
      name: data.name,
      description: data.description || '',
      createdAt: now,
      updatedAt: now,
      status: 'active',
      rules: data.rules.map(rule => ({
        ...rule,
        id: rule.id || `rule_${uuidv4().slice(0, 8)}`
      })),
      operator: data.operator || 'AND',
      memberCount: 0,
      metadata: data.metadata
    };

    // Evaluate immediately to get member count
    const profiles = await this.profileManager.getAllProfiles();
    const matchingProfiles = await this.evaluateProfilesAgainstSegment(profiles.profiles, segment);
    segment.memberCount = matchingProfiles.length;

    this.segments.set(id, segment);
    this.logger.info('Segment created', { id, name: segment.name, memberCount: segment.memberCount });

    return segment;
  }

  /**
   * Get a segment by ID
   */
  async getSegment(id: string): Promise<Segment | null> {
    return this.segments.get(id) || null;
  }

  /**
   * List all segments
   */
  async listSegments(options?: {
    status?: Segment['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ segments: Segment[]; total: number }> {
    let results = Array.from(this.segments.values());

    if (options?.status) {
      results = results.filter(s => s.status === options.status);
    }

    const total = results.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    return {
      segments: results.slice(offset, offset + limit),
      total
    };
  }

  /**
   * Update a segment
   */
  async updateSegment(id: string, data: Partial<{
    name: string;
    description: string;
    rules: SegmentRule[];
    operator: 'AND' | 'OR';
    status: Segment['status'];
  }>): Promise<Segment> {
    const segment = this.segments.get(id);
    if (!segment) {
      throw new Error(`Segment not found: ${id}`);
    }

    const updatedSegment: Segment = {
      ...segment,
      ...data,
      rules: data.rules ? data.rules.map(rule => ({
        ...rule,
        id: rule.id || `rule_${uuidv4().slice(0, 8)}`
      })) : segment.rules,
      updatedAt: new Date().toISOString()
    };

    // Recalculate member count if rules changed
    if (data.rules || data.operator) {
      const profiles = await this.profileManager.getAllProfiles();
      const matchingProfiles = await this.evaluateProfilesAgainstSegment(profiles.profiles, updatedSegment);
      updatedSegment.memberCount = matchingProfiles.length;
    }

    this.segments.set(id, updatedSegment);
    this.logger.info('Segment updated', { id });

    return updatedSegment;
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string): Promise<void> {
    const segment = this.segments.get(id);
    if (!segment) {
      throw new Error(`Segment not found: ${id}`);
    }

    segment.status = 'archived';
    segment.updatedAt = new Date().toISOString();
    this.segments.set(id, segment);

    this.logger.info('Segment archived', { id });
  }

  /**
   * Evaluate a single profile against a segment
   */
  async evaluateProfile(profileId: string, segmentId: string): Promise<SegmentEvaluationResult> {
    const profile = await this.profileManager.getProfile(profileId);
    const segment = this.segments.get(segmentId);

    if (!profile || !segment) {
      return {
        segmentId,
        profileId,
        matched: false,
        matchedRules: [],
        evaluatedAt: new Date().toISOString()
      };
    }

    const results = segment.rules.map(rule => ({
      ruleId: rule.id,
      matched: this.evaluateRule(profile, rule)
    }));

    const matched = segment.operator === 'AND'
      ? results.every(r => r.matched)
      : results.some(r => r.matched);

    return {
      segmentId,
      profileId,
      matched,
      matchedRules: results.filter(r => r.matched).map(r => r.ruleId),
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluate a segment and return matching profiles
   */
  async evaluateSegment(segmentId: string): Promise<{
    segment: Segment;
    profiles: Profile[];
    count: number;
    evaluatedAt: string;
  }> {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    const profiles = await this.profileManager.getAllProfiles();
    const matchingProfiles = await this.evaluateProfilesAgainstSegment(profiles.profiles, segment);

    // Update member count
    segment.memberCount = matchingProfiles.length;
    segment.estimatedReach = matchingProfiles.length;
    this.segments.set(segmentId, segment);

    return {
      segment,
      profiles: matchingProfiles,
      count: matchingProfiles.length,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Get segment members
   */
  async getSegmentMembers(segmentId: string): Promise<Profile[]> {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    const profiles = await this.profileManager.getAllProfiles();
    return this.evaluateProfilesAgainstSegment(profiles.profiles, segment);
  }

  /**
   * Evaluate multiple profiles against a segment
   */
  private async evaluateProfilesAgainstSegment(profiles: Profile[], segment: Segment): Promise<Profile[]> {
    return profiles.filter(profile =>
      this.evaluateProfileRules(profile, segment.rules, segment.operator)
    );
  }

  /**
   * Evaluate all rules for a profile
   */
  private evaluateProfileRules(profile: Profile, rules: SegmentRule[], operator: 'AND' | 'OR'): boolean {
    const results = rules.map(rule => this.evaluateRule(profile, rule));

    return operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Evaluate a single rule against a profile
   */
  private evaluateRule(profile: Profile, rule: SegmentRule): boolean {
    const fieldValue = this.getNestedFieldValue(profile, rule.field);

    switch (rule.operator) {
      case 'equals':
        return fieldValue === rule.value;

      case 'not_equals':
        return fieldValue !== rule.value;

      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(rule.value as string);
        }
        return typeof fieldValue === 'string' && fieldValue.includes(rule.value as string);

      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(rule.value as string);
        }
        return typeof fieldValue === 'string' && !fieldValue.includes(rule.value as string);

      case 'starts_with':
        return typeof fieldValue === 'string' && fieldValue.startsWith(rule.value as string);

      case 'ends_with':
        return typeof fieldValue === 'string' && fieldValue.endsWith(rule.value as string);

      case 'greater_than':
        if (typeof fieldValue === 'number' && typeof rule.value === 'number') {
          return fieldValue > rule.value;
        }
        if (typeof fieldValue === 'string' && typeof rule.value === 'string') {
          return fieldValue > rule.value;
        }
        return false;

      case 'less_than':
        if (typeof fieldValue === 'number' && typeof rule.value === 'number') {
          return fieldValue < rule.value;
        }
        if (typeof fieldValue === 'string' && typeof rule.value === 'string') {
          return fieldValue < rule.value;
        }
        return false;

      case 'between':
        if (typeof rule.value === 'object' && rule.value !== null && 'min' in rule.value && 'max' in rule.value) {
          const { min, max } = rule.value as { min: number; max: number };
          if (typeof fieldValue === 'number') {
            return fieldValue >= min && fieldValue <= max;
          }
        }
        return false;

      case 'in':
        if (Array.isArray(rule.value)) {
          return rule.value.includes(fieldValue);
        }
        return false;

      case 'not_in':
        if (Array.isArray(rule.value)) {
          return !rule.value.includes(fieldValue);
        }
        return true;

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        return false;
    }
  }

  /**
   * Get nested field value from profile using dot notation
   */
  private getNestedFieldValue(profile: Profile, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = profile;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Check if profile matches any of multiple segments
   */
  async checkProfileSegmentMembership(profileId: string): Promise<{
    profileId: string;
    segments: Array<{ segmentId: string; name: string; matched: boolean }>;
  }> {
    const profile = await this.profileManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const segments = Array.from(this.segments.values()).filter(s => s.status === 'active');
    const results = [];

    for (const segment of segments) {
      const matched = this.evaluateProfileRules(profile, segment.rules, segment.operator);
      results.push({
        segmentId: segment.id,
        name: segment.name,
        matched
      });
    }

    return {
      profileId,
      segments: results
    };
  }

  /**
   * Get segment overlap analysis
   */
  async analyzeSegmentOverlap(segmentIds: string[]): Promise<{
    segments: Segment[];
    overlap: Record<string, Set<string>>;
    union: Set<string>;
    intersection: Set<string>;
  }> {
    const segments = segmentIds.map(id => this.segments.get(id)).filter(Boolean) as Segment[];
    const profileSets: Map<string, Set<string>> = new Map();

    for (const segment of segments) {
      const profiles = await this.getSegmentMembers(segment.id);
      profileSets.set(segment.id, new Set(profiles.map(p => p.id)));
    }

    const union = new Set<string>();
    const intersection = new Set<string>(Array.from(profileSets.values())[0] || []);

    for (const [segmentId, profileIds] of profileSets) {
      for (const profileId of profileIds) {
        union.add(profileId);
      }
      // Recalculate intersection
      intersection.delete(profileId);
      for (const profileId of profileIds) {
        if (!Array.from(profileSets.values()).every(s => s.has(profileId))) {
          intersection.delete(profileId);
        }
      }
    }

    // Recalculate intersection properly
    const firstSet = Array.from(profileSets.values())[0];
    if (firstSet) {
      const correctIntersection = new Set<string>();
      for (const profileId of firstSet) {
        if (Array.from(profileSets.values()).every(s => s.has(profileId))) {
          correctIntersection.add(profileId);
        }
      }
      intersection.delete(profileId);
      for (const p of intersection) {
        correctIntersection.delete(p);
      }
      intersection.clear();
      for (const p of correctIntersection) {
        intersection.add(p);
      }
    }

    const overlap: Record<string, Set<string>> = {};
    for (const [id1, set1] of profileSets) {
      for (const [id2, set2] of profileSets) {
        if (id1 !== id2) {
          const key = `${id1}_${id2}`;
          const intersection = new Set([...set1].filter(x => set2.has(x)));
          overlap[key] = intersection;
        }
      }
    }

    return {
      segments,
      overlap,
      union,
      intersection
    };
  }
}
