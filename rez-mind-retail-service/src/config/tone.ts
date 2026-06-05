/**
 * ReZ Mind Retail Service - Tone Configuration
 * Response tone settings for AI interactions
 */

export const TONE_CONFIG = {
  // Overall communication style
  communication: {
    formality: 'professional', // 'casual' | 'professional' | 'formal'
    friendliness: 'warm', // 'neutral' | 'warm' | 'enthusiastic'
    technicalLevel: 'accessible', // 'simple' | 'accessible' | 'technical' | 'expert'
    verbosity: 'concise', // 'brief' | 'concise' | 'detailed' | 'comprehensive'
  },

  // Tone variations by context
  contexts: {
    recommendation: {
      tone: 'enthusiastic',
      emphasis: 'benefits',
      style: 'suggestive',
      confidence: 'high',
    },
    pricing: {
      tone: 'analytical',
      emphasis: 'value',
      style: 'factual',
      confidence: 'measured',
    },
    inventory: {
      tone: 'factual',
      emphasis: 'urgency',
      style: 'direct',
      confidence: 'data_driven',
    },
    customer_segment: {
      tone: 'understanding',
      emphasis: 'insights',
      style: 'explanatory',
      confidence: 'nuanced',
    },
    alert: {
      tone: 'urgent',
      emphasis: 'action',
      style: 'direct',
      confidence: 'definitive',
    },
    consultation: {
      tone: 'advisory',
      emphasis: 'guidance',
      style: 'consultative',
      confidence: 'balanced',
    },
  },

  // Phrases and language patterns
  language: {
    // Opening phrases for recommendations
    recommendationIntros: [
      'Based on the analysis, I recommend',
      'For this customer, consider',
      'The data suggests',
      'Given the context, I\'d suggest',
    ],

    // Confidence indicators
    confidencePhrases: {
      high: ['definitely', 'strongly recommend', 'clear choice'],
      medium: ['consider', 'may want to', 'worth exploring'],
      low: ['could try', 'might consider', 'optional suggestion'],
    },

    // Action language
    actions: {
      urgent: ['immediately', 'asap', 'urgent attention'],
      recommended: ['recommend', 'suggest', 'propose'],
      optional: ['could', 'might', 'consider'],
    },

    // Reasoning connectors
    reasoningConnectors: [
      'because',
      'given that',
      'since',
      'as indicated by',
      'based on the data',
    ],
  },

  // Emotional intelligence settings
  emotionalIntelligence: {
    acknowledgeCustomer: true,
    showEmpathy: true,
    positiveFraming: true,
    avoidNegativeAbsolutes: true,
  },

  // Cultural considerations
  localization: {
    currency: 'USD',
    currencySymbol: '$',
    numberFormat: 'en-US',
    dateFormat: 'MM/DD/YYYY',
  },

  // Response templates
  templates: {
    recommendation: {
      opening: 'Based on the analysis of {{customerSegment}} customers and current inventory trends, ',
      body: '{{recommendation}} with a confidence score of {{confidence}}%.',
      closing: 'This aligns with {{seasonalContext}}.',
    },
    pricing: {
      opening: 'The optimal price point for this product is {{price}}. ',
      body: 'This {{strategy}} pricing strategy considers {{factors}}.',
      range: 'Price range: {{min}} - {{max}}',
    },
    alert: {
      critical: '⚠️ URGENT: {{message}} - Immediate action required.',
      warning: '⚡ NOTICE: {{message}} - Action recommended.',
      info: 'ℹ️ INFO: {{message}} - For your awareness.',
    },
    segmentation: {
      segment: 'Customer appears to be a {{segment}} type.',
      description: '{{description}}',
      recommendations: 'For this segment, focus on {{recommendations}}.',
    },
  },

  // Formatting rules
  formatting: {
    useMarkdown: true,
    includeEmojis: false,
    bulletStyle: 'dash',
    numberedLists: true,
    sectionHeaders: true,
  },

  // Constraints
  constraints: {
    maxRecommendationCount: 10,
    minConfidenceThreshold: 0.5,
    explanationLength: 'short',
    includeDataPoints: true,
  },
};

export type ToneConfig = typeof TONE_CONFIG;
export type ContextType = keyof typeof TONE_CONFIG.contexts;

/**
 * Get tone configuration for a specific context
 */
export function getToneForContext(context: ContextType) {
  return {
    ...TONE_CONFIG.communication,
    ...TONE_CONFIG.contexts[context],
    language: TONE_CONFIG.language,
    templates: TONE_CONFIG.templates[context] || TONE_CONFIG.templates.recommendation,
  };
}

/**
 * Format a recommendation with appropriate tone
 */
export function formatRecommendation(
  recommendation: string,
  confidence: number,
  context: ContextType = 'recommendation'
): string {
  const { tone, language } = getToneForContext(context);
  const intro = language.recommendationIntros[
    Math.floor(Math.random() * language.recommendationIntros.length)
  ];

  const confidencePhrase = confidence >= 0.8
    ? language.confidencePhrases.high
    : confidence >= 0.5
    ? language.confidencePhrases.medium
    : language.confidencePhrases.low;

  return `${intro} ${recommendation.toLowerCase()}. (${confidencePhrase[0]} - ${Math.round(confidence * 100)}% confidence)`;
}

/**
 * Format an alert with appropriate urgency
 */
export function formatAlert(message: string, urgency: 'critical' | 'warning' | 'info'): string {
  const template = TONE_CONFIG.templates.alert[urgency];
  return template.replace('{{message}}', message);
}

/**
 * Generate segment description
 */
export function formatSegmentDescription(
  segment: string,
  description: string,
  recommendations: string[]
): string {
  return `This customer appears to be a **${segment}**.

${description}

**Strategy**: ${recommendations.join(', ')}`;
}