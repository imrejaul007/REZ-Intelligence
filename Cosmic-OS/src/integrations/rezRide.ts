/**
 * ReZ Ride - Cosmic OS Integration
 *
 * Emits mobility signals to Cosmic OS Human Context Graph
 */

import axios from 'axios';

// ============================================
// COSMIC OS CONFIGURATION
// ============================================

const COSMIC_OS_URL = process.env.COSMIC_OS_URL || 'http://localhost:4163';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-ride-internal-token';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
});

// ============================================
// MOBILITY SIGNAL TYPES
// ============================================

export interface MobilitySignal {
  userId: string;
  layer: 'mobility';
  signal: string;
  value: number | string | Record<string, unknown>;
  source: string;
  confidence: number;
}

// ============================================
// SIGNAL EMISSION
// ============================================

export async function emitMobilitySignal(signal: MobilitySignal): Promise<boolean> {
  try {
    await axios.post(
      `${COSMIC_OS_URL}/api/signals`,
      signal,
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch (error) {
    console.error('Failed to emit mobility signal to Cosmic OS:', error);
    return false;
  }
}

// ============================================
// INTEGRATION HOOKS
// ============================================

/**
 * Call this after ride completion
 */
export async function onRideComplete(
  userId: string,
  rideData: {
    type: 'bike' | 'auto' | 'cab' | 'suv';
    distance: number;
    duration: number;
    destination: string;
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'ride_completed',
    value: rideData,
    source: 'rez-ride',
    confidence: 0.95,
  });
}

/**
 * Call this after commute pattern detected
 */
export async function onCommutePattern(
  userId: string,
  pattern: {
    route: string;
    frequency: number;
    typicalTime: string;
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'commute_pattern',
    value: pattern,
    source: 'rez-ride',
    confidence: 0.9,
  });
}

/**
 * Call this after travel activity
 */
export async function onTravelActivity(
  userId: string,
  travelData: {
    destination: string;
    type: 'local' | 'outstation' | 'rental';
    duration: number;
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'travel_activity',
    value: travelData,
    source: 'rez-ride',
    confidence: 0.85,
  });
}

/**
 * Call this when new destination is explored
 */
export async function onNewDestination(
  userId: string,
  destination: {
    name: string;
    type: 'restaurant' | 'shop' | 'recreation' | 'other';
    area: string;
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'exploration',
    value: destination,
    source: 'rez-ride',
    confidence: 0.8,
  });
}

/**
 * Call this after rental service use
 */
export async function onRentalService(
  userId: string,
  rentalData: {
    vehicleType: 'auto' | 'sedan' | 'suv';
    hours: number;
    purpose: 'business' | 'personal' | 'travel';
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'rental_service',
    value: rentalData,
    source: 'rez-ride',
    confidence: 0.85,
  });
}

/**
 * Call this to update frequent routes
 */
export async function onFrequentRoute(
  userId: string,
  route: {
    from: string;
    to: string;
    frequency: number;
    averageFare: number;
  }
): Promise<void> {
  await emitMobilitySignal({
    userId,
    layer: 'mobility',
    signal: 'frequent_route',
    value: route,
    source: 'rez-ride',
    confidence: 0.9,
  });
}
