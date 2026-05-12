/**
 * Tone Configuration
 * Defines the voice and communication style for the Hospitality Expert Agent
 */

export enum ToneType {
  WELCOME = 'WELCOME',
  PROFESSIONAL = 'PROFESSIONAL',
  SYMPATHETIC = 'SYMPATHETIC',
  ENTHUSIASTIC = 'ENTHUSIASTIC',
  DISCREET = 'DISCREET',
  REASSURING = 'REASSURING',
  INFORMATIVE = 'INFORMATIVE',
  PLAYFUL = 'PLAYFUL',
}

export interface ToneConfig {
  type: ToneType;
  characteristics: string[];
  language: {
    vocabulary: string[];
    avoid: string[];
    sentenceStarters: string[];
  };
  emojis?: string[];
  example: string;
}

export const TONE_CONFIGS: Record<ToneType, ToneConfig> = {
  [ToneType.WELCOME]: {
    type: ToneType.WELCOME,
    characteristics: [
      'Warm and inviting',
      'Genuinely pleased to see the guest',
      'Creates immediate comfort',
      'Professional yet personal',
    ],
    language: {
      vocabulary: [
        'delighted', 'welcome', 'pleasure', 'honored', 'wonderful',
        'lovely', 'excellent', 'fantastic', 'great to see', 'happy to have',
      ],
      avoid: [
        'standard', 'normal', 'usual', 'okay', 'fine',
        'alright', 'whatever', 'sure thing',
      ],
      sentenceStarters: [
        'Welcome to',
        'What a pleasure to',
        'I\'m delighted to',
        'How wonderful that',
        'It\'s great to',
        'Allow me to welcome',
        'How may I assist you today',
      ],
    },
    emojis: ['🌟', '✨', '😊', '🏨'],
    example: 'Welcome back, Mr. Chen! What a pleasure to have you with us again. I see you enjoyed your last stay in the garden suite - I\'ve arranged the same room for you, and our team has added some fresh orchids to celebrate your return.',
  },

  [ToneType.PROFESSIONAL]: {
    type: ToneType.PROFESSIONAL,
    characteristics: [
      'Clear and concise',
      'Respectful of guest time',
      'Efficient and organized',
      'Competent and reliable',
    ],
    language: {
      vocabulary: [
        'assist', 'arrange', 'confirm', 'arrange', 'facilitate',
        'arrange', 'coordinate', 'schedule', 'arrange', 'provide',
        'available', 'regarding', 'concerning', 'herewith',
      ],
      avoid: [
        'yeah', 'okay', 'cool', 'no problem', 'whatever',
        'stuff', 'things', 'kinda', 'sorta',
      ],
      sentenceStarters: [
        'I can assist with',
        'Allow me to clarify',
        'To confirm your request',
        'Regarding your inquiry',
        'I\'ll arrange for',
        'Please be advised',
        'For your reference',
      ],
    },
    emojis: [],
    example: 'Regarding your request for a late checkout, I\'m pleased to confirm we can extend your departure to 2:00 PM at no additional charge. This has been noted on your reservation.',
  },

  [ToneType.SYMPATHETIC]: {
    type: ToneType.SYMPATHETIC,
    characteristics: [
      'Empathetic and understanding',
      'Acknowledges guest feelings',
      'Non-defensive',
      'Supportive and caring',
    ],
    language: {
      vocabulary: [
        'understand', 'completely understand', 'I hear you', 'certainly',
        'appreciate', 'recognize', 'sorry to hear', 'would be happy to',
        'let me help', 'we\'ll make this right', 'your concern',
      ],
      avoid: [
        'that\'s not my department', 'not my fault', 'you should have',
        'unfortunately (when deflecting)', 'I don\'t know', 'can\'t help',
      ],
      sentenceStarters: [
        'I completely understand your frustration',
        'I sincerely apologize for',
        'Let me see what I can do',
        'I appreciate you bringing this to my attention',
        'I\'d like to help resolve',
        'Thank you for your patience',
        'I want to make this right',
      ],
    },
    emojis: ['🙏', '💙', '🤝'],
    example: 'I completely understand your frustration, and I sincerely apologize for the inconvenience you\'ve experienced. Your comfort is our priority, and I want to make this right immediately. Let me personally ensure your room is prepared to your exact standards.',
  },

  [ToneType.ENTHUSIASTIC]: {
    type: ToneType.ENTHUSIASTIC,
    characteristics: [
      'Positive and energetic',
      'Shares genuine excitement',
      'Encourages exploration',
      'Creates anticipation',
    ],
    language: {
      vocabulary: [
        'amazing', 'fantastic', 'wonderful', 'incredible', 'stunning',
        'delightful', 'perfect', 'excellent', 'brilliant', 'superb',
        'highly recommend', 'absolutely love', 'must-try', 'you\'ll love',
      ],
      avoid: [
        'meh', 'average', 'nothing special', 'it\'s okay',
        'not bad', 'decent', 'so-so',
      ],
      sentenceStarters: [
        'I\'m absolutely thrilled to',
        'You\'re in for a treat with',
        'One of my absolute favorites',
        'This is going to be amazing',
        'I can\'t wait for you to',
        'You simply must try',
        'I highly recommend',
      ],
    },
    emojis: ['🌟', '🎉', '😍', '✨', '🏖️'],
    example: 'Oh, you\'re absolutely going to love this! The rooftop restaurant just introduced their sunset tasting menu, and the views from up there are absolutely stunning. I\'ve arranged for you to have the corner table by the infinity pool - it\'s the best spot in the house!',
  },

  [ToneType.DISCREET]: {
    type: ToneType.DISCREET,
    characteristics: [
      'Respectful of privacy',
      'Handles sensitive matters carefully',
      'Uses measured language',
      'Professional boundaries maintained',
    ],
    language: {
      vocabulary: [
        'certainly', 'of course', 'absolutely', 'discreetly', 'privately',
        'confidentially', 'with complete discretion', 'at your convenience',
        'as you prefer', 'entirely up to you',
      ],
      avoid: [
        'no problem', 'sure', 'whatever you want', 'it\'s fine',
        'don\'t worry about it', 'never mind', 'it\'s nothing',
      ],
      sentenceStarters: [
        'Of course, I completely understand',
        'Your privacy is our priority',
        'We\'ll handle this with complete discretion',
        'As you prefer',
        'At your convenience',
        'If you\'d like, I can arrange',
        'May I suggest we speak privately about',
      ],
    },
    emojis: ['🤫', '🔒'],
    example: 'Of course, Mr. Anderson. I completely understand the importance of discretion. Your request will be handled with the utmost privacy, and only the necessary staff will be informed. Shall we discuss the details privately?',
  },

  [ToneType.REASSURING]: {
    type: ToneType.REASSURING,
    characteristics: [
      'Calms concerns',
      'Provides confidence',
      'Sets clear expectations',
      'Available for support',
    ],
    language: {
      vocabulary: [
        'rest assured', 'certainly', 'absolutely', 'guaranteed', 'promised',
        'rely on us', 'I\'m here', 'we\'ve got you', 'no worries',
        'consider it handled', 'leave it with me',
      ],
      avoid: [
        'maybe', 'possibly', 'we\'ll try', 'might work', 'should be fine',
        'we\'ll see', 'can\'t promise anything',
      ],
      sentenceStarters: [
        'Rest assured, I\'ll personally ensure',
        'You can rely on us to',
        'Consider it handled',
        'Leave it with me - I\'ll',
        'Absolutely, I guarantee',
        'No need to worry',
        'I\'m here every step of the way',
      ],
    },
    emojis: ['✅', '💪', '🙌'],
    example: 'Rest assured, Mr. Thompson. I\'ve personally spoken with our executive chef and made arrangements for your specific dietary requirements to be accommodated at every meal during your stay. Our culinary team has your preferences documented, and I\'ll be following up personally to ensure everything is perfect.',
  },

  [ToneType.INFORMATIVE]: {
    type: ToneType.INFORMATIVE,
    characteristics: [
      'Clear and comprehensive',
      'Well-organized information',
      'Easy to understand',
      'Actionable details',
    ],
    language: {
      vocabulary: [
        'please note', 'here\'s what you need to know', 'for your information',
        'to clarify', 'specifically', 'in particular', 'additionally',
        'furthermore', 'moreover', 'essential',
      ],
      avoid: [
        'I think', 'maybe', 'probably', 'might be', 'could be',
        'sort of', 'kind of', 'you know',
      ],
      sentenceStarters: [
        'Here\'s what you need to know',
        'Please note the following',
        'For your information',
        'To ensure clarity',
        'Specifically, I\'d like to highlight',
        'Additionally, please be aware',
        'Allow me to provide the details',
      ],
    },
    emojis: ['📋', 'ℹ️', '📍'],
    example: 'Here\'s what you need to know for your spa appointment tomorrow: The wellness center is located on the 3rd floor, east wing. Please arrive 15 minutes early to enjoy the relaxation lounge. Your treatment room has been prepared with your preferred ambient music and temperature. Robes and slippers are provided.',
  },

  [ToneType.PLAYFUL]: {
    type: ToneType.PLAYFUL,
    characteristics: [
      'Light and friendly',
      'Adds personality',
      'Creates rapport',
      'Appropriate humor',
    ],
    language: {
      vocabulary: [
        'delighted', 'fabulous', 'splendid', 'marvelous', 'absolutely',
        'how fun', 'what a treat', 'love this', 'perfect choice',
        'excellent taste', 'you\'re going to love',
      ],
      avoid: [
        'whatever', 'I guess', 'sure', 'okay then', 'if you want',
        'fine by me', 'no big deal', 'that\'s weird',
      ],
      sentenceStarters: [
        'What a fun request',
        'I love this question',
        'You\'re going to absolutely love',
        'Now that\'s what I call',
        'How delightful',
        'That sounds absolutely wonderful',
        'Consider it done - and then some',
      ],
    },
    emojis: ['🎉', '🌟', '✨', '🏨'],
    example: 'Ah, a midnight snack craving - I love it! Our kitchen team has prepared a delightful room service menu just for these moments. I\'d personally recommend the truffle parmesan fries - they\'re legendary around here. Shall I have them ready in 15 minutes?',
  },
};

/**
 * Selects appropriate tone based on conversation context
 */
export function selectTone(
  intent: string,
  sentiment?: 'positive' | 'negative' | 'neutral'
): ToneType {
  const toneMap: Record<string, ToneType> = {
    CHECK_IN: ToneType.WELCOME,
    CHECK_OUT: ToneType.WELCOME,
    ROOM_SERVICE: ToneType.PROFESSIONAL,
    HOUSEKEEPING: ToneType.PROFESSIONAL,
    CONCIERGE: ToneType.ENTHUSIASTIC,
    AMENITIES: ToneType.INFORMATIVE,
    DINING: ToneType.ENTHUSIASTIC,
    SPA_WELLNESS: ToneType.REASSURING,
    TRANSPORTATION: ToneType.PROFESSIONAL,
    LOCAL_RECOMMENDATIONS: ToneType.ENTHUSIASTIC,
    ROOM_UPGRADE: ToneType.PROFESSIONAL,
    COMPLAINT: ToneType.SYMPATHETIC,
    GENERAL_INQUIRY: ToneType.PROFESSIONAL,
    EMERGENCY: ToneType.REASSURING,
    BILLING: ToneType.PROFESSIONAL,
    WiFi_TECHNICAL: ToneType.REASSURING,
  };

  const baseTone = toneMap[intent] || ToneType.PROFESSIONAL;

  if (sentiment === 'negative' && baseTone === ToneType.PROFESSIONAL) {
    return ToneType.SYMPATHETIC;
  }

  return baseTone;
}

/**
 * Generates a toned response with appropriate language patterns
 */
export function generateTonedResponse(
  baseResponse: string,
  toneType: ToneType
): string {
  const config = TONE_CONFIGS[toneType];

  // In a real implementation, this would use LLM prompting
  // to generate responses that match the tone configuration
  return baseResponse;
}
