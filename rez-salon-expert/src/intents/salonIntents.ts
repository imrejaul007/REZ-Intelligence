import { ServiceCategory } from '../services/salonExpert';

export interface SalonIntent {
  id: string;
  name: string;
  patterns: string[];
  requiredEntities: string[];
  optionalEntities: string[];
  priority: number;
}

export const SALON_INTENTS: SalonIntent[] = [
  {
    id: 'book_appointment',
    name: 'Book Appointment',
    patterns: [
      'book an appointment',
      'schedule',
      'i want to book',
      'make an appointment',
      'reserve a time',
      'can i get',
      'set up appointment',
      'book {service}'
    ],
    requiredEntities: ['service'],
    optionalEntities: ['date', 'time', 'stylist'],
    priority: 10
  },
  {
    id: 'explore_services',
    name: 'Explore Services',
    patterns: [
      'what services do you offer',
      'show me services',
      'what treatments',
      'menu',
      'browse services',
      'what can i get',
      'services available'
    ],
    requiredEntities: [],
    optionalEntities: ['category'],
    priority: 9
  },
  {
    id: 'service_info',
    name: 'Get Service Information',
    patterns: [
      'tell me about {service}',
      '{service} details',
      'what is {service}',
      'how much is {service}',
      '{service} how long',
      'information about {service}'
    ],
    requiredEntities: ['service'],
    optionalEntities: [],
    priority: 8
  },
  {
    id: 'check_availability',
    name: 'Check Availability',
    patterns: [
      'what times are available',
      'openings',
      'availability',
      'when can i book',
      'next available',
      'unknown openings',
      'available on {date}'
    ],
    requiredEntities: [],
    optionalEntities: ['date', 'service'],
    priority: 7
  },
  {
    id: 'recommendations',
    name: 'Get Recommendations',
    patterns: [
      'recommend',
      'suggest',
      'what would be good',
      'what do you recommend',
      'help me choose',
      'what\'s popular',
      'best treatment'
    ],
    requiredEntities: [],
    optionalEntities: ['category', 'concern', 'budget'],
    priority: 7
  },
  {
    id: 'skincare_advice',
    name: 'Skincare Advice',
    patterns: [
      'skin advice',
      'facial recommendation',
      'skin type',
      'what facial',
      'help with {concern}',
      'acne treatment',
      'anti-aging'
    ],
    requiredEntities: [],
    optionalEntities: ['skinType', 'concern'],
    priority: 6
  },
  {
    id: 'reschedule',
    name: 'Reschedule Appointment',
    patterns: [
      'reschedule',
      'change appointment',
      'move appointment',
      'different time',
      'change my appointment'
    ],
    requiredEntities: [],
    optionalEntities: ['date', 'time'],
    priority: 6
  },
  {
    id: 'cancel_appointment',
    name: 'Cancel Appointment',
    patterns: [
      'cancel appointment',
      'cancel my booking',
      'don\'t want anymore',
      'can\'t make it',
      'need to cancel'
    ],
    requiredEntities: [],
    optionalEntities: [],
    priority: 5
  },
  {
    id: 'allergy_concern',
    name: 'Allergy Concern',
    patterns: [
      'i\'m allergic',
      'allergy',
      'sensitive to',
      'can\'t have',
      'reaction to',
      'intolerance'
    ],
    requiredEntities: [],
    optionalEntities: ['allergen'],
    priority: 5
  },
  {
    id: 'prep_guidance',
    name: 'Preparation Guidance',
    patterns: [
      'how to prepare',
      'what to do before',
      'before my appointment',
      'tips',
      'should i bring',
      'preparation'
    ],
    requiredEntities: [],
    optionalEntities: ['service'],
    priority: 4
  },
  {
    id: 'pricing',
    name: 'Pricing Question',
    patterns: [
      'how much',
      'price',
      'cost',
      'what does it cost',
      'pricing',
      'fees'
    ],
    requiredEntities: [],
    optionalEntities: ['service'],
    priority: 5
  },
  {
    id: 'stylist_request',
    name: 'Request Specific Stylist',
    patterns: [
      'book with {stylist}',
      'prefer {stylist}',
      'specific stylist',
      'my usual',
      'same stylist',
      '{stylist} available'
    ],
    requiredEntities: ['stylist'],
    optionalEntities: [],
    priority: 4
  },
  {
    id: 'gift_services',
    name: 'Gift Services',
    patterns: [
      'gift card',
      'present',
      'gift for',
      'spa package',
      'treat someone',
      'gift certificate'
    ],
    requiredEntities: [],
    optionalEntities: ['budget'],
    priority: 3
  },
  {
    id: 'loyalty_program',
    name: 'Loyalty Program',
    patterns: [
      'loyalty',
      'rewards',
      'points',
      'membership',
      'perks',
      'benefits'
    ],
    requiredEntities: [],
    optionalEntities: [],
    priority: 3
  }
];

export interface EntityExtraction {
  service?: string;
  category?: ServiceCategory;
  date?: string;
  time?: string;
  stylist?: string;
  budget?: number;
  concern?: string;
  skinType?: string;
  allergen?: string;
  flexible?: boolean;
}

export function extractEntities(message: string): EntityExtraction {
  const entities: EntityExtraction = {};

  const categoryPatterns: Record<string, ServiceCategory> = {
    'haircut': ServiceCategory.HAIR,
    'hair': ServiceCategory.HAIR,
    'color': ServiceCategory.HAIR,
    'balayage': ServiceCategory.HAIR,
    'highlights': ServiceCategory.HAIR,
    'keratin': ServiceCategory.HAIR,
    'manicure': ServiceCategory.NAILS,
    'pedicure': ServiceCategory.NAILS,
    'gel': ServiceCategory.NAILS,
    'nails': ServiceCategory.NAILS,
    'acrylic': ServiceCategory.NAILS,
    'facial': ServiceCategory.SKINCARE,
    'facials': ServiceCategory.SKINCARE,
    'skincare': ServiceCategory.SKINCARE,
    'peel': ServiceCategory.SKINCARE,
    'microdermabrasion': ServiceCategory.SKINCARE,
    'massage': ServiceCategory.BODY,
    'body': ServiceCategory.BODY,
    'spa': ServiceCategory.BODY,
    'wax': ServiceCategory.BODY,
    'wrap': ServiceCategory.BODY,
    'makeup': ServiceCategory.MAKEUP,
    'bridal': ServiceCategory.MAKEUP,
    'brow': ServiceCategory.BROW_LASH,
    'eyebrow': ServiceCategory.BROW_LASH,
    'lash': ServiceCategory.BROW_LASH,
    'extensions': ServiceCategory.BROW_LASH
  };

  for (const [keyword, category] of Object.entries(categoryPatterns)) {
    if (message.toLowerCase().includes(keyword)) {
      entities.category = category;
      break;
    }
  }

  const datePatterns: Record<string, string> = {
    'monday': 'Monday',
    'tuesday': 'Tuesday',
    'wednesday': 'Wednesday',
    'thursday': 'Thursday',
    'friday': 'Friday',
    'saturday': 'Saturday',
    'sunday': 'Sunday',
    'tomorrow': 'tomorrow',
    'today': 'today',
    'next week': 'next week'
  };

  for (const [pattern, date] of Object.entries(datePatterns)) {
    if (message.toLowerCase().includes(pattern)) {
      entities.date = date;
      break;
    }
  }

  const timePatterns = [
    'morning', 'afternoon', 'evening',
    '9 am', '10 am', '11 am', '12 pm',
    '1 pm', '2 pm', '3 pm', '4 pm', '5 pm', '6 pm'
  ];

  for (const time of timePatterns) {
    if (message.toLowerCase().includes(time)) {
      entities.time = time;
      break;
    }
  }

  const priceMatch = message.match(/\$?\s*(\d{2,3})/);
  if (priceMatch) {
    entities.budget = parseInt(priceMatch[1]);
  }

  const concernPatterns = [
    'acne', 'wrinkles', 'aging', 'dry skin', 'oily skin', 'sensitive',
    'dark spots', 'redness', 'dullness', 'aging', 'pore'
  ];

  for (const concern of concernPatterns) {
    if (message.toLowerCase().includes(concern)) {
      entities.concern = concern;
      break;
    }
  }

  const skinTypePatterns = [
    'normal', 'dry', 'oily', 'combination', 'combination', 'sensitive'
  ];

  for (const skinType of skinTypePatterns) {
    if (message.toLowerCase().includes(skinType)) {
      entities.skinType = skinType;
      break;
    }
  }

  const allergenPatterns = [
    'ammonia', 'ppd', 'formaldehyde', 'latex', 'fragrance', 'essential oil',
    'gluten', 'nuts', 'shellfish', 'resorcinol', 'toluene'
  ];

  for (const allergen of allergenPatterns) {
    if (message.toLowerCase().includes(allergen)) {
      entities.allergen = allergen;
      break;
    }
  }

  if (message.toLowerCase().includes('unknown') || message.toLowerCase().includes('no preference')) {
    entities.flexible = true;
  }

  return entities;
}

export function matchIntent(message: string): SalonIntent | null {
  const lowerMessage = message.toLowerCase();

  let bestMatch: SalonIntent | null = null;
  let highestScore = 0;

  for (const intent of SALON_INTENTS) {
    let matchCount = 0;

    for (const pattern of intent.patterns) {
      const patternLower = pattern.toLowerCase();

      if (patternLower.includes('{service}') || patternLower.includes('{date}') || patternLower.includes('{stylist}')) {
        const regexPattern = patternLower.replace(/\{[^}]+\}/g, '[^\\s]+');
        const regex = new RegExp(regexPattern, 'i');
        if (regex.test(lowerMessage)) {
          matchCount += 2;
        }
      } else {
        const words = patternLower.split(' ');
        const matchingWords = words.filter(word => lowerMessage.includes(word));
        matchCount += matchingWords.length / words.length;
      }
    }

    const score = (matchCount / intent.patterns.length) * intent.priority;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = intent;
    }
  }

  return highestScore >= 0.3 ? bestMatch : null;
}
