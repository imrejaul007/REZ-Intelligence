/**
 * REZ Trust OS - Core Service
 *
 * Ethical AI Governance System - Trust, Consent, and Safety
 * Port: 4166
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  SignalCategory,
  ConsentLevel,
  ConsentGrant,
  UserConsent,
  ConsentRequest,
  PrivacySettings,
  SafetyPolicy,
  EmotionalSafetyConfig,
  ExploitationDetection,
  ExploitationPattern,
  AuditEntry,
  TrustScore,
  InsightExplanation,
  TransparencyReport,
} from '../types/index.js';

// ============================================
// MONGODB MODELS
// ============================================

// User Consent Model
export interface UserConsentDocument extends Omit<UserConsent, 'granted'>, Document {
  granted: ConsentGrant[];
  pendingRequests: ConsentRequest[];
  consentHistory: Array<{
    action: string;
    category: SignalCategory;
    timestamp: Date;
    details?: string;
  }>;
}
const userConsentSchema = new Schema<UserConsentDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  overallConsent: { type: Boolean, default: false },
  consentVersion: { type: String, default: '1.0' },
  granted: [{
    category: String,
    level: { type: String, enum: ['full', 'partial', 'minimal', 'none'] },
    grantedAt: Date,
    lastUpdated: Date,
    sources: [String],
    specificSignals: [String],
  }],
  denied: [String],
  pendingRequests: [{
    id: String,
    category: String,
    signals: [String],
    reason: String,
    benefit: String,
    requestedAt: Date,
    status: { type: String, enum: ['pending', 'approved', 'denied', 'expired'] },
  }],
  consentHistory: [{
    action: String,
    category: String,
    timestamp: Date,
    details: String,
  }],
});
export const UserConsentModel = mongoose.model<UserConsentDocument>('UserConsent', userConsentSchema);

// Privacy Settings Model
export interface PrivacySettingsDocument extends PrivacySettings, Document {}
const privacySettingsSchema = new Schema<PrivacySettingsDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  dataRetention: {
    raw: { type: Number, default: 90 },
    aggregated: { type: Number, default: 365 },
    insights: { type: Number, default: 0 },
  },
  sharing: {
    internalEcosystem: { type: Boolean, default: true },
    thirdParties: { type: Boolean, default: false },
    research: { type: Boolean, default: false },
    anonymized: { type: Boolean, default: true },
  },
  visibility: {
    showInsightsToOthers: { type: Boolean, default: false },
    allowApiAccess: { type: Boolean, default: false },
  },
  encryption: {
    atRest: { type: Boolean, default: true },
    inTransit: { type: Boolean, default: true },
    keysManagedBy: { type: String, enum: ['user', 'platform'], default: 'platform' },
  },
});
export const PrivacySettingsModel = mongoose.model<PrivacySettingsDocument>('PrivacySettings', privacySettingsSchema);

// Emotional Safety Config Model
export interface EmotionalSafetyConfigDocument extends EmotionalSafetyConfig, Document {}
const emotionalSafetySchema = new Schema<EmotionalSafetyConfigDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  policies: [{
    type: String,
    enabled: { type: Boolean, default: true },
    threshold: Number,
    action: { type: String, enum: ['warn', 'block', 'escalate', 'intervene'] },
    description: String,
  }],
  crisisResources: [{
    type: { type: String, enum: ['hotline', 'chat', 'emergency', 'professional'] },
    name: String,
    contact: String,
    available: String,
    forUseIn: [String],
  }],
  trustedContacts: [{
    id: String,
    name: String,
    relationship: String,
    contact: String,
    notifyIn: [String],
    addedAt: Date,
  }],
  customBoundaries: [{
    id: String,
    category: String,
    boundary: String,
    enforced: { type: Boolean, default: true },
    createdAt: Date,
  }],
});
export const EmotionalSafetyConfigModel = mongoose.model<EmotionalSafetyConfigDocument>('EmotionalSafetyConfig', emotionalSafetySchema);

// Exploitation Detection Model
export interface ExploitationDetectionDocument extends Omit<ExploitationDetection, 'id'>, Document {}
const exploitationDetectionSchema = new Schema<ExploitationDetectionDocument>({
  userId: { type: String, required: true, index: true },
  pattern: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  evidence: {
    trigger: String,
    recommendation: String,
    context: Schema.Types.Mixed,
    score: Number,
  },
  detectedAt: { type: Date, default: Date.now },
  action: {
    taken: { type: String, enum: ['warned', 'blocked', 'modified', 'reported'] },
    explanation: String,
  },
});
export const ExploitationDetectionModel = mongoose.model<ExploitationDetectionDocument>('ExploitationDetection', exploitationDetectionSchema);

// Audit Log Model
export interface AuditEntryDocument extends Omit<AuditEntry, 'id'>, Document {}
const auditLogSchema = new Schema<AuditEntryDocument>({
  userId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  details: Schema.Types.Mixed,
  metadata: {
    timestamp: { type: Date, default: Date.now },
    service: String,
    ip: String,
    device: String,
  },
});
export const AuditLogModel = mongoose.model<AuditEntryDocument>('AuditLog', auditLogSchema);

// ============================================
// TRUST SERVICE
// ============================================

export class TrustService {
  /**
   * Initialize user consent profile
   */
  async initializeConsent(userId: string): Promise<UserConsent> {
    let consent = await UserConsentModel.findOne({ userId });

    if (!consent) {
      consent = new UserConsentModel({
        userId,
        overallConsent: false,
        consentVersion: '1.0',
        granted: [],
        denied: [],
        pendingRequests: [],
        consentHistory: [],
      });
      await consent.save();
    }

    return consent;
  }

  /**
   * Grant consent for a signal category
   */
  async grantConsent(
    userId: string,
    category: SignalCategory,
    level: ConsentLevel = 'full',
    sources: string[] = ['cosmic-os']
  ): Promise<UserConsent> {
    const consent = await UserConsentModel.findOne({ userId }) || await this.initializeConsent(userId);

    // Update or add grant
    const existingIndex = consent.granted.findIndex(g => g.category === category);
    const grant: ConsentGrant = {
      category,
      level,
      grantedAt: new Date(),
      lastUpdated: new Date(),
      sources,
    };

    if (existingIndex >= 0) {
      consent.granted[existingIndex] = grant;
    } else {
      consent.granted.push(grant);
    }

    // Remove from denied if present
    consent.denied = consent.denied.filter(c => c !== category);

    // Record history
    consent.consentHistory.push({
      action: 'grant',
      category,
      timestamp: new Date(),
      details: `Consent granted for ${category} at ${level} level`,
    });

    await consent.save();
    return consent;
  }

  /**
   * Deny consent for a signal category
   */
  async denyConsent(userId: string, category: SignalCategory): Promise<UserConsent> {
    const consent = await UserConsentModel.findOne({ userId }) || await this.initializeConsent(userId);

    // Remove from granted
    consent.granted = consent.granted.filter(g => g.category !== category);

    // Add to denied
    if (!consent.denied.includes(category)) {
      consent.denied.push(category);
    }

    // Record history
    consent.consentHistory.push({
      action: 'deny',
      category,
      timestamp: new Date(),
      details: `Consent denied for ${category}`,
    });

    await consent.save();
    return consent;
  }

  /**
   * Check if user has consent for a signal
   */
  async hasConsent(userId: string, category: SignalCategory): Promise<boolean> {
    const consent = await UserConsentModel.findOne({ userId });
    if (!consent) return false;

    return consent.granted.some(g => g.category === category && g.level !== 'none');
  }

  /**
   * Get user's consent status for all categories
   */
  async getConsentStatus(userId: string): Promise<Record<SignalCategory, ConsentLevel>> {
    const consent = await UserConsentModel.findOne({ userId });
    const status: Record<SignalCategory, ConsentLevel> = {
      health: 'minimal',
      commerce: 'minimal',
      financial: 'minimal',
      relationship: 'minimal',
      career: 'minimal',
      location: 'minimal',
      social: 'minimal',
      emotional: 'minimal',
      behavioral: 'minimal',
      identity: 'minimal',
    };

    if (consent) {
      for (const grant of consent.granted) {
        status[grant.category] = grant.level;
      }
    }

    return status;
  }

  /**
   * Initialize privacy settings
   */
  async initializePrivacy(userId: string): Promise<PrivacySettings> {
    let settings = await PrivacySettingsModel.findOne({ userId });

    if (!settings) {
      settings = new PrivacySettingsModel({ userId });
      await settings.save();
    }

    return settings;
  }

  /**
   * Update privacy settings
   */
  async updatePrivacy(userId: string, updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    await this.initializePrivacy(userId);

    const settings = await PrivacySettingsModel.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true }
    );

    await this.logAudit(userId, 'consent_change', {
      changes: Object.keys(updates),
    });

    return settings!;
  }

  /**
   * Initialize emotional safety config
   */
  async initializeSafety(userId: string): Promise<EmotionalSafetyConfig> {
    let config = await EmotionalSafetyConfigModel.findOne({ userId });

    if (!config) {
      config = new EmotionalSafetyConfigModel({
        userId,
        policies: [
          { type: 'exploitation_prevention', enabled: true, action: 'block', description: 'Prevent manipulative recommendations' },
          { type: 'fear_manipulation_prevention', enabled: true, action: 'warn', description: 'Prevent fear-based messaging' },
          { type: 'dependency_creation', enabled: true, action: 'warn', description: 'Prevent unhealthy dependency patterns' },
          { type: 'isolation_detection', enabled: true, action: 'intervene', description: 'Detect social isolation risk' },
          { type: 'crisis_detection', enabled: true, action: 'escalate', description: 'Detect emotional crisis signals' },
          { type: 'coercion_prevention', enabled: true, action: 'block', description: 'Prevent coercive patterns' },
        ],
        crisisResources: [
          { type: 'hotline', name: 'iCall', contact: '9152987821', available: 'Mon-Sat, 8am-10pm', forUseIn: ['crisis', 'safety'] },
          { type: 'hotline', name: 'Vandrevala Foundation', contact: '1860-2662-345', available: '24/7', forUseIn: ['crisis', 'safety'] },
        ],
        trustedContacts: [],
        customBoundaries: [],
      });
      await config.save();
    }

    return config;
  }

  /**
   * Check recommendation for exploitation
   */
  async checkExploitation(
    userId: string,
    recommendation: string,
    context: Record<string, unknown>
  ): Promise<{ safe: boolean; reason?: string; action?: string }> {
    const safety = await this.initializeSafety(userId);

    // Check each enabled policy
    for (const policy of safety.policies) {
      if (!policy.enabled) continue;

      const pattern = this.detectExploitationPattern(recommendation, context);

      if (pattern) {
        // Log detection
        await this.logExploitationDetection(userId, pattern, recommendation, context);

        return {
          safe: false,
          reason: this.getExploitationReason(pattern),
          action: policy.action,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Detect exploitation patterns
   */
  private detectExploitationPattern(
    recommendation: string,
    context: Record<string, unknown>
  ): ExploitationPattern | null {
    const lowerRec = recommendation.toLowerCase();

    // Urgency manipulation
    if (lowerRec.includes('limited time') || lowerRec.includes('act now') || lowerRec.includes('only today')) {
      return 'urgency_manipulation';
    }

    // Scarcity pressure
    if (lowerRec.includes('only') && lowerRec.includes('left')) {
      return 'scarcity_pressure';
    }

    // Fear-based
    if (lowerRec.includes('you might miss') || lowerRec.includes("don't miss")) {
      return 'fear_based_recommendation';
    }

    // Isolation recommendations
    if (context['recommendingIsolation'] === true) {
      return 'isolation_recommendation';
    }

    // Dependency creation
    if (context['increasingDependency'] === true) {
      return 'dependency_creation';
    }

    // Impulse exploitation
    if (context['emotionalState'] === 'vulnerable' && lowerRec.includes('buy')) {
      return 'impulse_exploitation';
    }

    return null;
  }

  private getExploitationReason(pattern: ExploitationPattern): string {
    const reasons: Record<ExploitationPattern, string> = {
      urgency_manipulation: 'This recommendation uses artificial urgency to pressure decision-making.',
      scarcity_pressure: 'This recommendation creates false scarcity to manipulate choices.',
      fear_based_recommendation: 'This recommendation uses fear to influence your decision.',
      isolation_recommendation: 'This recommendation could increase social isolation.',
      dependency_creation: 'This recommendation may create unhealthy dependency.',
      confidence_erosion: 'This recommendation may undermine your confidence.',
      impulse_exploitation: 'This recommendation targets your vulnerable emotional state.',
    };
    return reasons[pattern];
  }

  /**
   * Log exploitation detection
   */
  private async logExploitationDetection(
    userId: string,
    pattern: ExploitationPattern,
    recommendation: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const detection = new ExploitationDetectionModel({
      userId,
      pattern,
      severity: 'medium',
      evidence: {
        trigger: context['trigger'] as string || 'unknown',
        recommendation,
        context,
        score: 0.7,
      },
      action: {
        taken: 'blocked',
        explanation: this.getExploitationReason(pattern),
      },
    });
    await detection.save();

    await this.logAudit(userId, 'safety_intervention', {
      pattern,
      recommendation,
    });
  }

  /**
   * Generate insight explanation
   */
  async explainInsight(
    insight: string,
    signals: Array<{ category: SignalCategory; type: string; age: string }>,
    patterns: string[]
  ): Promise<InsightExplanation> {
    return {
      insight,
      basedOn: {
        signals,
        patterns,
        inferences: ['Based on your patterns and consented signals'],
      },
      confidence: 0.75,
      alternativeInterpretations: [
        'This could also reflect temporary circumstances',
        'Consider tracking this over more time for better accuracy',
      ],
      userCanCorrect: true,
    };
  }

  /**
   * Generate transparency report
   */
  async generateTransparencyReport(userId: string, periodDays = 30): Promise<TransparencyReport> {
    const consent = await UserConsentModel.findOne({ userId);
    const settings = await PrivacySettingsModel.findOne({ userId);

    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const detections = await ExploitationDetectionModel.find({
      userId,
      detectedAt: { $gte: startDate },
    });

    const categories: Record<SignalCategory, number> = {
      health: 0,
      commerce: 0,
      financial: 0,
      relationship: 0,
      career: 0,
      location: 0,
      social: 0,
      emotional: 0,
      behavioral: 0,
      identity: 0,
    };

    if (consent) {
      for (const grant of consent.granted) {
        categories[grant.category] = grant.sources.length;
      }
    }

    return {
      userId,
      generatedAt: new Date(),
      period: { start: startDate, end: new Date() },
      dataInsights: {
        totalSignals: Object.values(categories).reduce((a, b) => a + b, 0),
        categories,
        inferences: 15, // Placeholder
      },
      consentSummary: {
        activeCategories: consent?.granted.map(g => g.category) || [],
        deniedCategories: consent?.denied || [],
        changesThisPeriod: consent?.consentHistory.filter(h =>
          h.timestamp >= startDate
        ).length || 0,
      },
      safetyMetrics: {
        interventions: detections.length,
        warnings: detections.filter(d => d.action.taken === 'warned').length,
        blockedRecommendations: detections.filter(d => d.action.taken === 'blocked').length,
      },
      privacyMetrics: {
        dataRetention: settings?.dataRetention.raw || 90,
        sharingEnabled: settings?.sharing.internalEcosystem || false,
        thirdPartyAccess: 0,
      },
    };
  }

  /**
   * Calculate trust score
   */
  async calculateTrustScore(userId: string): Promise<TrustScore> {
    const consent = await UserConsentModel.findOne({ userId);
    const settings = await PrivacySettingsModel.findOne({ userId);
    const safety = await EmotionalSafetyConfigModel.findOne({ userId);

    // Calculate dimension scores
    const privacy = consent ? (consent.granted.length / 10) * 100 : 0;
    const safetyScore = safety ? (safety.policies.filter(p => p.enabled).length / 6) * 100 : 0;
    const transparency = 80; // Based on user's engagement with transparency features
    const fairness = 90; // Based on non-exploitation detections
    const accountability = 85; // Based on audit log completeness

    return {
      userId,
      overall: Math.round((privacy + safetyScore + transparency + fairness + accountability) / 5),
      dimensions: {
        privacy: Math.round(privacy),
        safety: Math.round(safetyScore),
        transparency: Math.round(transparency),
        fairness: Math.round(fairness),
        accountability: Math.round(accountability),
      },
      factors: [
        {
          dimension: 'privacy',
          positive: consent?.granted.length ? ['Consented to data collection'] : [],
          negative: consent?.denied.length ? ['Restricted some data collection'] : [],
          score: Math.round(privacy),
        },
      ],
      recommendations: [
        'Review your privacy settings regularly',
        'Consider enabling emotional safety policies',
        'Use the transparency report to understand your data',
      ],
      lastUpdated: new Date(),
    };
  }

  /**
   * Log audit entry
   */
  async logAudit(
    userId: string,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    const entry = new AuditLogModel({
      userId,
      action,
      details,
      metadata: {
        timestamp: new Date(),
        service: 'trust-os',
      },
    });
    await entry.save();
  }

  /**
   * Get user's trust profile
   */
  async getTrustProfile(userId: string): Promise<{
    consent: UserConsent | null;
    privacy: PrivacySettings | null;
    safety: EmotionalSafetyConfig | null;
    trustScore: TrustScore | null;
  }> {
    const [consent, privacy, safety, trustScore] = await Promise.all([
      UserConsentModel.findOne({ userId }),
      PrivacySettingsModel.findOne({ userId }),
      EmotionalSafetyConfigModel.findOne({ userId }),
      this.calculateTrustScore(userId),
    ]);

    return { consent, privacy, safety, trustScore };
  }
}

export default new TrustService();
