/**
 * Geometry Utilities
 * Helper functions for geospatial calculations
 */

import type { Coordinates } from '../types/index.js';

const EARTH_RADIUS_KM = 6371;

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);
  const deltaLat = toRadians(coord2.lat - coord1.lat);
  const deltaLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 */
export function isPointInPolygon(point: Coordinates, polygon: number[][][]): boolean {
  const [ring] = polygon;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is within a radius of a center point
 */
export function isPointInRadius(point: Coordinates, center: Coordinates, radiusKm: number): boolean {
  return calculateDistance(point, center) <= radiusKm;
}

/**
 * Calculate bounding box for a set of coordinates
 */
export function getBoundingBox(coordinates: Coordinates[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  if (coordinates.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
  }

  let minLat = coordinates[0].lat;
  let maxLat = coordinates[0].lat;
  let minLng = coordinates[0].lng;
  let maxLng = coordinates[0].lng;

  for (const coord of coordinates) {
    if (coord.lat < minLat) minLat = coord.lat;
    if (coord.lat > maxLat) maxLat = coord.lat;
    if (coord.lng < minLng) minLng = coord.lng;
    if (coord.lng > maxLng) maxLng = coord.lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Calculate centroid of a polygon
 */
export function calculateCentroid(polygon: number[][][]): Coordinates {
  const ring = polygon[0];
  let sumLat = 0;
  let sumLng = 0;

  for (const point of ring) {
    sumLng += point[0];
    sumLat += point[1];
  }

  return {
    lat: sumLat / ring.length,
    lng: sumLng / ring.length
  };
}
