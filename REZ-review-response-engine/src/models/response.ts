import { z } from 'zod';
import { SentimentType, EscalationPriority } from './review';

/**
 * Response Status
 */
export enum ResponseStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  POSTED = 'posted',
  FAILED = 'failed'
}

/**
 * Response Template Type
 */
export enum ResponseTemplate {
  GRATEFUL = 'grateful',           // Thank you for positive reviews
  APOLOGETIC = 'apologetic',       // Sorry for negative experience
  NEUTRAL = 'neutral',             // Neutral acknowledgment
  FOLLOW_UP = 'follow_up',         // Asking for more details
  DEFLECT = 'deflect',             // Move to private channel
  SPECIAL_OFFER = 'special_offer', // Offer compensation
  PUBLIC_RESOLUTION = 'public_resolution', // Publicly resolve issue
  ESCALATED = 'escalated'          // Mentioning escalation
}

/**
 * Brand Voice Types
 */
export enum BrandVoice {
  PROFESSIONAL = 'professional',   // Formal business tone
  FRIENDLY = 'friendly',           // Warm and approachable
  CASUAL = 'casual',               // Relaxed and informal
  LUXURY = 'luxury',              // Premium and elegant
  FUN = 'fun',                     // Playful and energetic
  EMPATHETIC = 'empathetic'        // Deeply understanding
}

/**
 * Response Generation Options
 */
export interface ResponseOptions {
  template?: ResponseTemplate;
  brandVoice?: BrandVoice;
  tone?: 'formal' | 'informal' | 'empathetic' | 'apologetic';
  length?: 'short' | 'medium' | 'long';
  includePromotion?: boolean;
  customGreeting?: string;
  customClosing?: string;
  language?: string;
  maxLength?: number;
}

/**
 * Response Template Configuration
 */
export interface TemplateConfig {
  type: ResponseTemplate;
  name: string;
  description: string;
 适用场景: string;
  sentimentTriggers: SentimentType[];
  minRating?: number;
  maxRating?: number;
  priority: number;
}

/**
 * AI Generation Metadata
 */
export interface GenerationMetadata {
  model: string;
  temperature: number;
  tokensUsed: number;
  generationTime: number; // in ms
  promptVersion: string;
  confidence: number;
}

/**
 * Approval Information
 */
export interface ApprovalInfo {
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  modifiedContent?: string;
  notes?: string;
}

/**
 * Posting Metadata
 */
export interface PostingMetadata {
  postedAt?: Date;
  postedBy?: string;
  platformResponseId?: string;
  postingMethod: 'manual' | 'auto' | 'api';
  error?: string;
}

/**
 * Response Variation (alternative generated responses)
 */
export interface ResponseVariation {
  id: string;
  content: string;
  template: ResponseTemplate;
  tone: string;
  score: number; // quality score from AI
  selected: boolean;
}

/**
 * Zod Schema for Response Generation Request
 */
export const ResponseGenerationRequestSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  options: z.object({
    template: z.nativeEnum(ResponseTemplate).optional(),
    brandVoice: z.nativeEnum(BrandVoice).optional(),
    tone: z.enum(['formal', 'informal', 'empathetic', 'apologetic']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    includePromotion: z.boolean().optional(),
    customGreeting: z.string().max(100).optional(),
    customClosing: z.string().max(100).optional(),
    language: z.string().max(10).optional(),
    maxLength: z.number().int().min(50).max(2000).optional()
  }).optional()
});

export type ResponseGenerationRequest = z.infer<typeof ResponseGenerationRequestSchema>;

/**
 * Zod Schema for Response Approval Request
 */
export const ResponseApprovalRequestSchema = z.object({
  approved: z.boolean(),
  modifiedContent: z.string().max(2000).optional(),
  notes: z.string().max(500).optional()
});

export type ResponseApprovalRequest = z.infer<typeof ResponseApprovalRequestSchema>;

/**
 * Review Response Entity (stored in database)
 */
export interface ReviewResponse {
  id: string;
  reviewId: string;
  merchantId: string;
  content: string;
  status: ResponseStatus;
  template: ResponseTemplate;
  brandVoice: BrandVoice;
  sentiment: SentimentType;
  options: ResponseOptions;
  variations: ResponseVariation[];
  selectedVariationId?: string;
  generationMetadata?: GenerationMetadata;
  approval?: ApprovalInfo;
  posting?: PostingMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Response Generation Result
 */
export interface ResponseGenerationResult {
  response: ReviewResponse;
  variations: ResponseVariation[];
  suggestedTemplate: ResponseTemplate;
  confidence: number;
  warnings?: string[];
}

/**
 * Response Analytics
 */
export interface ResponseAnalytics {
  totalResponses: number;
  byStatus: Record<ResponseStatus, number>;
  byTemplate: Record<ResponseTemplate, number>;
  averageGenerationTime: number;
  averageLength: number;
  autoPostRate: number;
  modificationRate: number;
}

/**
 * Brand Voice Configuration
 */
export interface BrandVoiceConfig {
  voice: BrandVoice;
  name: string;
  description: string;
  greetingPhrases: string[];
  closingPhrases: string[];
  styleModifiers: string[];
  emojiAllowed: boolean;
  maxEmoji: number;
  formalGreetings: string[];
  informalGreetings: string[];
}

/**
 * Default Brand Voice Configurations
 */
export const DEFAULT_BRAND_VOICES: Record<BrandVoice, BrandVoiceConfig> = {
  [BrandVoice.PROFESSIONAL]: {
    voice: BrandVoice.PROFESSIONAL,
    name: 'Professional',
    description: 'Formal and business-appropriate tone',
    greetingPhrases: ['Dear', 'Hello', 'Thank you for'],
    closingPhrases: ['Best regards', 'Sincerely', 'Kind regards'],
    styleModifiers: ['polished', 'concise', 'respectful'],
    emojiAllowed: false,
    maxEmoji: 0,
    formalGreetings: ['Dear Valued Customer', 'Dear Guest', 'Hello'],
    informalGreetings: ['Dear', 'Hello']
  },
  [BrandVoice.FRIENDLY]: {
    voice: BrandVoice.FRIENDLY,
    name: 'Friendly',
    description: 'Warm and approachable tone',
    greetingPhrases: ['Hi there', 'Hello', 'Hey'],
    closingPhrases: ['Thanks!', 'Cheers!', 'Warm regards'],
    styleModifiers: ['warm', 'approachable', 'genuine'],
    emojiAllowed: true,
    maxEmoji: 2,
    formalGreetings: ['Dear', 'Hello'],
    informalGreetings: ['Hi there', 'Hey', 'Hi']
  },
  [BrandVoice.CASUAL]: {
    voice: BrandVoice.CASUAL,
    name: 'Casual',
    description: 'Relaxed and informal tone',
    greetingPhrases: ['Hey', 'Hi', 'What\'s up'],
    closingPhrases: ['Thanks!', 'Take care!', 'Talk soon'],
    styleModifiers: ['relaxed', 'conversational', 'relaxed'],
    emojiAllowed: true,
    maxEmoji: 3,
    formalGreetings: ['Hello'],
    informalGreetings: ['Hey', 'Hi', 'Yo', 'What\'s up']
  },
  [BrandVoice.LUXURY]: {
    voice: BrandVoice.LUXURY,
    name: 'Luxury',
    description: 'Premium and elegant tone',
    greetingPhrases: ['Esteemed Guest', 'Dear Patron', 'Welcome'],
    closingPhrases: ['With Appreciation', 'Yours Truly', 'Most Sincerely'],
    styleModifiers: ['elegant', 'refined', 'sophisticated'],
    emojiAllowed: false,
    maxEmoji: 0,
    formalGreetings: ['Dear Esteemed Guest', 'Dear Valued Patron'],
    informalGreetings: ['Dear Guest']
  },
  [BrandVoice.FUN]: {
    voice: BrandVoice.FUN,
    name: 'Fun',
    description: 'Playful and energetic tone',
    greetingPhrases: ['Hey awesome person', 'What\'s cooking', 'Yo'],
    closingPhrases: ['Keep smiling!', 'You\'re the best!', 'Stay awesome!'],
    styleModifiers: ['playful', 'energetic', 'fun'],
    emojiAllowed: true,
    maxEmoji: 4,
    formalGreetings: ['Hello'],
    informalGreetings: ['Hey', 'Yo', 'What\'s up']
  },
  [BrandVoice.EMPATHETIC]: {
    voice: BrandVoice.EMPATHETIC,
    name: 'Empathetic',
    description: 'Deeply understanding and compassionate',
    greetingPhrases: ['I hear you', 'We understand', 'Thank you for sharing'],
    closingPhrases: ['We\'re here for you', 'Take care', 'With empathy'],
    styleModifiers: ['understanding', 'compassionate', 'caring'],
    emojiAllowed: true,
    maxEmoji: 1,
    formalGreetings: ['Dear Customer'],
    informalGreetings: ['I hear you', 'We understand']
  }
};

/**
 * Template Selection Criteria
 */
export interface TemplateSelectionCriteria {
  sentiment: SentimentType;
  rating: number;
  hasEscalation: boolean;
  isFirstResponse: boolean;
  hasMedia: boolean;
  reviewLength: number;
}

/**
 * Get recommended template based on criteria
 */
export function getRecommendedTemplate(criteria: TemplateSelectionCriteria): ResponseTemplate {
  if (criteria.hasEscalation) {
    return ResponseTemplate.ESCALATED;
  }

  if (criteria.sentiment === SentimentType.NEGATIVE && criteria.rating <= 2) {
    if (criteria.reviewLength > 200) {
      return ResponseTemplate.PUBLIC_RESOLUTION;
    }
    return ResponseTemplate.APOLOGETIC;
  }

  if (criteria.sentiment === SentimentType.NEGATIVE) {
    return ResponseTemplate.APOLOGETIC;
  }

  if (criteria.sentiment === SentimentType.MIXED) {
    return ResponseTemplate.FOLLOW_UP;
  }

  if (criteria.sentiment === SentimentType.POSITIVE && criteria.rating >= 4) {
    return ResponseTemplate.GRATEFUL;
  }

  return ResponseTemplate.NEUTRAL;
}

/**
 * Merchant Response Settings
 */
export interface MerchantResponseSettings {
  merchantId: string;
  defaultBrandVoice: BrandVoice;
  autoApproveThreshold: EscalationPriority; // Auto-approve below this priority
  autoPostEnabled: boolean;
  responseDelayHours: number; // Delay before posting auto-responses
  escalationWebhookUrl?: string;
  notificationEmail?: string;
  customTemplates?: ResponseTemplate[];
  blockedWords?: string[];
  enabledSources: string[];
  responseHours: {
    start: string; // HH:mm format
    end: string;
    timezone: string;
  };
}
