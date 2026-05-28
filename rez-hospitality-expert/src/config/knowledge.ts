/**
 * Knowledge Base Configuration
 * Comprehensive hotel terminology, room types, amenities, and policies
 */

import { RoomType, AmenityCategory } from '../types/index';

// ============================================
// ROOM TYPES & FEATURES
// ============================================

export interface RoomTypeInfo {
  type: RoomType;
  name: string;
  description: string;
  size: {
    sqft: number;
    sqm: number;
  };
  maxOccupancy: {
    adults: number;
    children: number;
  };
  bedConfiguration: string[];
  view: string;
  features: string[];
  amenities: string[];
  priceRange: {
    low: number;
    high: number;
    currency: string;
  };
}

export const ROOM_TYPES: Record<RoomType, RoomTypeInfo> = {
  [RoomType.STANDARD]: {
    type: RoomType.STANDARD,
    name: 'Standard Room',
    description: 'Comfortable and well-appointed room featuring modern amenities and stylish decor for a relaxing stay.',
    size: { sqft: 350, sqm: 33 },
    maxOccupancy: { adults: 2, children: 1 },
    bedConfiguration: ['King', 'Queen', 'Two Doubles'],
    view: 'City view or garden view',
    features: [
      'Complimentary high-speed WiFi',
      'Smart TV with streaming services',
      'Work desk with ergonomic chair',
      'In-room safe',
      'Mini refrigerator',
      'Coffee and tea-making facilities',
      'Blackout curtains',
      'Climate control',
    ],
    amenities: [
      'Luxury linens',
      'Plush bathrobes',
      'Hair dryer',
      'Designer toiletries',
      'Iron and ironing board',
    ],
    priceRange: { low: 199, high: 299, currency: 'USD' },
  },

  [RoomType.DELUXE]: {
    type: RoomType.DELUXE,
    name: 'Deluxe Room',
    description: 'Spacious retreat with enhanced amenities, premium bedding, and stunning views for the discerning traveler.',
    size: { sqft: 450, sqm: 42 },
    maxOccupancy: { adults: 2, children: 2 },
    bedConfiguration: ['King', 'Two Queens'],
    view: 'Partial ocean or pool view',
    features: [
      'Everything in Standard, plus:',
      'Expanded living area',
      'Marble bathroom with soaking tub',
      'Premium bedding package',
      'Nespresso machine',
      'Bluetooth speaker',
      'Enhanced mini bar',
      'Twice-daily housekeeping',
    ],
    amenities: [
      'Everything in Standard, plus:',
      'Luxury bath amenities',
      'Bath salts and body wash',
      'Premium hair care products',
      'Makeup mirror',
    ],
    priceRange: { low: 299, high: 449, currency: 'USD' },
  },

  [RoomType.SUITE]: {
    type: RoomType.SUITE,
    name: 'One-Bedroom Suite',
    description: 'Luxurious separate living area and bedroom with panoramic views and personalized services.',
    size: { sqft: 700, sqm: 65 },
    maxOccupancy: { adults: 3, children: 2 },
    bedConfiguration: ['King'],
    view: 'Ocean or panoramic view',
    features: [
      'Separate living room with dining area',
      'Master bedroom with luxury bedding',
      'Marble master bathroom with rain shower',
      'Deep soaking tub',
      'Premium wet bar',
      'Full kitchen or kitchenette',
      'Washer and dryer',
      'Private balcony or terrace',
      'Butler service upon request',
    ],
    amenities: [
      'Everything in Deluxe, plus:',
      'Complimentary breakfast in bed',
      'Evening turndown service',
      'Exclusive lounge access',
      'Premium champagne on arrival',
    ],
    priceRange: { low: 599, high: 899, currency: 'USD' },
  },

  [RoomType.JUNIOR_SUITE]: {
    type: RoomType.JUNIOR_SUITE,
    name: 'Junior Suite',
    description: 'Open-plan suite combining bedroom and living space with hotel\'s signature amenities.',
    size: { sqft: 550, sqm: 51 },
    maxOccupancy: { adults: 2, children: 1 },
    bedConfiguration: ['King'],
    view: 'Ocean or city view',
    features: [
      'Open-plan bedroom and living area',
      'Signature king bed',
      'Spa-inspired bathroom',
      'Rain shower and soaking tub',
      'Curated minibar',
      'Smart home controls',
      'Private balcony',
    ],
    amenities: [
      'Everything in Deluxe',
      'Complimentary pressing service',
      'Access to Executive Lounge',
    ],
    priceRange: { low: 449, high: 649, currency: 'USD' },
  },

  [RoomType.PRESIDENTIAL_SUITE]: {
    type: RoomType.PRESIDENTIAL_SUITE,
    name: 'Presidential Suite',
    description: 'The pinnacle of luxury. Two bedrooms, grand living areas, personal butler, and unparalleled service.',
    size: { sqft: 2500, sqm: 232 },
    maxOccupancy: { adults: 6, children: 3 },
    bedConfiguration: ['Two Kings', 'King + Two Queens'],
    view: '360-degree panoramic view',
    features: [
      'Two master bedrooms',
      'Grand living and dining rooms',
      'Private gym',
      'Personal spa treatment room',
      'Chef\'s kitchen',
      'Private terrace with plunge pool',
      'Dedicated butler',
      'Round-the-clock concierge',
      'Private entrance',
      'Limousine service',
    ],
    amenities: [
      'Everything in Suite, plus:',
      'Daily flower arrangements',
      'Personalized minibar',
      'Complimentary laundry',
      'Airport transfers',
      'Private dining experiences',
    ],
    priceRange: { low: 2500, high: 8000, currency: 'USD' },
  },

  [RoomType.EXECUTIVE]: {
    type: RoomType.EXECUTIVE,
    name: 'Executive Room',
    description: 'Designed for business travelers with dedicated workspace and premium connectivity.',
    size: { sqft: 400, sqm: 37 },
    maxOccupancy: { adults: 2, children: 0 },
    bedConfiguration: ['King'],
    view: 'City view',
    features: [
      'Ergonomic workstation',
      'Dual monitor setup available',
      'Premium WiFi for video conferencing',
      'Printer and scanner access',
      'International power outlets',
      'Executive lounge access',
      'Boardroom table for meetings',
    ],
    amenities: [
      'Everything in Standard, plus:',
      'Complimentary business breakfast',
      'Evening cocktails and appetizers',
      'Express laundry service',
      'Meeting room credits',
    ],
    priceRange: { low: 349, high: 499, currency: 'USD' },
  },

  [RoomType.ACCESSIBLE]: {
    type: RoomType.ACCESSIBLE,
    name: 'Accessible Room',
    description: 'Thoughtfully designed rooms with comprehensive accessibility features for all abilities.',
    size: { sqft: 400, sqm: 37 },
    maxOccupancy: { adults: 2, children: 1 },
    bedConfiguration: ['King', 'Queen'],
    view: 'City or garden view',
    features: [
      'Wheelchair-accessible entrance',
      'Widened doorways',
      'Lowered amenities',
      'Accessible bathroom with grab bars',
      'Roll-in shower',
      'Visual alerts and alarms',
      'Hearing loop system',
      'Accessible balcony where applicable',
    ],
    amenities: [
      'Everything in Standard',
      'Accessible amenities kit',
      '24/7 accessibility assistance',
    ],
    priceRange: { low: 249, high: 399, currency: 'USD' },
  },

  [RoomType.FAMILY]: {
    type: RoomType.FAMILY,
    name: 'Family Suite',
    description: 'Spacious accommodations designed for families with kids\' amenities and connecting rooms available.',
    size: { sqft: 600, sqm: 56 },
    maxOccupancy: { adults: 2, children: 4 },
    bedConfiguration: ['King + Two Bunk Beds', 'Two Queens + Bunk Bed'],
    view: 'Garden or pool view',
    features: [
      'Separate kids\' sleeping area',
      'Gaming console',
      'Kids\' welcome amenity',
      'Child-safe balcony',
      'Baby gear upon request',
      'Kids\' menu available',
      'Family pool access',
      'Connecting room options',
    ],
    amenities: [
      'Everything in Deluxe, plus:',
      'Kids\' toiletries and bathrobes',
      'Board games and books',
      'Stroller rental',
      'Kids club access',
    ],
    priceRange: { low: 449, high: 699, currency: 'USD' },
  },

  [RoomType.OCEAN_VIEW]: {
    type: RoomType.OCEAN_VIEW,
    name: 'Ocean View Room',
    description: 'Wake up to breathtaking ocean views from your private balcony in these beautifully appointed rooms.',
    size: { sqft: 400, sqm: 37 },
    maxOccupancy: { adults: 2, children: 1 },
    bedConfiguration: ['King', 'Two Queens'],
    view: 'Full ocean view',
    features: [
      'Private balcony overlooking ocean',
      'Premium oceanfront positioning',
      'Enhanced mini bar',
      'Binoculars for whale/boat watching',
      'Sunset viewing guide',
      'Beach bag with essentials',
    ],
    amenities: [
      'Everything in Deluxe',
      'Beach towel service',
      'Complimentary beach chairs',
      'Sunset cocktail upon arrival',
    ],
    priceRange: { low: 399, high: 599, currency: 'USD' },
  },

  [RoomType.POOL_VIEW]: {
    type: RoomType.POOL_VIEW,
    name: 'Pool View Room',
    description: 'Enjoy poolside vibes from your room with direct or partial pool views and tropical surroundings.',
    size: { sqft: 380, sqm: 35 },
    maxOccupancy: { adults: 2, children: 1 },
    bedConfiguration: ['King', 'Queen'],
    view: 'Pool and tropical garden view',
    features: [
      'Private balcony or patio',
      'Pool access included',
      'Pool/beach towel service',
      'Complimentary poolside refreshments',
      'Lounge chair reservation',
    ],
    amenities: [
      'Everything in Standard',
      'Pool towel service',
      'Fruit basket upon arrival',
    ],
    priceRange: { low: 299, high: 449, currency: 'USD' },
  },
};

// ============================================
// AMENITIES
// ============================================

export interface AmenityInfo {
  name: string;
  category: AmenityCategory;
  description: string;
  location: string;
  hours: string;
  contact?: string;
  price?: {
    amount: number;
    currency: string;
    unit: string;
  };
  bookingRequired: boolean;
  notes?: string[];
}

export const AMENITIES: AmenityInfo[] = [
  // Room Amenities
  {
    name: 'High-Speed WiFi',
    category: AmenityCategory.ROOM,
    description: 'Complimentary high-speed wireless internet throughout the property',
    location: 'All rooms and public areas',
    hours: '24/7',
    bookingRequired: false,
  },
  {
    name: 'In-Room Dining',
    category: AmenityCategory.ROOM,
    description: 'Curated menu available 24 hours for breakfast, lunch, and dinner',
    location: 'All rooms',
    hours: '24 hours',
    contact: 'Dial 7 for Room Service',
    bookingRequired: false,
    notes: ['Breakfast: 6:30 AM - 11:00 AM', 'Lunch: 11:30 AM - 2:30 PM', 'Dinner: 6:00 PM - 10:30 PM', 'Late Night Menu: 10:30 PM - 6:30 AM'],
  },
  {
    name: 'Daily Housekeeping',
    category: AmenityCategory.ROOM,
    description: 'Professional cleaning service with evening turndown',
    location: 'All rooms',
    hours: 'Housekeeping: 8:00 AM - 5:00 PM, Turndown: 6:00 PM - 10:00 PM',
    bookingRequired: false,
    notes: ['Express service available', 'Do not disturb hours honored'],
  },

  // Property Amenities
  {
    name: 'Fitness Center',
    category: AmenityCategory.PROPERTY,
    description: 'State-of-the-art equipment, personal trainers available',
    location: 'East Wing, Level 2',
    hours: 'Open 24 hours',
    bookingRequired: false,
    notes: ['Complimentary for all guests', 'Towels and water provided', 'Personal training sessions available at additional cost'],
  },
  {
    name: 'Swimming Pools',
    category: AmenityCategory.PROPERTY,
    description: 'Infinity pool, family pool, and adults-only pool',
    location: 'Various locations',
    hours: '6:00 AM - 10:00 PM',
    bookingRequired: false,
    notes: ['Pool access included with stay', 'Cabanas available for rent', 'Lifeguards on duty during operating hours'],
  },
  {
    name: 'Business Center',
    category: AmenityCategory.BUSINESS,
    description: 'Computers, printers, and meeting space',
    location: 'Main Building, Level 1',
    hours: '6:00 AM - 11:00 PM',
    bookingRequired: false,
    notes: ['Printing and copying services', 'Meeting pods available', 'Video conferencing setup'],
  },
  {
    name: 'Concierge Services',
    category: AmenityCategory.PROPERTY,
    description: 'Personalized assistance for reservations, recommendations, and arrangements',
    location: 'Lobby',
    hours: '24 hours',
    contact: 'Dial 0 for Concierge',
    bookingRequired: false,
    notes: ['Restaurant reservations', 'Transportation arrangements', 'Tour bookings', 'Special occasion planning'],
  },
  {
    name: 'Valet Parking',
    category: AmenityCategory.PROPERTY,
    description: 'Secure parking with valet service',
    location: 'Main Entrance',
    hours: '24 hours',
    price: { amount: 45, currency: 'USD', unit: 'per night' },
    bookingRequired: false,
    notes: ['Self-parking also available', 'Electric vehicle charging stations'],
  },
  {
    name: 'Airport Transfer',
    category: AmenityCategory.PROPERTY,
    description: 'Luxury vehicle transfers to/from airport',
    location: 'Arranged through concierge',
    contact: 'Dial 0 for Concierge',
    hours: '24 hours',
    bookingRequired: true,
    price: { amount: 85, currency: 'USD', unit: 'per trip' },
    notes: ['Sedan and SUV options', 'VIP limousine service available', 'Group transfers available'],
  },

  // Dining Amenities
  {
    name: 'Oceanview Restaurant',
    category: AmenityCategory.DINING,
    description: 'Fine dining with panoramic ocean views',
    location: 'Tower, Level 12',
    hours: 'Breakfast: 6:30 AM - 11:00 AM, Dinner: 6:00 PM - 10:30 PM',
    contact: 'Dial 1 for Reservations',
    bookingRequired: true,
    notes: ['Dress code: Smart casual', 'Vegetarian and vegan options', 'Chef\'s tasting menu available'],
  },
  {
    name: 'Poolside Bar & Grill',
    category: AmenityCategory.DINING,
    description: 'Casual dining and cocktails by the pool',
    location: 'Pool Deck',
    hours: '11:00 AM - 6:00 PM',
    bookingRequired: false,
  },
  {
    name: 'Lobby Lounge',
    category: AmenityCategory.DINING,
    description: 'Afternoon tea, cocktails, and live music',
    location: 'Main Lobby',
    hours: '3:00 PM - 12:00 AM',
    bookingRequired: false,
    notes: ['Live jazz on weekends', 'Afternoon tea: 3:00 PM - 5:30 PM'],
  },

  // Recreation
  {
    name: 'The Spa',
    category: AmenityCategory.RECREATION,
    description: 'Full-service spa with treatments, sauna, and steam room',
    location: 'West Wing, Levels 1-2',
    hours: '9:00 AM - 9:00 PM',
    contact: 'Dial 5 for Spa',
    bookingRequired: true,
    notes: ['Advance booking recommended', 'Couples treatments available', 'Spa day packages available'],
  },
  {
    name: 'Tennis Courts',
    category: AmenityCategory.RECREATION,
    description: 'Two floodlit tennis courts with equipment rental',
    location: 'Garden Area',
    hours: '7:00 AM - 9:00 PM',
    bookingRequired: true,
    price: { amount: 25, currency: 'USD', unit: 'per hour' },
    notes: ['Racquet rental included', 'Pro lessons available', 'Equipment provided'],
  },
  {
    name: 'Kids Club',
    category: AmenityCategory.RECREATION,
    description: 'Supervised activities for children ages 4-12',
    location: 'Family Wing, Level 1',
    hours: '9:00 AM - 5:00 PM',
    bookingRequired: true,
    notes: ['Ages 4-12 years', 'Complimentary for resort guests', 'Advance registration required'],
  },
  {
    name: 'Water Sports',
    category: AmenityCategory.RECREATION,
    description: 'Kayaking, paddleboarding, snorkeling, and more',
    location: 'Beach Club',
    hours: '8:00 AM - 5:00 PM',
    bookingRequired: true,
    notes: ['Equipment included', 'Lessons available', 'Weather dependent'],
  },

  // Accessibility
  {
    name: 'Accessible Services',
    category: AmenityCategory.ACCESSIBILITY,
    description: 'Comprehensive accessibility services and equipment',
    location: 'Throughout property',
    hours: 'Available upon request',
    bookingRequired: true,
    notes: ['Wheelchair accessible rooms', 'Sign language interpreters', 'Accessible transportation', 'Braille menus available'],
  },
];

// ============================================
// POLICIES
// ============================================

export interface Policy {
  category: string;
  name: string;
  description: string;
  details: string[];
}

export const POLICIES: Policy[] = [
  {
    category: 'Arrival & Departure',
    name: 'Check-In & Check-Out',
    description: 'Standard arrival and departure times with flexibility options',
    details: [
      'Check-in time: 3:00 PM',
      'Check-out time: 11:00 AM',
      'Early check-in available from 12:00 PM (subject to availability)',
      'Late check-out available until 2:00 PM (subject to availability)',
      'Guaranteed check-in: 3:00 PM (payment required for earlier guarantee)',
      'Day-use rooms available for early arrivals (additional charge)',
    ],
  },
  {
    category: 'Arrival & Departure',
    name: 'Cancellation Policy',
    description: 'Flexible cancellation options based on rate plan',
    details: [
      'Standard Rate: Cancel by 3 PM day prior to avoid one night charge',
      'Non-Refundable Rate: No cancellation permitted',
      'Package Rate: 72-hour cancellation notice required',
      'Peak Season (Dec 20 - Jan 5): 7-day cancellation notice required',
      'Group Bookings: Individual cancellation policies may apply',
    ],
  },
  {
    category: 'Payment',
    name: 'Accepted Payment Methods',
    description: 'We accept the following payment methods',
    details: [
      'Major credit cards: Visa, Mastercard, American Express, Discover',
      'Debit cards with credit logo',
      'Cash (USD and select foreign currencies)',
      'Traveler\'s checks',
      'Corporate account billing (pre-approved)',
    ],
  },
  {
    category: 'Payment',
    name: 'Deposit Requirements',
    description: 'Security deposit and payment authorization',
    details: [
      'Credit card authorization at check-in: $100/night (up to $500)',
      'Incidentals coverage authorization',
      'Refund upon check-out if no charges incurred',
      'Debit cards: Funds held for 3-5 business days after check-out',
    ],
  },
  {
    category: 'Guest Services',
    name: 'Pet Policy',
    description: 'Pet-friendly accommodations and services',
    details: [
      'Dogs under 25 lbs welcome in designated rooms',
      'Pet fee: $75 per night (max $150 per stay)',
      'Maximum 2 pets per room',
      'Pets must be leashed in public areas',
      'Pet sitting and walking services available',
      'Emotional support animals: Documentation required',
    ],
  },
  {
    category: 'Guest Services',
    name: 'Smoking Policy',
    description: 'Smoke-free environment for guest comfort',
    details: [
      'All indoor areas are 100% smoke-free',
      'Designated outdoor smoking areas available',
      'Smoking in non-designated areas: $250 cleaning fee',
      'E-cigarettes: Follow same policy as cigarettes',
      'Balcony smoking: Check specific room policy',
    ],
  },
  {
    category: 'Guest Services',
    name: 'Noise Policy',
    description: 'Quiet hours and noise guidelines',
    details: [
      'Quiet hours: 10:00 PM - 8:00 AM',
      'Excessive noise violations: Warning, then $250 fine',
      'Third violation: Possible removal from property',
      'Guest responsible for visitor behavior',
      'Noise monitoring devices available upon request',
    ],
  },
  {
    category: 'Dining',
    name: 'Dress Code',
    description: 'Restaurant attire guidelines',
    details: [
      'Fine Dining: Smart casual (no swimwear, flip-flops, or athletic wear)',
      'Poolside/Beach: Resort casual (cover-ups required)',
      'Casual dining: Casual attire acceptable',
      'Breakfast: Resort casual',
    ],
  },
  {
    category: 'Spa & Wellness',
    name: 'Spa Guidelines',
    description: 'Policies for spa and wellness services',
    details: [
      'Minimum age: 16 for treatments',
      'Advance booking recommended',
      '24-hour cancellation policy for treatments',
      'Arrive 15 minutes early for treatment',
      'Communicate health conditions and preferences',
      'Gratuities: 18-20% recommended',
    ],
  },
  {
    category: 'Safety & Security',
    name: 'Safety Deposit Boxes',
    description: 'In-room safe and front desk storage',
    details: [
      'Complimentary in-room safe in every room',
      'Safe sizes accommodate laptops and valuables',
      'Front desk storage for large valuables',
      'Lost key replacement: $25',
      'Report unknown suspicious activity immediately',
    ],
  },
  {
    category: 'Special Requests',
    name: 'Accessibility Accommodations',
    description: 'Services for guests with disabilities',
    details: [
      'Accessible rooms available on all floors',
      'TTY/TDD devices at front desk',
      'Service animals welcome',
      'Accessible transportation available',
      'Braille signage throughout property',
      'Visual alarms in accessible rooms',
    ],
  },
];

// ============================================
// HOTEL TERMINOLOGY
// ============================================

export const HOTEL_TERMINOLOGY: Record<string, string> = {
  // Room-related
  'turndown': 'Evening service preparing your room for sleep with fresh linens, chocolates, etc.',
  'morning newspaper': 'Complimentary newspaper delivery to your room',
  'wake-up call': 'Phone call to wake you at a specified time',
  'do not disturb': 'Sign indicating you do not want to be disturbed',
  'turndown service': 'Evening room preparation including bed turndown',
  'pillow menu': 'Selection of pillow types available upon request',
  'bedding': 'Sheets, pillows, blankets, and mattress',
  'suite': 'Multi-room accommodation with separate living area',
  'connecting rooms': 'Adjoining rooms with private doors',
  'adjacent rooms': 'Rooms near each other but not connected',
  'run of house': 'Room assigned at hotel discretion without guarantees',
  'upgrades': 'Moving to a better room category (subject to availability)',

  // Service-related
  'concierge': 'Specialized staff for recommendations and arrangements',
  'valet': 'Parking and retrieving your vehicle',
  'bellman': 'Staff assisting with luggage',
  'room service': 'Food and beverages delivered to your room',
  'butler': 'Personal assistant for suite guests',
  'housekeeping': 'Room cleaning and maintenance staff',
  'front desk': 'Main reception for check-in, check-out, and inquiries',
  'night audit': 'Accounting process running nightly',
  'express checkout': 'Departure without stopping at front desk',

  // Dining-related
  'continental breakfast': 'Light breakfast including pastries, fruit, coffee',
  'buffet': 'Self-service dining with multiple food stations',
  'tasting menu': 'Multi-course chef-selected menu',
  'table d\'hôte': 'Fixed-price menu with limited choices',
  'room charge': 'Adding dining to your room bill',
  'half board': 'Breakfast and dinner included',
  'full board': 'All meals included',
  'all-inclusive': 'Meals, drinks, and activities included',

  // Booking-related
  'rack rate': 'Standard published rate without discounts',
  'corporate rate': 'Discounted rate for business travelers',
  'package rate': 'Rate including additional services (meals, spa, etc.)',
  'OTA': 'Online Travel Agency booking',
  'direct booking': 'Booking through hotel website or phone',
  'guaranteed booking': 'Booking with payment card to ensure arrival',
  'no-show': 'Guest who reserves but doesn\'t arrive',
  'overbooking': 'When reservations exceed available rooms',

  // Status-related
  'vacant dirty': 'Room needs cleaning',
  'vacant clean': 'Ready for guest arrival',
  'occupied': 'Currently in use by guest',
  'out of order': 'Room not available (maintenance, etc.)',
  'due out': 'Guest scheduled to check out today',
  'due in': 'Guest scheduled to check in today',
  'sleepout': 'Occupied room but guest not present',
  'lockout': 'Guest locked out of room',

  // Charges and billing
  'incidentals': 'Additional charges beyond room rate',
  'city ledger': 'Billing directly to the hotel (no payment at checkout)',
  'folio': 'Guest bill showing charges',
  'posting': 'Adding a charge to guest account',
  'direct bill': 'Company billing for business guests',
};

// ============================================
// SPECIAL OCCASIONS
// ============================================

export const SPECIAL_OCCASIONS = {
  honeymoon: {
    name: 'Honeymoon',
    amenities: ['Champagne on arrival', 'Romantic dinner setup', 'Couples spa treatment', 'Rose petal turndown', 'Late checkout'],
    recommendations: ['Private beach dinner', 'Sunset cruise', 'Couples cooking class', 'Photography session'],
  },
  anniversary: {
    name: 'Anniversary',
    amenities: ['Champagne and chocolates', 'Special bed decoration', 'Anniversary cake', 'Complimentary upgrade (subject to availability)'],
    recommendations: ['Private dining experience', 'Couples massage', 'Memory book creation', 'Anniversary photo'],
  },
  birthday: {
    name: 'Birthday',
    amenities: ['Birthday cake', 'Special turndown with treats', 'Complimentary dessert at restaurants', 'Birthday card'],
    recommendations: ['Private chef dinner', 'Spa day package', 'Birthday party at pool', 'Excursion experience'],
  },
  business: {
    name: 'Business Travel',
    amenities: ['Express laundry', 'Business center access', 'Breakfast package', 'Meeting room credits'],
    recommendations: ['Executive lounge access', 'Private car service', 'Dinner reservations', 'Fitness center access'],
  },
  family: {
    name: 'Family Vacation',
    amenities: ['Kids club access', 'Game room credits', 'Family pool hours', 'Kids menu at restaurants'],
    recommendations: ['Kids spa treatments', 'Family excursion', 'Movie night setup', 'Babysitting service'],
  },
  babymoon: {
    name: 'Babymoon',
    amenities: ['Special pillows', 'Quiet floor placement', 'Flexible dining schedule', 'Spa treatments for expecting mothers'],
    recommendations: ['Prenatal massage', 'Quiet beach area', 'Special dietary accommodations', 'Photography session'],
  },
  retirement: {
    name: 'Retirement Celebration',
    amenities: ['Welcome amenities', 'Historical tour of area', 'Fine dining experience', 'Late checkout'],
    recommendations: ['Sunset sailing', 'Golf package', 'Cultural excursions', 'Private celebration setup'],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get room type information
 */
export function getRoomTypeInfo(roomType: RoomType): RoomTypeInfo | undefined {
  return ROOM_TYPES[roomType];
}

/**
 * Get amenities by category
 */
export function getAmenitiesByCategory(category: AmenityCategory): AmenityInfo[] {
  return AMENITIES.filter(a => a.category === category);
}

/**
 * Get policy by name
 */
export function getPolicy(policyName: string): Policy | undefined {
  return POLICIES.find(p => p.name.toLowerCase() === policyName.toLowerCase());
}

/**
 * Get terminology definition
 */
export function getTermDefinition(term: string): string | undefined {
  return HOTEL_TERMINOLOGY[term.toLowerCase()];
}

/**
 * Get special occasion information
 */
export function getSpecialOccasion(occasion: string): typeof SPECIAL_OCCASIONS.honeymoon | undefined {
  return SPECIAL_OCCASIONS[occasion as keyof typeof SPECIAL_OCCASIONS];
}

/**
 * Format room type for display
 */
export function formatRoomType(roomType: RoomType): string {
  return ROOM_TYPES[roomType]?.name || roomType;
}

/**
 * Calculate upgrade pricing
 */
export function calculateUpgradePrice(
  currentRoom: RoomType,
  targetRoom: RoomType,
  nights: number
): { perNight: number; total: number; currency: string } | null {
  const current = ROOM_TYPES[currentRoom];
  const target = ROOM_TYPES[targetRoom];

  if (!current || !target) return null;

  const perNight = target.priceRange.low - current.priceRange.low;

  return {
    perNight,
    total: perNight * nights,
    currency: 'USD',
  };
}
