/**
 * Events Industry Knowledge Base
 */

export enum EventType {
  CORPORATE = 'corporate',
  SOCIAL = 'social',
  ENTERTAINMENT = 'entertainment',
  SPORTS = 'sports',
  EDUCATIONAL = 'educational',
  CHARITY = 'charity',
  WEDDING = 'wedding',
  CONFERENCE = 'conference',
}

export enum VendorCategory {
  CATERING = 'catering',
  VENUE = 'venue',
  DECORATION = 'decoration',
  AUDIO_VISUAL = 'audio_visual',
  PHOTOGRAPHY = 'photography',
  ENTERTAINMENT = 'entertainment',
  TRANSPORTATION = 'transportation',
  SECURITY = 'security',
  MARKETING = 'marketing',
}

export enum DemandLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface EventTypeData {
  name: string;
  typicalDuration: number;
  avgAttendance: number;
  priceRange: { min: number; max: number };
  peakSeasons: string[];
  commonVendors: VendorCategory[];
}

export interface PricingFactor {
  name: string;
  weight: number;
  description: string;
}

export interface AttendanceFactor {
  name: string;
  impact: number;
  direction: 'positive' | 'negative';
}

// Event Types with metadata
export const EVENT_TYPES: Record<EventType, EventTypeData> = {
  [EventType.CORPORATE]: {
    name: 'Corporate Events',
    typicalDuration: 4,
    avgAttendance: 100,
    priceRange: { min: 50, max: 500 },
    peakSeasons: ['spring', 'fall'],
    commonVendors: [VendorCategory.CATERING, VendorCategory.AUDIO_VISUAL, VendorCategory.VENUE],
  },
  [EventType.SOCIAL]: {
    name: 'Social Events',
    typicalDuration: 3,
    avgAttendance: 75,
    priceRange: { min: 20, max: 200 },
    peakSeasons: ['spring', 'summer'],
    commonVendors: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY],
  },
  [EventType.ENTERTAINMENT]: {
    name: 'Entertainment Events',
    typicalDuration: 5,
    avgAttendance: 500,
    priceRange: { min: 30, max: 300 },
    peakSeasons: ['summer', 'winter'],
    commonVendors: [VendorCategory.AUDIO_VISUAL, VendorCategory.SECURITY, VendorCategory.TRANSPORTATION],
  },
  [EventType.SPORTS]: {
    name: 'Sports Events',
    typicalDuration: 6,
    avgAttendance: 1000,
    priceRange: { min: 10, max: 150 },
    peakSeasons: ['fall', 'spring'],
    commonVendors: [VendorCategory.SECURITY, VendorCategory.TRANSPORTATION, VendorCategory.CATERING],
  },
  [EventType.EDUCATIONAL]: {
    name: 'Educational Events',
    typicalDuration: 8,
    avgAttendance: 50,
    priceRange: { min: 0, max: 100 },
    peakSeasons: ['summer', 'winter'],
    commonVendors: [VendorCategory.AUDIO_VISUAL, VendorCategory.VENUE, VendorCategory.CATERING],
  },
  [EventType.CHARITY]: {
    name: 'Charity Events',
    typicalDuration: 4,
    avgAttendance: 200,
    priceRange: { min: 50, max: 500 },
    peakSeasons: ['fall', 'winter'],
    commonVendors: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY],
  },
  [EventType.WEDDING]: {
    name: 'Weddings',
    typicalDuration: 8,
    avgAttendance: 150,
    priceRange: { min: 100, max: 1000 },
    peakSeasons: ['spring', 'summer', 'fall'],
    commonVendors: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY, VendorCategory.ENTERTAINMENT],
  },
  [EventType.CONFERENCE]: {
    name: 'Conferences',
    typicalDuration: 12,
    avgAttendance: 300,
    priceRange: { min: 100, max: 800 },
    peakSeasons: ['spring', 'fall'],
    commonVendors: [VendorCategory.VENUE, VendorCategory.AUDIO_VISUAL, VendorCategory.CATERING, VendorCategory.MARKETING],
  },
};

// Pricing factors weights
export const PRICING_FACTORS: Record<string, PricingFactor> = {
  event_type: { name: 'Event Type', weight: 0.3, description: 'Type of event affects base price' },
  date_time: { name: 'Date & Time', weight: 0.2, description: 'Weekend and holiday premiums' },
  venue: { name: 'Venue', weight: 0.15, description: 'Venue quality and location' },
  marketing: { name: 'Marketing', weight: 0.15, description: 'Marketing campaign effectiveness' },
  competition: { name: 'Competition', weight: 0.1, description: 'Other similar events' },
  weather: { name: 'Weather', weight: 0.1, description: 'Weather forecast impact' },
};

// Attendance factors
export const ATTENDANCE_FACTORS: Record<string, AttendanceFactor> = {
  weekend: { name: 'Weekend', impact: 20, direction: 'positive' },
  holiday: { name: 'Holiday', impact: 30, direction: 'positive' },
  bad_weather: { name: 'Bad Weather', impact: 15, direction: 'negative' },
  competitor: { name: 'Competitor Event', impact: 10, direction: 'negative' },
  reviews: { name: 'Good Reviews', impact: 15, direction: 'positive' },
  early_bird: { name: 'Early Bird Discount', impact: 10, direction: 'positive' },
  social_media: { name: 'Social Media Buzz', impact: 12, direction: 'positive' },
  celebrity: { name: 'Celebrity Appearance', impact: 25, direction: 'positive' },
};

// Marketing channels effectiveness
export const MARKETING_CHANNELS = {
  email: { effectiveness: 0.15, cost: 'low', timeToImpact: 'medium' },
  social_media: { effectiveness: 0.25, cost: 'low', timeToImpact: 'fast' },
  influencer: { effectiveness: 0.2, cost: 'high', timeToImpact: 'fast' },
  paid_ads: { effectiveness: 0.15, cost: 'medium', timeToImpact: 'fast' },
  pr: { effectiveness: 0.1, cost: 'medium', timeToImpact: 'slow' },
  word_of_mouth: { effectiveness: 0.15, cost: 'none', timeToImpact: 'slow' },
};

// Vendor specialization by event type
export const VENDOR_SPECIALIZATION: Record<EventType, VendorCategory[]> = {
  [EventType.CORPORATE]: [VendorCategory.CATERING, VendorCategory.AUDIO_VISUAL, VendorCategory.VENUE, VendorCategory.MARKETING],
  [EventType.SOCIAL]: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY],
  [EventType.ENTERTAINMENT]: [VendorCategory.AUDIO_VISUAL, VendorCategory.SECURITY, VendorCategory.ENTERTAINMENT],
  [EventType.SPORTS]: [VendorCategory.SECURITY, VendorCategory.TRANSPORTATION, VendorCategory.CATERING],
  [EventType.EDUCATIONAL]: [VendorCategory.AUDIO_VISUAL, VendorCategory.VENUE, VendorCategory.CATERING],
  [EventType.CHARITY]: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY],
  [EventType.WEDDING]: [VendorCategory.CATERING, VendorCategory.DECORATION, VendorCategory.PHOTOGRAPHY, VendorCategory.ENTERTAINMENT],
  [EventType.CONFERENCE]: [VendorCategory.VENUE, VendorCategory.AUDIO_VISUAL, VendorCategory.CATERING, VendorCategory.MARKETING],
};

// Satisfaction predictors
export const SATISFACTION_PREDICTORS = {
  venue_quality: 0.25,
  catering_quality: 0.2,
  entertainment: 0.15,
  timing_schedule: 0.15,
  value_for_money: 0.15,
  staff_service: 0.1,
};

export default { EVENT_TYPES, PRICING_FACTORS, ATTENDANCE_FACTORS, MARKETING_CHANNELS, VENDOR_SPECIALIZATION, SATISFACTION_PREDICTORS };