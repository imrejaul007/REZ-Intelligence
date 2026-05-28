import { randomUUID } from 'crypto';
import {
  Opportunity,
  OpportunityType,
  OpportunityStatus,
  ExpectedImpact,
  Recommendation,
  Channel,
} from '../types/index.js';
import { OpportunityModel, IOpportunityDocument } from '../models/Opportunity.js';
import { cacheGet, cacheSet, cacheDelete } from '../utils/redis.js';
import { CACHE_TTL, THRESHOLDS } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'OpportunityService' });

// Seeded random for deterministic mock data
function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

class OpportunityService {
  async create(opportunity: Omit<Opportunity, 'id' | 'createdAt'>): Promise<Opportunity> {
    const id = randomUUID();
    const createdAt = new Date();

    const newOpportunity: Opportunity = {
      id,
      ...opportunity,
      createdAt,
    };

    await OpportunityModel.create({
      ...newOpportunity,
      data: newOpportunity.data || {},
    });

    // Invalidate cache
    await cacheDelete('opportunities:*');

    log.info('Opportunity created', { id, type: opportunity.type, title: opportunity.title });
    return newOpportunity;
  }

  async findById(id: string): Promise<Opportunity | null> {
    const cacheKey = `opportunity:${id}`;
    const cached = await cacheGet<Opportunity>(cacheKey);
    if (cached) {
      return cached;
    }

    const doc = await OpportunityModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    const opportunity = this.documentToOpportunity(doc);
    await cacheSet(cacheKey, opportunity, CACHE_TTL.OPPORTUNITIES);

    return opportunity;
  }

  async findAll(options: {
    status?: OpportunityStatus;
    type?: OpportunityType;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ opportunities: Opportunity[]; total: number }> {
    const { status, type, limit = 20, offset = 0 } = options;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [docs, total] = await Promise.all([
      OpportunityModel.find(filter)
        .sort({ confidence: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      OpportunityModel.countDocuments(filter).exec(),
    ]);

    const opportunities = docs.map((doc) => this.documentToOpportunity(doc));
    return { opportunities, total };
  }

  async findActive(): Promise<Opportunity[]> {
    const docs = await OpportunityModel.findActiveOpportunities().exec();
    return docs.map((doc) => this.documentToOpportunity(doc));
  }

  async findHighImpact(): Promise<Opportunity[]> {
    const docs = await OpportunityModel.findHighImpactOpportunities().exec();
    return docs.map((doc) => this.documentToOpportunity(doc));
  }

  async updateStatus(id: string, status: OpportunityStatus): Promise<Opportunity | null> {
    const doc = await OpportunityModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    doc.status = status;
    doc.updatedAt = new Date();

    if (status === OpportunityStatus.EXECUTED) {
      doc.executedAt = new Date();
    } else if (status === OpportunityStatus.ARCHIVED) {
      doc.archivedAt = new Date();
    }

    await doc.save();

    // Invalidate cache
    await cacheDelete(`opportunity:${id}`);
    await cacheDelete('opportunities:*');

    log.info('Opportunity status updated', { id, status });
    return this.documentToOpportunity(doc);
  }

  async approve(id: string): Promise<Opportunity | null> {
    const doc = await OpportunityModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    doc.approve();
    await doc.save();

    await cacheDelete(`opportunity:${id}`);
    await cacheDelete('opportunities:*');

    log.info('Opportunity approved', { id });
    return this.documentToOpportunity(doc);
  }

  async archive(id: string): Promise<Opportunity | null> {
    const doc = await OpportunityModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    doc.archive();
    await doc.save();

    await cacheDelete(`opportunity:${id}`);
    await cacheDelete('opportunities:*');

    log.info('Opportunity archived', { id });
    return this.documentToOpportunity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await OpportunityModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) {
      return false;
    }

    await cacheDelete(`opportunity:${id}`);
    await cacheDelete('opportunities:*');

    log.info('Opportunity deleted', { id });
    return true;
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<OpportunityStatus, number>;
    byType: Record<OpportunityType, number>;
    byImpact: Record<ExpectedImpact, number>;
    avgConfidence: number;
  }> {
    const stats = await OpportunityModel.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          byImpact: [{ $group: { _id: '$expectedImpact', count: { $sum: 1 } } }],
          avgConfidence: [{ $group: { _id: null, avg: { $avg: '$confidence' } } }],
        },
      },
    ]);

    const result = stats[0];

    return {
      total: result.total[0]?.count || 0,
      byStatus: Object.fromEntries(
        result.byStatus.map((item: { _id: string; count: number }) => [item._id, item.count])
      ) as Record<OpportunityStatus, number>,
      byType: Object.fromEntries(
        result.byType.map((item: { _id: string; count: number }) => [item._id, item.count])
      ) as Record<OpportunityType, number>,
      byImpact: Object.fromEntries(
        result.byImpact.map((item: { _id: string; count: number }) => [item._id, item.count])
      ) as Record<ExpectedImpact, number>,
      avgConfidence: result.avgConfidence[0]?.avg || 0,
    };
  }

  private documentToOpportunity(doc: IOpportunityDocument): Opportunity {
    return {
      id: doc.id,
      type: doc.type,
      title: doc.title,
      description: doc.description,
      expectedImpact: doc.expectedImpact,
      confidence: doc.confidence,
      data: typeof doc.data === 'object' && doc.data !== null ? doc.data as Record<string, unknown> : {},
      recommendations: doc.recommendations,
      createdAt: doc.createdAt,
      status: doc.status,
      updatedAt: doc.updatedAt,
      executedAt: doc.executedAt,
      archivedAt: doc.archivedAt,
    };
  }

  // Helper to generate recommendations for opportunities
  generateRecommendations(
    opportunityType: OpportunityType,
    targetSegment: string
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    // Use deterministic seed based on opportunityType and targetSegment
    const seed = Number(opportunityType) * 1000 + targetSegment.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    switch (opportunityType) {
      case OpportunityType.CAMPAIGN:
        recommendations.push({
          action: `Launch targeted campaign for ${targetSegment}`,
          channel: Channel.WHATSAPP,
          targetSegment,
          timing: 'Within 1 week',
          estimatedReach: Math.floor(seededRandom(seed, 1) * 10000) + 5000,
          estimatedConversion: seededRandom(seed, 2) * 10 + 5,
        });
        recommendations.push({
          action: `Send follow-up email sequence`,
          channel: Channel.EMAIL,
          targetSegment,
          timing: 'Days 1, 3, 7',
          estimatedReach: Math.floor(seededRandom(seed, 3) * 15000) + 8000,
          estimatedConversion: seededRandom(seed, 4) * 5 + 2,
        });
        break;

      case OpportunityType.RETENTION:
        recommendations.push({
          action: `Deploy loyalty program`,
          channel: Channel.PUSH,
          targetSegment,
          timing: 'Immediately',
          estimatedReach: Math.floor(seededRandom(seed, 5) * 5000) + 2000,
          estimatedConversion: seededRandom(seed, 6) * 15 + 10,
        });
        recommendations.push({
          action: `Personalized re-engagement SMS`,
          channel: Channel.SMS,
          targetSegment,
          timing: 'Day 1 and Day 3',
          estimatedReach: Math.floor(seededRandom(seed, 7) * 3000) + 1000,
          estimatedConversion: seededRandom(seed, 8) * 8 + 3,
        });
        break;

      case OpportunityType.UPSELL:
        recommendations.push({
          action: `Premium upgrade offer`,
          channel: Channel.WHATSAPP,
          targetSegment,
          timing: 'After next purchase',
          estimatedReach: Math.floor(seededRandom(seed, 9) * 8000) + 3000,
          estimatedConversion: seededRandom(seed, 10) * 12 + 5,
        });
        break;

      case OpportunityType.SEGMENT:
        recommendations.push({
          action: `Segment-specific content campaign`,
          channel: Channel.EMAIL,
          targetSegment,
          timing: 'Weekly for 4 weeks',
          estimatedReach: Math.floor(seededRandom(seed, 11) * 10000) + 5000,
          estimatedConversion: seededRandom(seed, 12) * 6 + 2,
        });
        break;

      case OpportunityType.MARKET:
        recommendations.push({
          action: `New market expansion campaign`,
          channel: Channel.PUSH,
          targetSegment,
          timing: 'Phased rollout over 3 months',
          estimatedReach: Math.floor(seededRandom(seed, 13) * 20000) + 10000,
          estimatedConversion: seededRandom(seed, 14) * 4 + 2,
        });
        break;

      case OpportunityType.PRODUCT:
        recommendations.push({
          action: `Product launch announcement`,
          channel: Channel.WHATSAPP,
          targetSegment,
          timing: 'Launch day',
          estimatedReach: Math.floor(seededRandom(seed, 15) * 15000) + 8000,
          estimatedConversion: seededRandom(seed, 16) * 8 + 3,
        });
        recommendations.push({
          action: `Email product showcase`,
          channel: Channel.EMAIL,
          targetSegment,
          timing: 'Week 1 and Week 2',
          estimatedReach: Math.floor(seededRandom(seed, 17) * 20000) + 10000,
          estimatedConversion: seededRandom(seed, 18) * 5 + 2,
        });
        break;
    }

    return recommendations;
  }
}

export const opportunityService = new OpportunityService();
export default opportunityService;
