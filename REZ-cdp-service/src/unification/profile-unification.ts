import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { ProfileManager, Profile, ProfileAttributes } from '../profiles/profile-manager';
import { IdentityResolver } from '../identity/identity-resolution';

/**
 * Merge strategy options
 */
export type MergeStrategy = 'prefer_primary' | 'prefer_latest' | 'combine_all' | 'manual';

/**
 * Conflict resolution rule
 */
export interface ConflictRule {
  field: string;
  strategy: MergeStrategy;
}

/**
 * Unification request
 */
export interface UnificationRequest {
  profileIds: string[];
  primaryProfileId?: string;
  strategy?: MergeStrategy;
  conflictRules?: ConflictRule[];
  reason?: string;
}

/**
 * Merge preview
 */
export interface MergePreview {
  sourceProfiles: Profile[];
  targetProfile: Profile;
  mergedAttributes: ProfileAttributes;
  conflicts: Array<{
    field: string;
    values: Array<{ profileId: string; value: unknown }>;
    resolvedValue: unknown;
    resolutionMethod: string;
  }>;
  summary: {
    totalProfiles: number;
    attributesOverwritten: number;
    attributesCombined: number;
    attributesPreserved: number;
  };
}

/**
 * Merge result
 */
export interface MergeResult {
  mergeId: string;
  primaryProfile: Profile;
  mergedProfileIds: string[];
  status: 'completed' | 'failed' | 'rolled_back';
  timestamp: string;
  reason?: string;
}

/**
 * Merge history entry
 */
export interface MergeHistoryEntry {
  mergeId: string;
  timestamp: string;
  action: 'merged' | 'reverted';
  primaryProfileId: string;
  mergedProfileIds: string[];
  reason?: string;
  snapshot?: Profile[];
}

/**
 * Profile Unification Service - Merge and manage customer profiles
 */
export class ProfileUnification {
  private profileManager: ProfileManager;
  private identityResolver: IdentityResolver;
  private logger: Logger;
  private mergeHistory: Map<string, MergeHistoryEntry> = new Map();
  private profileMergeHistory: Map<string, string[]> = new Map();

  constructor(logger: Logger, profileManager: ProfileManager, identityResolver: IdentityResolver) {
    this.logger = logger;
    this.profileManager = profileManager;
    this.identityResolver = identityResolver;
    this.initializeSampleHistory();
  }

  /**
   * Initialize sample merge history
   */
  private initializeSampleHistory(): void {
    this.logger.info('Profile unification service initialized');
  }

  /**
   * Preview a merge operation
   */
  async previewMerge(request: UnificationRequest): Promise<MergePreview> {
    const { profileIds, primaryProfileId, strategy = 'prefer_primary' } = request;

    if (profileIds.length < 2) {
      throw new Error('At least 2 profiles required for merge');
    }

    // Fetch all profiles
    const profiles: Profile[] = [];
    for (const id of profileIds) {
      const profile = await this.profileManager.getProfile(id);
      if (!profile) {
        throw new Error(`Profile not found: ${id}`);
      }
      if (profile.status === 'merged') {
        throw new Error(`Profile already merged: ${id}`);
      }
      profiles.push(profile);
    }

    // Determine primary profile
    let targetProfile: Profile;
    if (primaryProfileId) {
      targetProfile = profiles.find(p => p.id === primaryProfileId) || profiles[0];
    } else {
      // Default to most recently updated profile
      targetProfile = profiles.reduce((latest, p) =>
        p.updatedAt > latest.updatedAt ? p : latest
      );
    }

    const sourceProfiles = profiles.filter(p => p.id !== targetProfile.id);

    // Detect and resolve conflicts
    const conflicts: MergePreview['conflicts'] = [];
    const mergedAttributes = this.mergeAttributes(targetProfile.attributes, sourceProfiles.map(p => p.attributes), strategy, conflicts);

    return {
      sourceProfiles,
      targetProfile,
      mergedAttributes,
      conflicts,
      summary: {
        totalProfiles: profiles.length,
        attributesOverwritten: conflicts.filter(c => c.resolutionMethod === 'overwrite').length,
        attributesCombined: conflicts.filter(c => c.resolutionMethod === 'combine').length,
        attributesPreserved: conflicts.filter(c => c.resolutionMethod === 'preserve').length
      }
    };
  }

  /**
   * Execute a merge operation
   */
  async unifyProfiles(request: UnificationRequest): Promise<MergeResult> {
    const { profileIds, primaryProfileId, strategy = 'prefer_primary', reason } = request;

    if (profileIds.length < 2) {
      throw new Error('At least 2 profiles required for merge');
    }

    const mergeId = `merge_${uuidv4().slice(0, 8)}`;

    // Get all profiles
    const profiles: Profile[] = [];
    for (const id of profileIds) {
      const profile = await this.profileManager.getProfile(id);
      if (!profile) {
        throw new Error(`Profile not found: ${id}`);
      }
      if (profile.status === 'merged') {
        throw new Error(`Profile already merged: ${id}`);
      }
      profiles.push(profile);
    }

    // Determine primary profile
    let primaryProfile: Profile;
    if (primaryProfileId) {
      primaryProfile = profiles.find(p => p.id === primaryProfileId) || profiles[0];
    } else {
      primaryProfile = profiles.reduce((latest, p) =>
        p.updatedAt > latest.updatedAt ? p : latest
      );
    }

    const sourceProfiles = profiles.filter(p => p.id !== primaryProfile.id);

    // Create snapshot for rollback
    const snapshot = profiles.map(p => ({ ...p }));

    try {
      // Merge attributes
      const mergedAttributes = this.mergeAttributes(
        primaryProfile.attributes,
        sourceProfiles.map(p => p.attributes),
        strategy,
        []
      );

      // Update primary profile
      const updatedPrimary = await this.profileManager.updateProfile(primaryProfile.id, {
        attributes: mergedAttributes
      });

      // Merge tags
      const allTags = profiles.flatMap(p => p.tags);
      await this.profileManager.addTags(primaryProfile.id, [...new Set(allTags)]);

      // Calculate combined score (max)
      const maxScore = Math.max(...profiles.map(p => p.score || 0));
      await this.profileManager.updateScore(primaryProfile.id, maxScore);

      // Calculate combined lifetime value
      const totalLTV = profiles.reduce((sum, p) => sum + (p.lifetimeValue || 0), 0);

      // Mark source profiles as merged
      for (const source of sourceProfiles) {
        await this.profileManager.updateProfile(source.id, {
          status: 'merged',
          attributes: { _mergedInto: primaryProfile.id }
        } as unknown);
      }

      // Link identities
      const primaryIdentities = await this.identityResolver.getIdentitiesForProfile(primaryProfile.id);
      for (const source of sourceProfiles) {
        const sourceIdentities = await this.identityResolver.getIdentitiesForProfile(source.id);
        for (const sourceIdentity of sourceIdentities) {
          for (const primaryIdentity of primaryIdentities) {
            try {
              await this.identityResolver.linkIdentities({
                identity1Id: primaryIdentity.id,
                identity2Id: sourceIdentity.id,
                confidence: 0.9,
                type: 'deterministic',
                reason: `Profile merge ${mergeId}`
              });
            } catch (e) {
              // Links may already exist
            }
          }
        }
      }

      // Record merge history
      const entry: MergeHistoryEntry = {
        mergeId,
        timestamp: new Date().toISOString(),
        action: 'merged',
        primaryProfileId: primaryProfile.id,
        mergedProfileIds: sourceProfiles.map(p => p.id),
        reason,
        snapshot
      };
      this.mergeHistory.set(mergeId, entry);

      // Update profile merge history index
      for (const profileId of profileIds) {
        const history = this.profileMergeHistory.get(profileId) || [];
        history.push(mergeId);
        this.profileMergeHistory.set(profileId, history);
      }

      // Update total LTV
      await this.profileManager.updateProfile(primaryProfile.id, {
        attributes: { lifetimeValue: totalLTV }
      } as unknown);

      this.logger.info('Profiles merged', {
        mergeId,
        primaryProfileId: primaryProfile.id,
        mergedCount: sourceProfiles.length
      });

      return {
        mergeId,
        primaryProfile: updatedPrimary,
        mergedProfileIds: profileIds,
        status: 'completed',
        timestamp: entry.timestamp,
        reason
      };
    } catch (error) {
      this.logger.error('Merge failed', { mergeId, error });
      return {
        mergeId,
        primaryProfile,
        mergedProfileIds: profileIds,
        status: 'failed',
        timestamp: new Date().toISOString(),
        reason
      };
    }
  }

  /**
   * Revert a merge operation
   */
  async revertMerge(mergeId: string): Promise<MergeResult> {
    const entry = this.mergeHistory.get(mergeId);
    if (!entry) {
      throw new Error(`Merge not found: ${mergeId}`);
    }

    if (entry.action === 'reverted') {
      throw new Error('Merge already reverted');
    }

    if (!entry.snapshot) {
      throw new Error('No snapshot available for rollback');
    }

    try {
      // Restore profiles from snapshot
      for (const profile of entry.snapshot) {
        await this.profileManager.updateProfile(profile.id, {
          attributes: profile.attributes,
          tags: profile.tags,
          status: 'active'
        });
      }

      // Update merge history
      const revertEntry: MergeHistoryEntry = {
        ...entry,
        mergeId: `revert_${mergeId}`,
        timestamp: new Date().toISOString(),
        action: 'reverted'
      };
      this.mergeHistory.set(`revert_${mergeId}`, revertEntry);

      this.logger.info('Merge reverted', { originalMergeId: mergeId });

      const primaryProfile = await this.profileManager.getProfile(entry.primaryProfileId);

      return {
        mergeId: `revert_${mergeId}`,
        primaryProfile: primaryProfile!,
        mergedProfileIds: entry.mergedProfileIds,
        status: 'rolled_back',
        timestamp: revertEntry.timestamp
      };
    } catch (error) {
      this.logger.error('Revert failed', { mergeId, error });
      throw error;
    }
  }

  /**
   * Get merge history for a profile
   */
  async getMergeHistory(profileId: string): Promise<MergeHistoryEntry[]> {
    const mergeIds = this.profileMergeHistory.get(profileId) || [];
    return mergeIds
      .map(id => this.mergeHistory.get(id))
      .filter((e): e is MergeHistoryEntry => e !== undefined)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Get merge details
   */
  async getMergeDetails(mergeId: string): Promise<MergeHistoryEntry | null> {
    return this.mergeHistory.get(mergeId) || null;
  }

  /**
   * Merge attributes from multiple profiles
   */
  private mergeAttributes(
    primary: ProfileAttributes,
    sources: ProfileAttributes[],
    strategy: MergeStrategy,
    conflicts: MergePreview['conflicts']
  ): ProfileAttributes {
    const result: ProfileAttributes = { ...primary };

    // Get all unique field keys
    const allFields = new Set<string>(Object.keys(primary));
    for (const source of sources) {
      for (const key of Object.keys(source)) {
        allFields.add(key);
      }
    }

    for (const field of allFields) {
      const primaryValue = (primary as Record<string, unknown>)[field];
      const sourceValues = sources
        .map(s => (s as Record<string, unknown>)[field])
        .filter(v => v !== undefined && v !== null);

      if (sourceValues.length === 0) {
        continue; // Keep primary value
      }

      const allValues = [primaryValue, ...sourceValues].filter(v => v !== undefined && v !== null);

      if (allValues.length === 1) {
        continue; // No conflict
      }

      // Handle nested objects
      if (typeof allValues[0] === 'object' && allValues[0] !== null) {
        const merged = this.mergeNestedObject(allValues[0] as Record<string, unknown>, sourceValues as Record<string, unknown>[]);
        (result as Record<string, unknown>)[field] = merged;
        continue;
      }

      // Simple value conflict resolution
      let resolvedValue: unknown;
      let resolutionMethod: string;

      switch (strategy) {
        case 'prefer_primary':
          resolvedValue = primaryValue;
          resolutionMethod = 'preserve';
          break;

        case 'prefer_latest':
          const latestSource = sources[sources.length - 1];
          resolvedValue = (latestSource as Record<string, unknown>)[field];
          resolutionMethod = 'overwrite';
          break;

        case 'combine_all':
          if (Array.isArray(primaryValue)) {
            resolvedValue = [...new Set(allValues.flat())];
          } else if (typeof primaryValue === 'string') {
            resolvedValue = allValues.join(', ');
          } else {
            resolvedValue = allValues[allValues.length - 1];
          }
          resolutionMethod = 'combine';
          break;

        default:
          resolvedValue = primaryValue;
          resolutionMethod = 'preserve';
      }

      (result as Record<string, unknown>)[field] = resolvedValue;

      conflicts.push({
        field,
        values: allValues.map((v, i) => ({
          profileId: i === 0 ? 'primary' : sources[i - 1].email || sources[i - 1].phone || `profile_${i}`,
          value: v
        })),
        resolvedValue,
        resolutionMethod
      });
    }

    return result;
  }

  /**
   * Merge nested objects
   */
  private mergeNestedObject(
    primary: Record<string, unknown>,
    sources: Record<string, unknown>[]
  ): Record<string, unknown> {
    const result = { ...primary };

    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        if (result[key] === undefined || result[key] === null) {
          result[key] = value;
        } else if (typeof result[key] === 'object' && typeof value === 'object' && result[key] !== null && value !== null) {
          result[key] = this.mergeNestedObject(
            result[key] as Record<string, unknown>,
            [value as Record<string, unknown>]
          );
        }
      }
    }

    return result;
  }

  /**
   * Find potential duplicate profiles
   */
  async findDuplicates(criteria: {
    emailSimilarity?: boolean;
    phoneMatch?: boolean;
    nameSimilarity?: boolean;
    addressMatch?: boolean;
  }): Promise<Array<{
    profiles: Profile[];
    matchScore: number;
    matchReasons: string[];
  }>> {
    const allProfiles = await this.profileManager.getAllProfiles();
    const duplicates: Array<{
      profiles: Profile[];
      matchScore: number;
      matchReasons: string[];
    }> = [];
    const processed = new Set<string>();

    for (const profile1 of allProfiles.profiles) {
      for (const profile2 of allProfiles.profiles) {
        if (profile1.id >= profile2.id) continue;
        if (processed.has(`${profile1.id}-${profile2.id}`)) continue;

        const matchReasons: string[] = [];
        let score = 0;

        // Email similarity
        if (criteria.emailSimilarity && profile1.attributes.email && profile2.attributes.email) {
          const similarity = this.calculateStringSimilarity(
            profile1.attributes.email,
            profile2.attributes.email
          );
          if (similarity > 0.8) {
            score += similarity * 0.4;
            matchReasons.push(`Email similarity: ${(similarity * 100).toFixed(0)}%`);
          }
        }

        // Phone match
        if (criteria.phoneMatch && profile1.attributes.phone && profile2.attributes.phone) {
          if (this.normalizePhone(profile1.attributes.phone) === this.normalizePhone(profile2.attributes.phone)) {
            score += 0.5;
            matchReasons.push('Phone match');
          }
        }

        // Name similarity
        if (criteria.nameSimilarity && profile1.attributes.firstName && profile2.attributes.firstName) {
          const similarity = this.calculateStringSimilarity(
            `${profile1.attributes.firstName} ${profile1.attributes.lastName || ''}`,
            `${profile2.attributes.firstName} ${profile2.attributes.lastName || ''}`
          );
          if (similarity > 0.7) {
            score += similarity * 0.3;
            matchReasons.push(`Name similarity: ${(similarity * 100).toFixed(0)}%`);
          }
        }

        if (score >= 0.5) {
          duplicates.push({
            profiles: [profile1, profile2],
            matchScore: score,
            matchReasons
          });
          processed.add(`${profile1.id}-${profile2.id}`);
        }
      }
    }

    return duplicates.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return 1 - matrix[s1.length][s2.length] / maxLen;
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Get unification statistics
   */
  async getStatistics(): Promise<{
    totalMerges: number;
    revertedMerges: number;
    profilesEverMerged: number;
    averageMergeSize: number;
  }> {
    const entries = Array.from(this.mergeHistory.values());
    const merges = entries.filter(e => e.action === 'merged');
    const reverted = entries.filter(e => e.action === 'reverted');
    const uniqueProfiles = new Set(
      merges.flatMap(m => [m.primaryProfileId, ...m.mergedProfileIds])
    );

    return {
      totalMerges: merges.length,
      revertedMerges: reverted.length,
      profilesEverMerged: uniqueProfiles.size,
      averageMergeSize: merges.length > 0
        ? merges.reduce((sum, m) => sum + m.mergedProfileIds.length + 1, 0) / merges.length
        : 0
    };
  }
}
