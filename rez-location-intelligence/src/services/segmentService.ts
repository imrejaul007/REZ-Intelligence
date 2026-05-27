/**
 * Segment Service
 * Classification of users into behavioral segments based on location data
 */

import type { LocationVisit, LocationPattern, UserSegment } from '../types/index.js';

interface SegmentCriteria {
  name: UserSegment;
  priority: number;
}

const SEGMENT_THRESHOLDS = {
  PREMIUM_MALL_MIN_VISITS: 5,
  PREMIUM_MALL_MIN_RATIO: 0.3,
  COMMUTER_WEEKDAY_RATIO: 0.7,
  COMMUTER_MIN_VISITS: 8,
  TRAVELER_MIN_AIRPORT_VISITS: 3,
  FOODIE_RESTAURANT_RATIO: 0.4,
  FOODIE_MIN_VISITS: 6,
  FITNESS_GYM_RATIO: 0.5,
  EXPLORER_UNIQUE_LOCATIONS: 10,
  EXPLORER_MIN_VISITS: 15,
  FOOTFALL_SEEKER_VISITS: 20
};

/**
 * Check if user is a premium mall visitor
 */
function isPremiumMallVisitor(visits: LocationVisit[]): boolean {
  if (visits.length < SEGMENT_THRESHOLDS.PREMIUM_MALL_MIN_VISITS) return false;

  const mallVisits = visits.filter(v => v.locationType === 'mall');
  if (mallVisits.length < SEGMENT_THRESHOLDS.PREMIUM_MALL_MIN_VISITS) return false;

  const mallRatio = mallVisits.length / visits.length;
  if (mallRatio < SEGMENT_THRESHOLDS.PREMIUM_MALL_MIN_RATIO) return false;

  // Check for premium zone visits (metadata-based)
  const premiumMallVisits = mallVisits.filter(v =>
    v.metadata && (v.metadata as Record<string, unknown>).premium === true
  );

  return premiumMallVisits.length > 0 || mallVisits.length >= SEGMENT_THRESHOLDS.PREMIUM_MALL_MIN_VISITS;
}

/**
 * Check if user is an office commuter
 */
function isOfficeCommuter(visits: LocationVisit[]): boolean {
  if (visits.length < SEGMENT_THRESHOLDS.COMMUTER_MIN_VISITS) return false;

  // Check for commuter pattern (patterns would be used here in real implementation)
  const weekdayRatio = visits.filter(v => {
    const day = new Date(v.timestamp).getDay();
    return day >= 1 && day <= 5;
  }).length / Math.max(visits.length, 1);

  if (weekdayRatio >= SEGMENT_THRESHOLDS.COMMUTER_WEEKDAY_RATIO) return true;

  // Alternative: Check weekday ratio and office visits
  const weekdays = visits.filter(v => {
    const day = new Date(v.timestamp).getDay();
    return day >= 1 && day <= 5;
  });

  const altWeekdayRatio = weekdays.length / visits.length;
  const officeVisits = visits.filter(v => v.locationType === 'office');

  return altWeekdayRatio >= SEGMENT_THRESHOLDS.COMMUTER_WEEKDAY_RATIO && officeVisits.length >= 3;
}

/**
 * Check if user is a college student
 */
function isCollegeStudent(visits: LocationVisit[]): boolean {
  const collegeVisits = visits.filter(v => v.locationType === 'college');
  if (collegeVisits.length < 3) return false;

  // Students have visits on weekdays during school hours (8am - 5pm)
  const schoolHours = collegeVisits.filter(v => {
    const hour = new Date(v.timestamp).getHours();
    return hour >= 8 && hour <= 17;
  });

  // Check for consistent day patterns (Mon-Fri)
  const days = new Set(collegeVisits.map(v =>
    new Date(v.timestamp).toISOString().split('T')[0]
  ));

  return schoolHours.length >= collegeVisits.length * 0.6 && days.size >= 3;
}

/**
 * Check if user is a frequent traveler
 */
function isFrequentTraveler(visits: LocationVisit[]): boolean {
  // Check airport visits
  const airportVisits = visits.filter(v => v.locationType === 'airport');
  if (airportVisits.length >= SEGMENT_THRESHOLDS.TRAVELER_MIN_AIRPORT_VISITS) return true;

  // Check for multiple city visits
  const uniqueZones = new Set(visits.map(v => v.zone));
  return uniqueZones.size >= 3 && visits.length >= 10;
}

/**
 * Check if user is a high footfall seeker
 */
function isHighFootfallSeeker(visits: LocationVisit[]): boolean {
  if (visits.length < SEGMENT_THRESHOLDS.FOOTFALL_SEEKER_VISITS) return false;

  // Check for many different zones
  const uniqueZones = new Set(visits.map(v => v.zone));
  const zoneRatio = uniqueZones.size / visits.length;

  // High footfall seekers visit many places
  return visits.length >= SEGMENT_THRESHOLDS.FOOTFALL_SEEKER_VISITS && zoneRatio >= 0.3;
}

/**
 * Check if user is a food enthusiast
 */
function isFoodEnthusiast(visits: LocationVisit[]): boolean {
  if (visits.length < SEGMENT_THRESHOLDS.FOODIE_MIN_VISITS) return false;

  // Check restaurant ratio
  const restaurantVisits = visits.filter(v => v.locationType === 'restaurant');
  const restaurantRatio = restaurantVisits.length / visits.length;
  return restaurantRatio >= SEGMENT_THRESHOLDS.FOODIE_RESTAURANT_RATIO;
}

/**
 * Check if user is fitness focused
 */
function isFitnessFocused(visits: LocationVisit[]): boolean {
  // Check gym visit ratio
  const gymVisits = visits.filter(v => v.locationType === 'gym');
  if (gymVisits.length < 4) return false;

  const gymRatio = gymVisits.length / visits.length;
  return gymRatio >= SEGMENT_THRESHOLDS.FITNESS_GYM_RATIO;
}

/**
 * Check if user is an explorer
 */
function isExplorer(visits: LocationVisit[]): boolean {
  if (visits.length < SEGMENT_THRESHOLDS.EXPLORER_MIN_VISITS) return false;

  // High location diversity
  const uniqueLocations = new Set(visits.map(v => v.locationId));
  return uniqueLocations.size >= SEGMENT_THRESHOLDS.EXPLORER_UNIQUE_LOCATIONS;
}

/**
 * Classify a user into segments based on their visits and patterns
 */
export function classifyUserSegments(
  visits: LocationVisit[],
  _patterns?: LocationPattern[]
): UserSegment[] {
  const segments: UserSegment[] = [];

  // Run each check function
  if (isPremiumMallVisitor(visits)) segments.push('premium_mall_visitor');
  if (isOfficeCommuter(visits)) segments.push('office_commuter');
  if (isCollegeStudent(visits)) segments.push('college_student');
  if (isFrequentTraveler(visits)) segments.push('frequent_traveler');
  if (isFoodEnthusiast(visits)) segments.push('food_enthusiast');
  if (isFitnessFocused(visits)) segments.push('fitness_focused');
  if (isHighFootfallSeeker(visits)) segments.push('high_footfall_seeker');
  if (isExplorer(visits)) segments.push('explorer');

  return segments;
}

/**
 * Get segment descriptions
 */
export function getSegmentDescription(segment: UserSegment): string {
  const descriptions: Record<UserSegment, string> = {
    premium_mall_visitor: 'Frequently visits premium shopping malls',
    office_commuter: 'Shows regular office location patterns',
    college_student: 'Frequent visitor to college campus',
    frequent_traveler: 'Regular airport user with multi-city visits',
    high_footfall_seeker: 'Actively visits high-traffic zones',
    food_enthusiast: 'Restaurant-focused with varied dining',
    fitness_focused: 'Regular gym or fitness center visitor',
    explorer: 'High location diversity, tries new places'
  };

  return descriptions[segment];
}

/**
 * Get all available segments
 */
export function getAllSegments(): UserSegment[] {
  return [
    'premium_mall_visitor',
    'office_commuter',
    'college_student',
    'frequent_traveler',
    'high_footfall_seeker',
    'food_enthusiast',
    'fitness_focused',
    'explorer'
  ];
}

// Service class for dependency injection
export class SegmentService {
  classify(visits: LocationVisit[], patterns?: LocationPattern[]): UserSegment[] {
    return classifyUserSegments(visits, patterns);
  }

  getDescription(segment: UserSegment): string {
    return getSegmentDescription(segment);
  }

  getAll(): UserSegment[] {
    return getAllSegments();
  }
}

export const segmentService = new SegmentService();
