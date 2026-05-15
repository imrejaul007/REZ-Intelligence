/**
 * Pattern Detection Service
 * Algorithms for detecting user location patterns
 */

import type {
  LocationVisit,
  LocationPattern,
  PatternType,
  PatternFrequency
} from '../types/index.js';
import {
  getDayName,
  isWeekend,
  isWeekday,
  getHour,
  isBusinessHours,
  getDateDiffInDays
} from '../utils/dateUtils.js';

const CONFIDENCE_THRESHOLD = 0.7;
const MIN_VISITS_FOR_PATTERN = 5;
const DAYS_TO_ANALYZE = 30;

interface PatternStats {
  locationCounts: Map<string, number>;
  dayCounts: Map<string, number>;
  hourCounts: Map<number, number>;
  totalVisits: number;
  uniqueLocations: number;
  locationTypes: Map<string, number>;
  dateRange: { start: Date; end: Date };
}

/**
 * Analyze visit data and extract statistics
 */
function analyzeVisits(visits: LocationVisit[]): PatternStats {
  const locationCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  const locationTypes = new Map<string, number>();

  let totalVisits = visits.length;
  let minDate = new Date();
  let maxDate = new Date(0);

  for (const visit of visits) {
    // Location counts
    locationCounts.set(visit.locationId, (locationCounts.get(visit.locationId) || 0) + 1);

    // Day counts
    const day = getDayName(new Date(visit.timestamp));
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);

    // Hour counts
    const hour = getHour(new Date(visit.timestamp));
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    // Location type counts
    locationTypes.set(visit.locationType, (locationTypes.get(visit.locationType) || 0) + 1);

    // Date range
    const visitDate = new Date(visit.timestamp);
    if (visitDate < minDate) minDate = visitDate;
    if (visitDate > maxDate) maxDate = visitDate;
  }

  return {
    locationCounts,
    dayCounts,
    hourCounts,
    totalVisits,
    uniqueLocations: locationCounts.size,
    locationTypes,
    dateRange: { start: minDate, end: maxDate }
  };
}

/**
 * Calculate most frequent items from a map
 */
function getTopItems<T>(map: Map<T, number>, n: number): T[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
}

/**
 * Calculate ratio of visits matching a condition
 */
function calculateRatio(
  visits: LocationVisit[],
  condition: (visit: LocationVisit) => boolean
): number {
  if (visits.length === 0) return 0;
  const matching = visits.filter(condition).length;
  return matching / visits.length;
}

/**
 * Detect commuter pattern
 * Criteria: Office visits Mon-Fri, 9-6pm, same location
 */
export function detectCommuterPattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // Must have significant weekday visits
  const weekdayRatio = calculateRatio(visits, v => isWeekday(new Date(v.timestamp)));
  if (weekdayRatio < 0.6) return null;

  // Must have visits during business hours
  const businessHourRatio = calculateRatio(visits, v => isBusinessHours(new Date(v.timestamp)));
  if (businessHourRatio < 0.5) return null;

  // Should be mostly one location (office)
  const topLocationRatio = stats.locationCounts.get(getTopItems(stats.locationCounts, 1)[0] || '') || 0;
  const locationConsistency = topLocationRatio / stats.totalVisits;
  if (locationConsistency < 0.4) return null;

  // Calculate confidence
  let confidence = 0;
  confidence += weekdayRatio * 0.3;
  confidence += businessHourRatio * 0.3;
  confidence += locationConsistency * 0.4;

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  // Determine peak hours
  const peakHours = getTopItems(stats.hourCounts, 3);

  return {
    type: 'commuter',
    confidence,
    locations: getTopItems(stats.locationCounts, 3),
    frequency: determineFrequency(stats.dateRange, stats.totalVisits),
    peakDays: getTopItems(stats.dayCounts, 5).filter(d => isWeekday(new Date(`2024-01-${getDayNumber(d)}`))),
    peakHours,
    detectedAt: new Date()
  };
}

function getDayNumber(dayName: string): number {
  const days: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6
  };
  return days[dayName] || 1;
}

/**
 * Detect mall-goer pattern
 * Criteria: Mall visits, weekend heavy, premium zones
 */
export function detectMallGoerPattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // Must have significant mall visits
  const mallVisits = visits.filter(v => v.locationType === 'mall');
  if (mallVisits.length < 3) return null;

  const mallRatio = mallVisits.length / stats.totalVisits;
  if (mallRatio < 0.3) return null;

  // Weekend preference
  const weekendRatio = calculateRatio(visits, v => isWeekend(new Date(v.timestamp)));
  if (weekendRatio < 0.35) return null;

  // Calculate confidence
  let confidence = 0;
  confidence += mallRatio * 0.4;
  confidence += weekendRatio * 0.4;
  confidence += (stats.uniqueLocations > 1 ? 0.2 : 0); // Multiple malls bonus

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    type: 'mall_goer',
    confidence,
    locations: getTopItems(stats.locationCounts, 5),
    frequency: determineFrequency(stats.dateRange, stats.totalVisits),
    peakDays: getTopItems(stats.dayCounts, 2),
    peakHours: [12, 13, 14, 15, 16, 17, 18], // Afternoon/evening preference
    detectedAt: new Date()
  };
}

/**
 * Detect traveler pattern
 * Criteria: Airport visits, multiple cities, irregular pattern
 */
export function detectTravelerPattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // Must have airport visits
  const airportVisits = visits.filter(v => v.locationType === 'airport');
  if (airportVisits.length < 2) return null;

  // Check for multiple unique locations (different cities)
  if (stats.uniqueLocations < 3) return null;

  // Airport frequency
  const airportRatio = airportVisits.length / stats.totalVisits;

  // Check for irregular timing (travelers don't have consistent patterns)
  const dateDiffs: number[] = [];
  const sortedVisits = [...visits].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sortedVisits.length; i++) {
    dateDiffs.push(getDateDiffInDays(
      new Date(sortedVisits[i - 1].timestamp),
      new Date(sortedVisits[i].timestamp)
    ));
  }

  const avgDaysBetween = dateDiffs.length > 0
    ? dateDiffs.reduce((a, b) => a + b, 0) / dateDiffs.length
    : 30;

  // Travelers have irregular, spread-out visits
  const irregularPattern = avgDaysBetween > 5;

  let confidence = 0;
  confidence += Math.min(airportRatio * 2, 0.4); // Airport presence
  confidence += irregularPattern ? 0.3 : 0; // Irregular timing
  confidence += Math.min(stats.uniqueLocations / 10, 0.3); // Location diversity

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    type: 'traveler',
    confidence,
    locations: getTopItems(stats.locationCounts, 5),
    frequency: 'occasional',
    peakDays: [],
    peakHours: getTopItems(stats.hourCounts, 4),
    detectedAt: new Date()
  };
}

/**
 * Detect gym enthusiast pattern
 * Criteria: Regular gym visits, consistent times, high frequency
 */
export function detectGymEnthusiastPattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // Must have significant gym visits
  const gymVisits = visits.filter(v => v.locationType === 'gym');
  if (gymVisits.length < 4) return null;

  const gymRatio = gymVisits.length / stats.totalVisits;
  if (gymRatio < 0.4) return null;

  // Check for time consistency (same hours)
  const gymHours = gymVisits.map(v => getHour(new Date(v.timestamp)));
  const uniqueHours = new Set(gymHours).size;

  // Enthusiasts go at similar times
  const hourConsistency = 1 - (uniqueHours / 24);

  // Check for day consistency
  const gymDays = gymVisits.map(v => getDayName(new Date(v.timestamp)));
  const uniqueDays = new Set(gymDays).size;

  // Enthusiasts go multiple days per week
  const dayConsistency = uniqueDays >= 3 ? 0.4 : uniqueDays >= 2 ? 0.2 : 0;

  let confidence = 0;
  confidence += gymRatio * 0.4;
  confidence += hourConsistency * 0.3;
  confidence += dayConsistency;

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    type: 'gym_enthusiast',
    confidence,
    locations: getTopItems(stats.locationCounts, 3),
    frequency: determineFrequency(stats.dateRange, stats.totalVisits),
    peakDays: Array.from(new Set(gymDays)),
    peakHours: getTopItems(stats.hourCounts, 2),
    detectedAt: new Date()
  };
}

/**
 * Detect foodie pattern
 * Criteria: Restaurant visits, varied cuisine zones, dinner focus
 */
export function detectFoodiePattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // Must have significant restaurant visits
  const restaurantVisits = visits.filter(v => v.locationType === 'restaurant');
  if (restaurantVisits.length < 4) return null;

  const restaurantRatio = restaurantVisits.length / stats.totalVisits;
  if (restaurantRatio < 0.35) return null;

  // Dinner preference (6pm - 10pm)
  const dinnerRatio = calculateRatio(
    restaurantVisits,
    v => {
      const hour = getHour(new Date(v.timestamp));
      return hour >= 18 && hour <= 22;
    }
  );

  // Weekend dining
  const weekendDiningRatio = calculateRatio(restaurantVisits, v => isWeekend(new Date(v.timestamp)));

  // Variety in locations (tries different restaurants)
  const locationVariety = Math.min(stats.uniqueLocations / 20, 0.3);

  let confidence = 0;
  confidence += restaurantRatio * 0.35;
  confidence += dinnerRatio * 0.25;
  confidence += weekendDiningRatio * 0.2;
  confidence += locationVariety;

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    type: 'foodie',
    confidence,
    locations: getTopItems(stats.locationCounts, 5),
    frequency: determineFrequency(stats.dateRange, stats.totalVisits),
    peakDays: getTopItems(stats.dayCounts, 2),
    peakHours: [19, 20, 21, 12, 13], // Dinner hours
    detectedAt: new Date()
  };
}

/**
 * Detect explorer pattern
 * Criteria: High location diversity, varied zones, low repetition
 */
export function detectExplorerPattern(visits: LocationVisit[]): LocationPattern | null {
  if (visits.length < MIN_VISITS_FOR_PATTERN) return null;

  const stats = analyzeVisits(visits);

  // High location diversity
  const diversityRatio = stats.uniqueLocations / stats.totalVisits;
  if (diversityRatio < 0.5) return null;

  // Low repetition at any single location
  const maxLocationVisits = Math.max(...Array.from(stats.locationCounts.values()));
  const maxLocationRatio = maxLocationVisits / stats.totalVisits;
  if (maxLocationRatio > 0.4) return null;

  // Varied location types
  const locationTypeVariety = stats.locationTypes.size;
  if (locationTypeVariety < 3) return null;

  let confidence = 0;
  confidence += diversityRatio * 0.4;
  confidence += Math.min(locationTypeVariety / 8, 0.3);
  confidence += (1 - maxLocationRatio) * 0.3;

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    type: 'explorer',
    confidence,
    locations: getTopItems(stats.locationCounts, 10),
    frequency: determineFrequency(stats.dateRange, stats.totalVisits),
    peakDays: [],
    peakHours: getTopItems(stats.hourCounts, 5),
    detectedAt: new Date()
  };
}

/**
 * Determine visit frequency based on date range and total visits
 */
function determineFrequency(dateRange: { start: Date; end: Date }, totalVisits: number): PatternFrequency {
  const totalDays = getDateDiffInDays(dateRange.end, dateRange.start) || 1;
  const visitsPerDay = totalVisits / totalDays;

  if (visitsPerDay >= 0.8) return 'daily';
  if (visitsPerDay >= 0.15) return 'weekly';
  return 'occasional';
}

/**
 * Detect all patterns for a set of visits
 */
export function detectAllPatterns(visits: LocationVisit[]): LocationPattern[] {
  const patterns: LocationPattern[] = [];

  const detectors = [
    detectCommuterPattern,
    detectMallGoerPattern,
    detectTravelerPattern,
    detectGymEnthusiastPattern,
    detectFoodiePattern,
    detectExplorerPattern
  ];

  for (const detector of detectors) {
    const pattern = detector(visits);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

/**
 * Get the primary pattern (highest confidence)
 */
export function getPrimaryPattern(visits: LocationVisit[]): LocationPattern | null {
  const patterns = detectAllPatterns(visits);

  if (patterns.length === 0) return null;

  return patterns.reduce((max, p) => p.confidence > max.confidence ? p : max);
}
