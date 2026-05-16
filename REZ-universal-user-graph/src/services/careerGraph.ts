/**
 * Career Graph Service
 * Manages career/education data for Universal User Graph
 */

import { Collection, Db } from 'mongodb';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import {
  CareerGraph,
  CareerProfile,
  CareerPreferences,
  Education,
  Experience,
  Skill,
  Certification,
  Internship,
  createDefaultCareerGraph,
  EducationLevel,
} from '../types/career.js';

const COLLECTION_NAME = 'career_graph';
const CACHE_TTL = 300; // 5 minutes

export class CareerGraphService {
  private db: Db | null = null;
  private redis: Redis | null = null;
  private cacheTtl: number;

  constructor() {
    this.cacheTtl = CACHE_TTL;
  }

  setDatabase(db: Db): void {
    this.db = db;
  }

  setRedis(redis: Redis): void {
    this.redis = redis;
  }

  private get collection(): Collection<CareerGraph> {
    if (!this.db) throw new Error('Database not connected');
    return this.db.collection<CareerGraph>(COLLECTION_NAME);
  }

  private getCacheKey(userId: string): string {
    return `career:${userId}`;
  }

  // ─── CRUD Operations ───────────────────────────────────────────────────────

  /**
   * Get career graph for a user
   */
  async getCareerGraph(userId: string): Promise<CareerGraph | null> {
    // Check cache
    if (this.redis) {
      const cached = await this.redis.get(this.getCacheKey(userId));
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Query database
    const career = await this.collection.findOne({ userId });

    if (career) {
      // Cache result
      if (this.redis) {
        await this.redis.setex(
          this.getCacheKey(userId),
          this.cacheTtl,
          JSON.stringify(career)
        );
      }
    }

    return career;
  }

  /**
   * Get or create career graph
   */
  async getOrCreateCareerGraph(userId: string): Promise<CareerGraph> {
    let career = await this.getCareerGraph(userId);

    if (!career) {
      const defaultData = createDefaultCareerGraph(userId);
      const derived = this.calculateDerived(defaultData);

      career = {
        ...defaultData,
        derived,
      } as CareerGraph;

      await this.collection.insertOne(career);
    }

    return career;
  }

  /**
   * Update career profile
   */
  async updateCareerProfile(
    userId: string,
    profile: Partial<CareerProfile>
  ): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const updatedProfile = {
      ...career.careerProfile,
      ...profile,
    };

    // Recalculate derived
    const derived = this.calculateDerived({
      ...career,
      careerProfile: updatedProfile,
    });

    const update = {
      $set: {
        careerProfile: updatedProfile,
        derived,
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    // Invalidate cache
    await this.invalidateCache(userId);

    return {
      ...career,
      careerProfile: updatedProfile,
      derived,
    };
  }

  /**
   * Update career preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<CareerPreferences>
  ): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const updatedPreferences = {
      ...career.preferences,
      ...preferences,
    };

    const update = {
      $set: {
        preferences: updatedPreferences,
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);
    await this.invalidateCache(userId);

    return {
      ...career,
      preferences: updatedPreferences,
    };
  }

  /**
   * Add education
   */
  async addEducation(userId: string, education: Education): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const educationWithId = {
      ...education,
      _id: uuidv4(),
    };

    const update = {
      $push: { 'careerProfile.education': educationWithId },
      $set: {
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    // Recalculate derived
    const updated = await this.getCareerGraph(userId);
    return updated!;
  }

  /**
   * Add experience
   */
  async addExperience(userId: string, experience: Experience): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const experienceWithId = {
      ...experience,
      _id: uuidv4(),
    };

    const update = {
      $push: { 'careerProfile.experience': experienceWithId },
      $set: {
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    const updated = await this.getCareerGraph(userId);
    return updated!;
  }

  /**
   * Add skill
   */
  async addSkill(userId: string, skill: Skill): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    // Check if skill already exists
    const existingSkill = career.careerProfile.skills.find(
      (s) => s.name.toLowerCase() === skill.name.toLowerCase()
    );

    if (existingSkill) {
      return career;
    }

    const update = {
      $push: { 'careerProfile.skills': skill },
      $set: {
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    const updated = await this.getCareerGraph(userId);
    return updated!;
  }

  /**
   * Add certification
   */
  async addCertification(
    userId: string,
    certification: Certification
  ): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const update = {
      $push: { 'careerProfile.certifications': certification },
      $set: {
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    const updated = await this.getCareerGraph(userId);
    return updated!;
  }

  /**
   * Add internship
   */
  async addInternship(userId: string, internship: Internship): Promise<CareerGraph> {
    const career = await this.getOrCreateCareerGraph(userId);

    const update = {
      $push: { 'careerProfile.internships': internship },
      $set: {
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.collection.updateOne({ userId }, update);

    const updated = await this.getCareerGraph(userId);
    return updated!;
  }

  // ─── Derived Calculations ─────────────────────────────────────────────────

  /**
   * Calculate derived scores
   */
  private calculateDerived(profile: any): CareerGraph['derived'] {
    const { careerProfile } = profile;

    // Total experience in years
    let totalExperience = 0;
    if (careerProfile.experience) {
      for (const exp of careerProfile.experience) {
        if (exp.startDate) {
          const start = new Date(exp.startDate);
          const end = exp.endDate ? new Date(exp.endDate) : new Date();
          const years = (end.getTime() - start.getTime()) / (365 * 24 * 60 * 60 * 1000);
          totalExperience += years;
        }
      }
    }

    // Skill score based on count and levels
    const skillLevels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const skillScore =
      careerProfile.skills && careerProfile.skills.length > 0
        ? Math.min(
            100,
            (careerProfile.skills.length * 5 +
              careerProfile.skills.reduce(
                (sum: number, s: any) => sum + (skillLevels[s.level] || 1),
                0
              ) *
                5)
          )
        : 0;

    // Education score
    let educationScore = 0;
    if (careerProfile.education && careerProfile.education.length > 0) {
      const maxLevel = Math.max(
        ...careerProfile.education.map((e: any) =>
          Object.values(EducationLevel).indexOf(e.level)
        )
      );
      educationScore = Math.min(100, (maxLevel + 1) * 20);
    }

    // Verification score
    const totalItems =
      (careerProfile.certifications?.length || 0) +
      (careerProfile.education?.length || 0) +
      (careerProfile.experience?.length || 0);
    const verifiedItems =
      (careerProfile.certifications?.filter((c: any) => c.verified).length || 0) +
      (careerProfile.education?.filter((e: any) => e.verified).length || 0) +
      (careerProfile.experience?.filter((e: any) => e.verified).length || 0);
    const verificationScore = totalItems > 0 ? (verifiedItems / totalItems) * 100 : 0;

    // Overall score (weighted average)
    const overallScore = Math.round(
      skillScore * 0.3 + educationScore * 0.3 + verificationScore * 0.4
    );

    // Top skills
    const topSkills = (careerProfile.skills || [])
      .sort((a: any, b: any) => (b.endorsements || 0) - (a.endorsements || 0))
      .slice(0, 10)
      .map((s: any) => s.name);

    // Top industries
    const topIndustries = [
      ...new Set(careerProfile.experience?.map((e: any) => e.industry) || []),
    ].slice(0, 5);

    return {
      totalExperience: Math.round(totalExperience * 10) / 10,
      skillScore: Math.round(skillScore),
      educationScore: Math.round(educationScore),
      verificationScore: Math.round(verificationScore),
      overallScore,
      topSkills,
      topIndustries,
    };
  }

  // ─── Search & Matching ─────────────────────────────────────────────────────

  /**
   * Search candidates by skills
   */
  async findBySkills(
    skills: string[],
    options?: { limit?: number; skip?: number; verifiedOnly?: boolean }
  ): Promise<{ userId: string; matchScore: number }[]> {
    const query: any = {
      'careerProfile.skills.name': { $in: skills.map((s) => new RegExp(s, 'i')) },
    };

    if (options?.verifiedOnly) {
      query['careerProfile.skills.verified'] = true;
    }

    const candidates = await this.collection
      .find(query)
      .project({ userId: 1, 'careerProfile.skills': 1, derived: 1 })
      .limit(options?.limit || 50)
      .skip(options?.skip || 0)
      .toArray();

    // Calculate match score
    return candidates.map((candidate) => {
      const matchingSkills = candidate.careerProfile.skills.filter((s: any) =>
        skills.some(
          (sk) => s.name.toLowerCase().includes(sk.toLowerCase())
        )
      ).length;

      const matchScore = (matchingSkills / skills.length) * 100;

      return {
        userId: candidate.userId,
        matchScore: Math.round(matchScore),
      };
    });
  }

  /**
   * Get candidates matching preferences
   */
  async findMatchingCandidates(
    preferences: CareerPreferences,
    options?: { limit?: number; skip?: number }
  ): Promise<CareerGraph[]> {
    const query: any = {};

    if (preferences.desiredRoles.length > 0) {
      query['careerProfile.experience.title'] = {
        $in: preferences.desiredRoles.map((r) => new RegExp(r, 'i')),
      };
    }

    if (preferences.workType.length > 0) {
      query['careerProfile.experience.type'] = { $in: preferences.workType };
    }

    if (preferences.remote !== undefined) {
      query['careerProfile.experience.remote'] = preferences.remote;
    }

    return this.collection
      .find(query)
      .sort({ 'derived.overallScore': -1 })
      .limit(options?.limit || 50)
      .skip(options?.skip || 0)
      .toArray();
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  /**
   * Get career analytics for a user
   */
  async getCareerAnalytics(userId: string): Promise<{
    totalExperience: number;
    skillCount: number;
    certificationCount: number;
    internshipCount: number;
    educationLevel: string;
    topSkills: string[];
    industryExperience: string[];
    careerProgress: 'early' | 'mid' | 'senior';
  }> {
    const career = await this.getCareerGraph(userId);

    if (!career) {
      return {
        totalExperience: 0,
        skillCount: 0,
        certificationCount: 0,
        internshipCount: 0,
        educationLevel: 'Not specified',
        topSkills: [],
        industryExperience: [],
        careerProgress: 'early',
      };
    }

    // Find highest education level
    const highestEducation = career.careerProfile.education?.length
      ? career.careerProfile.education.reduce((max: any, curr: any) => {
          const maxLevel = Object.values(EducationLevel).indexOf(max.level);
          const currLevel = Object.values(EducationLevel).indexOf(curr.level);
          return currLevel > maxLevel ? curr : max;
        })
      : null;

    // Determine career progress
    let careerProgress: 'early' | 'mid' | 'senior' = 'early';
    if (career.derived.totalExperience > 7) {
      careerProgress = 'senior';
    } else if (career.derived.totalExperience > 3) {
      careerProgress = 'mid';
    }

    return {
      totalExperience: career.derived.totalExperience,
      skillCount: career.careerProfile.skills?.length || 0,
      certificationCount: career.careerProfile.certifications?.length || 0,
      internshipCount: career.careerProfile.internships?.length || 0,
      educationLevel: highestEducation?.degree || 'Not specified',
      topSkills: career.derived.topSkills.slice(0, 5),
      industryExperience: career.derived.topIndustries,
      careerProgress,
    };
  }

  // ─── Cache Management ──────────────────────────────────────────────────────

  private async invalidateCache(userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(this.getCacheKey(userId));
    }
  }

  // ─── Index Creation ──────────────────────────────────────────────────────

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1 }, { unique: true });
    await this.collection.createIndex({ 'careerProfile.skills.name': 1 });
    await this.collection.createIndex({ 'careerProfile.experience.title': 1 });
    await this.collection.createIndex({ 'careerProfile.education.institution': 1 });
    await this.collection.createIndex({ derived.overallScore: -1 });

    logger.info('CareerGraph indexes created');
  }
}

export const careerGraphService = new CareerGraphService();
