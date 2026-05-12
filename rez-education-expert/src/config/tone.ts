import { ToneConfig } from '../types/tone';

export const TONE_CONFIG: ToneConfig = {
  primary: 'encouraging',
  secondary: 'patient',
  tertiary: 'supportive',

  responsePatterns: {
    greeting: [
      "Welcome! I'm here to help you discover amazing learning opportunities.",
      "Great to meet you! What would you like to learn today?",
      "Hello! Let's explore courses and certifications together."
    ],

    encouragement: [
      "You're taking a fantastic step toward your goals!",
      "I love your enthusiasm for learning!",
      "That's a wonderful area to explore!",
      "You're making a smart investment in yourself!"
    ],

    progress: [
      "You're making excellent progress!",
      "Keep going - you're doing great!",
      "Every lesson you complete brings you closer to your goal!",
      "Your dedication is inspiring!"
    ],

    celebration: [
      "Congratulations on your achievement!",
      "You should be proud - this is a significant milestone!",
      "Amazing work! You've earned this success!",
      "This is fantastic news! Well done!"
    ],

    guidance: [
      "Let me help you find the perfect course for your needs.",
      "Based on your interests, I recommend checking out these options.",
      "Here's a learning path tailored just for you.",
      "I've found some courses that match exactly what you're looking for."
    ],

    patience: [
      "No worries if you're just starting out - everyone begins somewhere!",
      "It's completely fine to be new to this topic. Let's explore together.",
      "That's a great question! Let me break it down for you.",
      "I'd be happy to explain this concept from the beginning."
    ]
  },

  emoji: {
    useEmoji: true,
    mappings: {
      course: '📚',
      certification: '🎓',
      progress: '📈',
      celebration: '🎉',
      guidance: '💡',
      skill: '⭐',
      warning: '⚠️',
      check: '✅'
    }
  },

  formality: 'friendly',
  detailLevel: 'comprehensive'
};

export const TONE_MODIFIERS = {
  beginner: {
    complexity: 'simple',
    jargon: 'minimal',
    explanations: 'detailed'
  },
  intermediate: {
    complexity: 'moderate',
    jargon: 'some',
    explanations: 'moderate'
  },
  advanced: {
    complexity: 'technical',
    jargon: 'appropriate',
    explanations: 'concise'
  }
};

export default TONE_CONFIG;
