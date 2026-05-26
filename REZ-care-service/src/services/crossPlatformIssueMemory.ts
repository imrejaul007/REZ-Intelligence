/**
 * REZ Care Service - Cross-Platform Issue Memory
 *
 * Tracks issues across ALL platforms (hotels, restaurants, retail, etc.)
 * and learns from customer history to prevent repeated issues.
 *
 * Key Features:
 * - Unified issue tracking across all business types
 * - Customer issue history across platforms
 * - Partner issue patterns
 * - Predictive issue prevention
 */

import mongoose, { Schema } from 'mongoose';
import { logger } from '../utils/logger.js';
import { generateIssueId } from '../utils/idGenerator';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';

// Cross-Platform Issue Schema
const CrossPlatformIssueSchema = new mongoose.Schema({
  issueId: { type: String, required: true, unique: true, index: true },

  // Customer who faced the issue
  customerId: { type: String, required: true, index: true },
  customerPhone: String,
  customerEmail: String,

  // Issue Details
  issue: {
    category: {
      type: String,
      enum: [
        'food_quality', 'service_issue', 'hygiene', 'billing',
        'delivery', 'booking', 'room_issue', 'staff_behavior',
        'technical', 'payment', 'qr_scan', 'app_issue', 'other'
      ],
      required: true,
      index: true
    },
    subCategory: String,
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
  },

  // Platform/Business Type
  platform: {
    type: {
      type: String,
      enum: ['hotel', 'restaurant', 'retail', 'delivery', 'ecommerce', 'cafeteria', 'qsr', 'fnb', 'other'],
      required: true,
      index: true
    },
    businessType: String,
    brandName: String
  },

  // Partner (merchant/hotel/restaurant)
  partner: {
    partnerId: { type: String, required: true, index: true },
    partnerName: String,
    partnerType: { type: String, enum: ['merchant', 'hotel', 'restaurant', 'retail', 'brand'] },
    location: String,
    city: String
  },

  // Related Entities
  orderId: String,
  bookingId: String,
  transactionId: String,

  // Resolution
  resolution: {
    status: { type: String, enum: ['pending', 'investigating', 'resolved', 'escalated'], default: 'pending' },
    resolvedBy: String,
    resolvedAt: Date,
    resolutionType: { type: String, enum: ['refund', 'replacement', 'compensation', 'correction', 'apology', 'other'] },
    resolutionAmount: Number,
    agentNotes: String
  },

  // Ticket Link
  ticketId: String,

  // Customer Issue History (cross-platform)
  customerHistory: {
    totalIssues: { type: Number, default: 0 },
    issuesByPlatform: { type: Map, of: Number, default: {} },
    issuesByCategory: { type: Map, of: Number, default: {} },
    avgSentiment: Number,
    riskScore: Number
  },

  // Partner Issue History
  partnerHistory: {
    totalIssues: { type: Number, default: 0 },
    avgResolutionTime: Number,
    repeatIssues: { type: Number, default: 0 },
    issueCategories: { type: Map, of: Number, default: {} }
  },

  // Pattern Detection
  patterns: {
    isRepeatIssue: { type: Boolean, default: false },
    repeatIssueId: String,
    similarIssues: [String],
    issueSignature: String, // Hash of issue characteristics
    platformWideIssue: { type: Boolean, default: false },
    affectedCustomers: [String]
  },

  // Learning
  learning: {
    kbArticleId: String,
    rootCause: String,
    preventionSteps: [String],
    relatedIssues: [String],
    autoResolved: { type: Boolean, default: false }
  },

  // Timestamps
  occurredAt: { type: Date, required: true },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: Date

}, { timestamps: true });

// Indexes for fast queries
CrossPlatformIssueSchema.index({ customerId: 1, occurredAt: -1 });
CrossPlatformIssueSchema.index({ 'partner.partnerId': 1, occurredAt: -1 });
CrossPlatformIssueSchema.index({ 'platform.type': 1, 'issue.category': 1 });
CrossPlatformIssueSchema.index({ 'patterns.platformWideIssue': 1, 'patterns.issueSignature': 1 });
CrossPlatformIssueSchema.index({ 'resolution.status': 1, occurredAt: -1 });

const CrossPlatformIssue = mongoose.model('CrossPlatformIssue', CrossPlatformIssueSchema);

// Issue Signature Helper - Creates a hash for pattern detection
function createIssueSignature(issue: {
  category: string;
  platform: string;
  partnerType?: string;
  keywords?: string[];
}): string {
  const parts = [
    issue.category,
    issue.platform,
    issue.partnerType || 'unknown',
    ...(issue.keywords || []).slice(0, 3).sort()
  ];
  return parts.join('|');
}

// Customer Issue Profile Schema
const CustomerIssueProfileSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },

  // Issue Statistics
  stats: {
    totalIssues: { type: Number, default: 0 },
    byPlatform: { type: Map, of: Number, default: {} },
    byCategory: { type: Map, of: Number, default: {} },
    byPartner: { type: Map, of: Number, default: {} }
  },

  // Sentiment
  sentiment: {
    avgScore: { type: Number, default: 0 },
    trend: { type: String, enum: ['improving', 'stable', 'declining'], default: 'stable' },
    lastScore: Number,
    lastScoreAt: Date
  },

  // Risk
  risk: {
    score: { type: Number, default: 0 },
    factors: [String],
    atRiskSince: Date
  },

  // Issue Preferences
  preferences: {
    refundThreshold: Number,
    prefersCompensation: Boolean,
    communicationStyle: { type: String, enum: ['formal', 'casual', 'hinglish'] }
  },

  // Learned Patterns
  learned: {
    sensitiveTo: [String], // Categories they're sensitive to
    avoidPartners: [String], // Partners they had issues with
    preferredResolutions: [String],
    lastIssueDate: Date,
    issueFrequency: String // daily, weekly, monthly, rarely
  },

  // Cross-platform awareness
  crossPlatform: {
    hasHotelIssues: { type: Boolean, default: false },
    hasRestaurantIssues: { type: Boolean, default: false },
    hasRetailIssues: { type: Boolean, default: false },
    platformWithMostIssues: String,
    issuePatterns: [{
      platform: String,
      category: String,
      frequency: Number,
      lastOccurred: Date
    }]
  }

}, { timestamps: true });

const CustomerIssueProfile = mongoose.model('CustomerIssueProfile', CustomerIssueProfileSchema);

// Partner Issue Profile Schema
const PartnerIssueProfileSchema = new mongoose.Schema({
  partnerId: { type: String, required: true, unique: true, index: true },
  partnerName: String,
  partnerType: { type: String, enum: ['merchant', 'hotel', 'restaurant', 'retail', 'brand'] },
  platform: String,

  // Issue Statistics
  stats: {
    totalIssues: { type: Number, default: 0 },
    openIssues: { type: Number, default: 0 },
    avgResolutionTime: { type: Number, default: 0 }, // hours
    repeatCustomerIssues: { type: Number, default: 0 }
  },

  // Categories
  categories: {
    foodQuality: { count: Number, avgResolutionTime: Number },
    service: { count: Number, avgResolutionTime: Number },
    hygiene: { count: Number, avgResolutionTime: Number },
    billing: { count: Number, avgResolutionTime: Number },
    technical: { count: Number, avgResolutionTime: Number },
    other: { count: Number, avgResolutionTime: Number }
  },

  // Customer Impact
  customers: {
    uniqueAffected: { type: Number, default: 0 },
    repeatIssues: { type: Number, default: 0 },
    churnRiskCustomers: [String]
  },

  // Patterns
  patterns: {
    peakIssueHours: [Number],
    issueDays: [String],
    commonIssues: [String],
    recentTrends: String
  },

  // Performance
  performance: {
    score: { type: Number, default: 100 }, // 0-100
    grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'] },
    trend: { type: String, enum: ['improving', 'stable', 'declining'] }
  },

  // Escalations
  escalations: {
    total: { type: Number, default: 0 },
    recent: { type: Number, default: 0 },
    reasons: [String]
  }

}, { timestamps: true });

PartnerIssueProfileSchema.index({ 'performance.score': 1 });
PartnerIssueProfileSchema.index({ 'stats.openIssues': -1 });

const PartnerIssueProfile = mongoose.model('PartnerIssueProfile', PartnerIssueProfileSchema);

export class CrossPlatformIssueMemory {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Cross-Platform Issue Memory connected to MongoDB');
    }
  }

  /**
   * Record a new issue across platforms
   */
  async recordIssue(params: {
    customerId: string;
    customerPhone?: string;
    customerEmail?: string;
    platform: 'hotel' | 'restaurant' | 'retail' | 'delivery' | 'ecommerce' | 'cafeteria' | 'qsr' | 'fnb';
    partnerId: string;
    partnerName: string;
    partnerType: 'merchant' | 'hotel' | 'restaurant' | 'retail';
    category: string;
    subCategory?: string;
    description: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    orderId?: string;
    bookingId?: string;
    ticketId?: string;
    occurredAt?: Date;
  }): Promise<{
    issue;
    isRepeatIssue: boolean;
    similarIssues: unknown[];
    customerRiskLevel: string;
    partnerWarning: boolean;
    suggestions: string[];
  }> {
    await this.connect();

    const issueId = generateIssueId();
    const now = new Date();

    // Check for repeat issues
    const similarIssues = await this.findSimilarIssues(params);
    const isRepeatIssue = similarIssues.length > 0;

    // Check customer risk
    const customerRisk = await this.assessCustomerRisk(params.customerId);

    // Check partner warnings
    const partnerWarning = await this.checkPartnerWarnings(params.partnerId);

    // Create issue record
    const issue = new CrossPlatformIssue({
      issueId,
      customerId: params.customerId,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      issue: {
        category: params.category,
        subCategory: params.subCategory,
        description: params.description,
        severity: params.severity || 'medium'
      },
      platform: {
        type: params.platform,
        businessType: params.partnerType,
        brandName: params.partnerName
      },
      partner: {
        partnerId: params.partnerId,
        partnerName: params.partnerName,
        partnerType: params.partnerType
      },
      orderId: params.orderId,
      bookingId: params.bookingId,
      ticketId: params.ticketId,
      occurredAt: params.occurredAt || now,
      patterns: {
        isRepeatIssue,
        repeatIssueId: isRepeatIssue ? (similarIssues[0] as { issueId?: string })?.issueId : undefined,
        similarIssues: similarIssues.map((i: unknown) => (i as { issueId?: string }).issueId),
        issueSignature: createIssueSignature({
          category: params.category,
          platform: params.platform,
          keywords: this.extractKeywords(params.description)
        })
      }
    });

    await issue.save();

    // Update customer profile
    await this.updateCustomerProfile(params.customerId, params);

    // Update partner profile
    await this.updatePartnerProfile(params.partnerId, params);

    // Generate suggestions
    const suggestions = this.generateSuggestions(params, similarIssues, customerRisk);

    logger.info('Issue recorded', {
      issueId,
      customerId: params.customerId,
      platform: params.platform,
      partnerId: params.partnerId,
      isRepeatIssue
    });

    return {
      issue,
      isRepeatIssue,
      similarIssues,
      customerRiskLevel: customerRisk.level,
      partnerWarning,
      suggestions
    };
  }

  /**
   * Find similar issues for a customer or across platform
   */
  async findSimilarIssues(params: {
    customerId?: string;
    partnerId?: string;
    platform?: string;
    category?: string;
    description?: string;
    limit?: number;
  }): Promise<unknown[]> {
    await this.connect();

    const query: Record<string, unknown> = {};

    if (params.customerId) {
      query.customerId = params.customerId;
    }

    if (params.partnerId) {
      query['partner.partnerId'] = params.partnerId;
    }

    if (params.platform) {
      query['platform.type'] = params.platform;
    }

    if (params.category) {
      query['issue.category'] = params.category;
    }

    // Time window: last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    query.occurredAt = { $gte: ninetyDaysAgo };

    const issues = await CrossPlatformIssue.find(query as Record<string, unknown>)
      .sort({ occurredAt: -1 })
      .limit(params.limit || 10);

    return issues;
  }

  /**
   * Get complete customer issue history across all platforms
   */
  async getCustomerIssueHistory(customerId: string): Promise<{
    totalIssues: number;
    byPlatform: Record<string, number>;
    byCategory: Record<string, number>;
    recentIssues: unknown[];
    riskLevel: string;
    riskFactors: string[];
    crossPlatformPatterns: {
      platform: string;
      issueCount: number;
      lastIssue: Date;
    }[];
    recommendations: string[];
  }> {
    await this.connect();

    const profile = await CustomerIssueProfile.findOne({ customerId });
    const issues = await CrossPlatformIssue.find({ customerId })
      .sort({ occurredAt: -1 })
      .limit(100);

    // Aggregate by platform
    const byPlatform: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const platformPatterns: Record<string, { count: number; lastIssue: Date }> = {};

    for (const issue of issues) {
      const platform = issue.platform?.type || 'unknown';
      const category = issue.issue?.category || 'unknown';

      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      byCategory[category] = (byCategory[category] || 0) + 1;

      if (!platformPatterns[platform] || new Date(issue.occurredAt) > platformPatterns[platform].lastIssue) {
        platformPatterns[platform] = {
          count: (platformPatterns[platform]?.count || 0) + 1,
          lastIssue: new Date(issue.occurredAt)
        };
      }
    }

    // Calculate risk
    const riskFactors: string[] = [];
    let riskLevel = 'low';

    if (issues.length >= 10) riskFactors.push('Multiple issues across platforms');
    if (profile?.risk?.score && profile.risk.score > 70) {
      riskFactors.push('High risk score');
      riskLevel = 'high';
    }
    if (byPlatform['hotel'] > 3 && byPlatform['restaurant'] > 3) {
      riskFactors.push('Issues across hospitality and F&B');
      riskLevel = 'medium';
    }

    // Generate recommendations
    const recommendations = this.generateCustomerRecommendations(byPlatform, byCategory, issues);

    return {
      totalIssues: issues.length,
      byPlatform,
      byCategory,
      recentIssues: issues.slice(0, 10),
      riskLevel,
      riskFactors,
      crossPlatformPatterns: Object.entries(platformPatterns).map(([platform, data]) => ({
        platform,
        issueCount: data.count,
        lastIssue: data.lastIssue
      })),
      recommendations
    };
  }

  /**
   * Get partner issue profile
   */
  async getPartnerIssueProfile(partnerId: string): Promise<{
    totalIssues: number;
    openIssues: number;
    avgResolutionTime: number;
    categories: Record<string, { count: number; trend: string }>;
    recentIssues: unknown[];
    riskLevel: string;
    performanceGrade: string;
    recommendations: string[];
  }> {
    await this.connect();

    const profile = await PartnerIssueProfile.findOne({ partnerId });
    const issues = await CrossPlatformIssue.find({ 'partner.partnerId': partnerId })
      .sort({ occurredAt: -1 })
      .limit(50);

    // Aggregate by category
    const categories: Record<string, { count: number; trend: string }> = {};
    for (const issue of issues) {
      const cat = issue.issue?.category || 'unknown';
      if (!categories[cat]) categories[cat] = { count: 0, trend: 'stable' };
      categories[cat].count++;
    }

    // Calculate risk and grade
    let riskLevel = 'low';
    let performanceGrade = 'A';

    if (issues.length > 20) riskLevel = 'medium';
    if (issues.length > 50) {
      riskLevel = 'high';
      performanceGrade = 'C';
    }
    if (profile?.performance?.score && profile.performance.score < 50) {
      performanceGrade = 'D';
    }

    return {
      totalIssues: issues.length,
      openIssues: issues.filter(i => i.resolution?.status !== 'resolved').length,
      avgResolutionTime: profile?.stats?.avgResolutionTime || 0,
      categories,
      recentIssues: issues.slice(0, 10),
      riskLevel,
      performanceGrade,
      recommendations: this.generatePartnerRecommendations(categories, issues)
    };
  }

  /**
   * Detect platform-wide issues
   */
  async detectPlatformWideIssues(): Promise<{
    issues: unknown[];
    affectedCustomers: Map<string, number>;
    recommendations: string[];
  }> {
    await this.connect();

    // Find issues with same signature in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentIssues = await CrossPlatformIssue.aggregate([
      { $match: { occurredAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: '$patterns.issueSignature',
        count: { $sum: 1 },
        customers: { $addToSet: '$customerId' },
        partners: { $addToSet: '$partner.partnerId' },
        platform: { $first: '$platform.type' },
        category: { $first: '$issue.category' },
        description: { $first: '$issue.description' }
      }},
      { $match: { count: { $gt: 5 } } } // More than 5 similar issues
    ]);

    return {
      issues: recentIssues,
      affectedCustomers: new Map(recentIssues.map(i => [i._id, i.customers.length])),
      recommendations: recentIssues.map(i =>
        `${i.count} issues reported for ${i.category} on ${i.platform}. ` +
        `Consider investigating if it's a system-wide issue.`
      )
    };
  }

  /**
   * Predict issues for a customer based on history
   */
  async predictCustomerIssues(customerId: string): Promise<{
    riskLevel: string;
    predictedIssues: {
      platform: string;
      category: string;
      probability: number;
      preventionTip: string;
    }[];
  }> {
    await this.connect();

    const profile = await CustomerIssueProfile.findOne({ customerId });

    if (!profile) {
      return { riskLevel: 'low', predictedIssues: [] };
    }

    const predictions: {
      platform: string;
      category: string;
      probability: number;
      preventionTip: string;
    }[] = [];

    // Generate predictions based on patterns
    if (profile.crossPlatform?.hasHotelIssues) {
      predictions.push({
        platform: 'hotel',
        category: 'booking',
        probability: 0.7,
        preventionTip: 'Verify booking details 24 hours before check-in'
      });
    }

    if (profile.learned?.sensitiveTo?.includes('food_quality')) {
      predictions.push({
        platform: 'restaurant',
        category: 'food_quality',
        probability: 0.8,
        preventionTip: 'Check recent reviews before ordering'
      });
    }

    if (profile.learned?.avoidPartners && profile.learned.avoidPartners.length > 0) {
      predictions.push({
        platform: 'unknown',
        category: 'service_issue',
        probability: 0.6,
        preventionTip: 'Issue history with similar partners - verify partner rating'
      });
    }

    return {
      riskLevel: profile.risk?.score && profile.risk.score > 70 ? 'high' :
                 profile.risk?.score && profile.risk.score > 40 ? 'medium' : 'low',
      predictedIssues: predictions
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async assessCustomerRisk(customerId: string): Promise<{
    level: string;
    score: number;
    factors: string[];
  }> {
    const profile = await CustomerIssueProfile.findOne({ customerId });

    if (!profile) {
      return { level: 'low', score: 0, factors: [] };
    }

    const factors: string[] = [];
    let score = profile.risk?.score || 0;

    if (profile.stats && profile.stats.totalIssues > 10) factors.push('High issue volume');
    if (profile.sentiment?.trend === 'declining') factors.push('Declining satisfaction');
    if (profile.crossPlatform?.hasHotelIssues && profile.crossPlatform?.hasRestaurantIssues) {
      factors.push('Issues across multiple platforms');
    }

    const level = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';

    return { level, score, factors };
  }

  private async checkPartnerWarnings(partnerId: string): Promise<boolean> {
    const profile = await PartnerIssueProfile.findOne({ partnerId });

    if (!profile) return false;

    // Warning if more than 5 open issues
    if (profile.stats && profile.stats.openIssues > 5) return true;

    // Warning if performance grade is D or F
    if (profile.performance?.grade === 'D' || profile.performance?.grade === 'F') return true;

    // Warning if recent escalations
    if (profile.escalations && profile.escalations.recent && profile.escalations.recent > 3) return true;

    return false;
  }

  private extractKeywords(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 4).slice(0, 5);
  }

  private async updateCustomerProfile(customerId: string, issue: Record<string, unknown>): Promise<void> {
    await CustomerIssueProfile.findOneAndUpdate(
      { customerId },
      {
        $inc: {
          'stats.totalIssues': 1,
          [`stats.byPlatform.${issue.platform}`]: 1,
          [`stats.byCategory.${issue.category}`]: 1
        },
        $set: {
          'crossPlatform.hasHotelIssues': issue.platform === 'hotel' ? true : undefined,
          'crossPlatform.hasRestaurantIssues': issue.platform === 'restaurant' ? true : undefined,
          'crossPlatform.hasRetailIssues': issue.platform === 'retail' ? true : undefined,
          'learned.lastIssueDate': new Date()
        }
      },
      { upsert: true, new: true }
    );
  }

  private async updatePartnerProfile(partnerId: string, issue: Record<string, unknown>): Promise<void> {
    await PartnerIssueProfile.findOneAndUpdate(
      { partnerId },
      {
        $inc: {
          'stats.totalIssues': 1,
          'stats.openIssues': (issue.resolution as { status?: string })?.status === 'pending' ? 1 : 0,
          [`categories.${issue.category}.count`]: 1
        },
        $set: {
          partnerName: issue.partnerName,
          partnerType: issue.partnerType,
          platform: issue.platform
        }
      },
      { upsert: true, new: true }
    );
  }

  private generateSuggestions(issue: Record<string, unknown>, similarIssues: unknown[], risk: { level: string }): string[] {
    const suggestions: string[] = [];

    if (similarIssues.length > 0) {
      suggestions.push('Customer has faced similar issues before. Consider proactive compensation.');
    }

    if (risk.level === 'high') {
      suggestions.push('High-risk customer. Prioritize resolution and consider retention offer.');
    }

    if (issue.platform === 'hotel') {
      suggestions.push('Notify hotel management directly for faster resolution.');
    }

    if (issue.category === 'food_quality') {
      suggestions.push('Escalate to restaurant manager and food safety team.');
    }

    return suggestions;
  }

  private generateCustomerRecommendations(
    byPlatform: Record<string, number>,
    byCategory: Record<string, number>,
    issues: InstanceType<typeof CrossPlatformIssue>[]
  ): string[] {
    const recommendations: string[] = [];

    const platformWithMost = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0];
    if (platformWithMost && platformWithMost[1] > 3) {
      recommendations.push(
        `Most issues (${platformWithMost[1]}) in ${platformWithMost[0]}. Consider quality review.`
      );
    }

    const categoryWithMost = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    if (categoryWithMost && categoryWithMost[1] > 3) {
      recommendations.push(
        `Frequent ${categoryWithMost[0]} issues. May need systemic fix.`
      );
    }

    if (issues.length > 5) {
      recommendations.push('High issue frequency. Consider proactive outreach.');
    }

    return recommendations;
  }

  private generatePartnerRecommendations(categories: Record<string, unknown>, issues: InstanceType<typeof CrossPlatformIssue>[]): string[] {
    const recommendations: string[] = [];

    const openIssues = issues.filter(i => i.resolution?.status !== 'resolved');
    if (openIssues.length > 5) {
      recommendations.push(`${openIssues.length} open issues. Prioritize resolution.`);
    }

    const highSeverity = issues.filter(i => i.issue?.severity === 'critical' || i.issue?.severity === 'high');
    if (highSeverity.length > 0) {
      recommendations.push(`${highSeverity.length} critical/high severity issues need immediate attention.`);
    }

    return recommendations;
  }
}
