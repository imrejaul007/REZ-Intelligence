import { StatisticalSignificance } from '../types/index.js';

/**
 * Calculate statistical significance using z-test for proportions
 */
export function calculateSignificance(
  n1: number,
  c1: number,
  n2: number,
  c2: number
): StatisticalSignificance {
  if (n1 === 0 || n2 === 0) {
    return { pValue: 1, significant: false, uplift: 0 };
  }

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pooledP = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) {
    return { pValue: 1, significant: false, uplift: 0 };
  }

  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const uplift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;

  return {
    pValue,
    significant: pValue < 0.05,
    uplift,
  };
}

/**
 * Approximation of the cumulative distribution function of the standard normal distribution
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1.0 + sign * y);
}

/**
 * Simple hash function for consistent user assignment
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Assign variant based on weights
 */
export function assignVariant<T extends { variantId: string; weight: number }>(
  variants: T[],
  userId: string
): string {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const random = hashCode(userId) % totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (random < cumulative) {
      return variant.variantId;
    }
  }

  return variants[0]?.variantId || '';
}
