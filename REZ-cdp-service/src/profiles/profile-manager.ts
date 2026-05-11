import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

/**
 * Profile attributes with typed schema
 */
export interface ProfileAttributes {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    coordinates?: { lat: number; lng: number };
  };
  company?: {
    name?: string;
    title?: string;
    industry?: string;
    size?: string;
  };
  preferences?: {
    language?: string;
    timezone?: string;
    communicationChannels?: string[];
    interests?: string[];
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Customer profile entity
 */
export interface Profile {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  identityId: string;
  attributes: ProfileAttributes;
  consent: {
    marketing: boolean;
    analytics: boolean;
    thirdParty: boolean;
  };
  status: 'active' | 'inactive' | 'deleted' | 'merged';
  score?: number;
  lifetimeValue?: number;
  tags: string[];
  source: string;
}

/**
 * Search criteria for profiles
 */
export interface ProfileSearchCriteria {
  email?: string;
  phone?: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  status?: Profile['status'];
  createdAfter?: string;
  createdBefore?: string;
}

/**
 * Profile update data
 */
export interface ProfileUpdateData {
  attributes?: Partial<ProfileAttributes>;
  tags?: string[];
  status?: Profile['status'];
  consent?: Partial<Profile['consent']>;
}

/**
 * Profile Manager - Core service for customer profile CRUD operations
 */
export class ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private phoneIndex: Map<string, string> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeSampleData();
  }

  /**
   * Initialize with sample data for testing
   */
  private initializeSampleData(): void {
    const sampleProfiles: Profile[] = [
      {
        id: 'prof_001',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-06-10').toISOString(),
        lastActivityAt: new Date('2024-06-10').toISOString(),
        identityId: 'iden_001',
        attributes: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@example.com',
          phone: '+1-555-0101',
          dateOfBirth: '1985-03-22',
          gender: 'male',
          location: {
            city: 'San Francisco',
            state: 'CA',
            country: 'US',
            postalCode: '94102'
          },
          company: {
            name: 'Tech Corp',
            title: 'Software Engineer',
            industry: 'Technology',
            size: '100-500'
          },
          preferences: {
            language: 'en',
            timezone: 'America/Los_Angeles',
            communicationChannels: ['email', 'sms'],
            interests: ['technology', 'travel', 'fitness']
          }
        },
        consent: {
          marketing: true,
          analytics: true,
          thirdParty: false
        },
        status: 'active',
        score: 85,
        lifetimeValue: 2500.00,
        tags: ['premium', 'early-adopter', 'tech-savvy'],
        source: 'website-signup'
      },
      {
        id: 'prof_002',
        createdAt: new Date('2024-02-20').toISOString(),
        updatedAt: new Date('2024-06-08').toISOString(),
        lastActivityAt: new Date('2024-06-08').toISOString(),
        identityId: 'iden_002',
        attributes: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.j@example.com',
          phone: '+1-555-0102',
          dateOfBirth: '1990-07-15',
          gender: 'female',
          location: {
            city: 'New York',
            state: 'NY',
            country: 'US',
            postalCode: '10001'
          },
          preferences: {
            language: 'en',
            timezone: 'America/New_York',
            interests: ['fashion', 'food', 'travel']
          }
        },
        consent: {
          marketing: true,
          analytics: true,
          thirdParty: true
        },
        status: 'active',
        score: 72,
        lifetimeValue: 1500.00,
        tags: ['fashion-enthusiast'],
        source: 'mobile-app'
      }
    ];

    sampleProfiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
      if (profile.attributes.email) {
        this.emailIndex.set(profile.attributes.email.toLowerCase(), profile.id);
      }
      if (profile.attributes.phone) {
        this.phoneIndex.set(profile.attributes.phone, profile.id);
      }
    });

    this.logger.info('Profile manager initialized with sample data', { count: sampleProfiles.length });
  }

  /**
   * Create a new customer profile
   */
  async createProfile(data: {
    attributes?: ProfileAttributes;
    identityId?: string;
    source?: string;
    tags?: string[];
  }): Promise<Profile> {
    const id = `prof_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const profile: Profile = {
      id,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      identityId: data.identityId || `iden_${uuidv4().slice(0, 8)}`,
      attributes: {
        ...data.attributes
      },
      consent: {
        marketing: false,
        analytics: true,
        thirdParty: false
      },
      status: 'active',
      tags: data.tags || [],
      source: data.source || 'api'
    };

    this.profiles.set(id, profile);

    // Update indexes
    if (profile.attributes.email) {
      this.emailIndex.set(profile.attributes.email.toLowerCase(), id);
    }
    if (profile.attributes.phone) {
      this.phoneIndex.set(profile.attributes.phone, id);
    }

    this.logger.info('Profile created', { id, identityId: profile.identityId });
    return profile;
  }

  /**
   * Get a profile by ID
   */
  async getProfile(id: string): Promise<Profile | null> {
    const profile = this.profiles.get(id);
    if (!profile || profile.status === 'deleted') {
      return null;
    }
    return profile;
  }

  /**
   * Get profile by email
   */
  async getProfileByEmail(email: string): Promise<Profile | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.getProfile(id);
  }

  /**
   * Get profile by phone
   */
  async getProfileByPhone(phone: string): Promise<Profile | null> {
    const id = this.phoneIndex.get(phone);
    if (!id) return null;
    return this.getProfile(id);
  }

  /**
   * Update a profile
   */
  async updateProfile(id: string, data: ProfileUpdateData): Promise<Profile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    const updatedProfile: Profile = {
      ...profile,
      updatedAt: new Date().toISOString(),
      attributes: {
        ...profile.attributes,
        ...data.attributes
      },
      consent: data.consent ? { ...profile.consent, ...data.consent } : profile.consent,
      status: data.status || profile.status,
      tags: data.tags || profile.tags
    };

    this.profiles.set(id, updatedProfile);

    // Update indexes if email or phone changed
    if (data.attributes?.email && data.attributes.email !== profile.attributes.email) {
      if (profile.attributes.email) {
        this.emailIndex.delete(profile.attributes.email.toLowerCase());
      }
      this.emailIndex.set(data.attributes.email.toLowerCase(), id);
    }
    if (data.attributes?.phone && data.attributes.phone !== profile.attributes.phone) {
      if (profile.attributes.phone) {
        this.phoneIndex.delete(profile.attributes.phone);
      }
      this.phoneIndex.set(data.attributes.phone, id);
    }

    this.logger.info('Profile updated', { id });
    return updatedProfile;
  }

  /**
   * Update specific attributes
   */
  async updateAttributes(id: string, attributes: Partial<ProfileAttributes>): Promise<Profile> {
    return this.updateProfile(id, { attributes });
  }

  /**
   * Delete a profile (soft delete)
   */
  async deleteProfile(id: string): Promise<void> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.status = 'deleted';
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(id, profile);

    // Remove from indexes
    if (profile.attributes.email) {
      this.emailIndex.delete(profile.attributes.email.toLowerCase());
    }
    if (profile.attributes.phone) {
      this.phoneIndex.delete(profile.attributes.phone);
    }

    this.logger.info('Profile deleted', { id });
  }

  /**
   * Search profiles by criteria
   */
  async searchProfiles(criteria: ProfileSearchCriteria): Promise<Profile[]> {
    let results = Array.from(this.profiles.values());

    // Filter by email
    if (criteria.email) {
      results = results.filter(
        p => p.attributes.email?.toLowerCase().includes(criteria.email!.toLowerCase())
      );
    }

    // Filter by phone
    if (criteria.phone) {
      results = results.filter(
        p => p.attributes.phone?.includes(criteria.phone!)
      );
    }

    // Filter by first name
    if (criteria.firstName) {
      results = results.filter(
        p => p.attributes.firstName?.toLowerCase().includes(criteria.firstName!.toLowerCase())
      );
    }

    // Filter by last name
    if (criteria.lastName) {
      results = results.filter(
        p => p.attributes.lastName?.toLowerCase().includes(criteria.lastName!.toLowerCase())
      );
    }

    // Filter by status
    if (criteria.status) {
      results = results.filter(p => p.status === criteria.status);
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(p =>
        criteria.tags!.some(tag => p.tags.includes(tag))
      );
    }

    // Filter by creation date
    if (criteria.createdAfter) {
      results = results.filter(p => p.createdAt >= criteria.createdAfter!);
    }
    if (criteria.createdBefore) {
      results = results.filter(p => p.createdAt <= criteria.createdBefore!);
    }

    return results;
  }

  /**
   * Get all profiles (with optional pagination)
   */
  async getAllProfiles(options?: {
    limit?: number;
    offset?: number;
    status?: Profile['status'];
  }): Promise<{ profiles: Profile[]; total: number }> {
    let results = Array.from(this.profiles.values());

    if (options?.status) {
      results = results.filter(p => p.status === options.status);
    }

    const total = results.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    return {
      profiles: results.slice(offset, offset + limit),
      total
    };
  }

  /**
   * Merge two profiles (used by unification service)
   */
  async mergeProfiles(sourceId: string, targetId: string): Promise<Profile> {
    const source = this.profiles.get(sourceId);
    const target = this.profiles.get(targetId);

    if (!source || !target) {
      throw new Error('Source or target profile not found');
    }

    const mergedAttributes = this.mergeAttributes(source.attributes, target.attributes);

    const mergedProfile: Profile = {
      ...target,
      attributes: mergedAttributes,
      updatedAt: new Date().toISOString(),
      tags: [...new Set([...target.tags, ...source.tags])],
      score: Math.max(target.score || 0, source.score || 0),
      lifetimeValue: (target.lifetimeValue || 0) + (source.lifetimeValue || 0)
    };

    this.profiles.set(targetId, mergedProfile);

    // Mark source as merged
    source.status = 'merged';
    source.updatedAt = new Date().toISOString();
    this.profiles.set(sourceId, source);

    // Update indexes
    if (source.attributes.email && source.attributes.email !== target.attributes.email) {
      this.emailIndex.delete(source.attributes.email.toLowerCase());
    }
    if (source.attributes.phone && source.attributes.phone !== target.attributes.phone) {
      this.phoneIndex.delete(source.attributes.phone);
    }

    this.logger.info('Profiles merged', { sourceId, targetId });
    return mergedProfile;
  }

  /**
   * Merge attributes with conflict resolution
   * Prefers non-null, non-empty values from target (existing profile)
   */
  private mergeAttributes(source: ProfileAttributes, target: ProfileAttributes): ProfileAttributes {
    const merged: ProfileAttributes = {};

    for (const key of Object.keys(target)) {
      if (key === 'location' || key === 'company' || key === 'preferences') {
        merged[key] = { ...source[key], ...target[key] };
      } else {
        merged[key] = (target[key] ?? source[key]) as string;
      }
    }

    return merged;
  }

  /**
   * Update profile score
   */
  async updateScore(id: string, score: number): Promise<Profile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.score = score;
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(id, profile);

    return profile;
  }

  /**
   * Add tags to a profile
   */
  async addTags(id: string, tags: string[]): Promise<Profile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.tags = [...new Set([...profile.tags, ...tags])];
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(id, profile);

    return profile;
  }

  /**
   * Remove tags from a profile
   */
  async removeTags(id: string, tags: string[]): Promise<Profile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.tags = profile.tags.filter(t => !tags.includes(t));
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(id, profile);

    return profile;
  }

  /**
   * Update last activity timestamp
   */
  async recordActivity(id: string): Promise<void> {
    const profile = this.profiles.get(id);
    if (profile) {
      profile.lastActivityAt = new Date().toISOString();
      this.profiles.set(id, profile);
    }
  }

  /**
   * Get profiles by identity ID
   */
  async getProfilesByIdentityId(identityId: string): Promise<Profile[]> {
    return Array.from(this.profiles.values()).filter(
      p => p.identityId === identityId && p.status !== 'deleted'
    );
  }

  /**
   * Get profiles by tag
   */
  async getProfilesByTag(tag: string): Promise<Profile[]> {
    return Array.from(this.profiles.values()).filter(
      p => p.tags.includes(tag) && p.status !== 'deleted'
    );
  }

  /**
   * Get profile statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    bySource: Record<string, number>;
    byTag: Record<string, number>;
    averageScore: number;
  }> {
    const profiles = Array.from(this.profiles.values()).filter(p => p.status !== 'deleted');

    const bySource: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    let totalScore = 0;

    for (const profile of profiles) {
      bySource[profile.source] = (bySource[profile.source] || 0) + 1;
      totalScore += profile.score || 0;

      for (const tag of profile.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      total: profiles.length,
      active: profiles.filter(p => p.status === 'active').length,
      inactive: profiles.filter(p => p.status === 'inactive').length,
      bySource,
      byTag,
      averageScore: profiles.length > 0 ? totalScore / profiles.length : 0
    };
  }
}
