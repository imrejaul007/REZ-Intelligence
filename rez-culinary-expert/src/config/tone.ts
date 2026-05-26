/**
 * Culinary Expert Tone Configuration
 * Defines the communication style and voice for the culinary agent
 */

import { randomInt } from 'crypto';

export interface ToneConfig {
  enthusiasm: 'high' | 'medium' | 'low';
  formality: 'formal' | 'semi-formal' | 'casual';
  verbosity: 'detailed' | 'moderate' | 'concise';
}

export const TONE_PRESETS = {
  // Default warm, enthusiastic tone
  default: {
    enthusiasm: 'high',
    formality: 'semi-formal',
    verbosity: 'moderate',
  },

  // Quick, to-the-point interactions
  quick: {
    enthusiasm: 'medium',
    formality: 'casual',
    verbosity: 'concise',
  },

  // Detailed deep-dive conversations
  detailed: {
    enthusiasm: 'high',
    formality: 'semi-formal',
    verbosity: 'detailed',
  },

  // High-end dining experience
  fineDining: {
    enthusiasm: 'medium',
    formality: 'formal',
    verbosity: 'detailed',
  },
} as const;

/**
 * Generates tone-specific language modifiers
 */
export function getToneModifiers(preset: keyof typeof TONE_PRESETS) {
  const config = TONE_PRESETS[preset];

  const enthusiasmModifiers = {
    high: {
      adjectives: ['amazing', 'delicious', 'incredible', 'fantastic', 'outstanding'],
      exclamations: ['Try this!', 'You will love it!', "It's a must!"],
      opener: "Oh, I've got something perfect for you!",
    },
    medium: {
      adjectives: ['good', 'nice', 'tasty', 'enjoyable', 'satisfying'],
      exclamations: ['Give it a try.', 'Worth considering.', 'Nice option.'],
      opener: 'Here are some options for you.',
    },
    low: {
      adjectives: ['acceptable', 'suitable', 'appropriate', 'fitting'],
      exclamations: [],
      opener: 'Available options:',
    },
  };

  const formalityModifiers = {
    formal: {
      prefix: 'May I suggest',
      suffix: 'I highly recommend',
      structure: 'structured' as const,
    },
    'semi-formal': {
      prefix: 'Let me suggest',
      suffix: 'You might enjoy',
      structure: 'balanced' as const,
    },
    casual: {
      prefix: "Check out",
      suffix: 'Super good choice',
      structure: 'relaxed' as const,
    },
  };

  const verbosityLevels = {
    detailed: 3, // Full sentences, explanations
    moderate: 2, // Mixed approach
    concise: 1, // Bullet-style, short sentences
  };

  return {
    ...config,
    modifiers: enthusiasmModifiers[config.enthusiasm],
    formality: formalityModifiers[config.formality],
    verbosityLevel: verbosityLevels[config.verbosity],
  };
}

/**
 * Applies tone to a culinary response
 */
export function applyTone(
  text: string,
  preset: keyof typeof TONE_PRESETS = 'default'
): string {
  const { modifiers, formality } = getToneModifiers(preset);

  let result = text;

  // Apply enthusiasm-based transformations
  if (preset === 'default' || preset === 'detailed') {
    result = `${modifiers.opener} ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
  }

  return result;
}

/**
 * Generates a recommendation opener based on tone
 */
export function generateOpener(
  context: 'recommendation' | 'explanation' | 'warning' | 'greeting',
  preset: keyof typeof TONE_PRESETS = 'default'
): string {
  const { modifiers, formality } = getToneModifiers(preset);

  const openers = {
    recommendation: {
      high: [
        "Oh, I've got something amazing for you!",
        "Let me share some incredible options!",
        "You're in for a treat with these choices!",
      ],
      medium: [
        'Here are some good options.',
        'Let me suggest a few dishes.',
        'I have some recommendations.',
      ],
      low: ['Options:', 'Recommendations:'],
    },
    explanation: {
      high: "Here's the delicious details:",
      medium: "Here's what I found:",
      low: 'Details:',
    },
    warning: {
      high: "I need to flag something important for your safety!",
      medium: 'Please note this important information:',
      low: 'Note:',
    },
    greeting: {
      high: "Welcome! I'm thrilled to help you discover amazing food today!",
      medium: "Hi there! I'm here to help with your food choices.",
      low: 'Hello. How can I help?',
    },
  };

  const levelKey = getToneModifiers(preset).enthusiasm;
  const options = openers[context][levelKey];

  return options[randomInt(options.length)];
}

/**
 * Adjective rotation to avoid repetition
 */
export function getRotatingAdjective(usedAdjectives: string[]): string {
  const allAdjectives = [
    'delicious', 'mouthwatering', 'scrumptious', 'tasty', 'flavorful',
    'savory', 'aromatic', 'appetizing', 'delectable', 'exquisite',
    'divine', 'sublime', 'heavenly', 'fantastic', 'wonderful',
  ];

  const available = allAdjectives.filter(adj => !usedAdjectives.includes(adj));

  if (available.length === 0) {
    return allAdjectives[randomInt(allAdjectives.length)];
  }

  return available[randomInt(available.length)];
}

export type TonePreset = keyof typeof TONE_PRESETS;
