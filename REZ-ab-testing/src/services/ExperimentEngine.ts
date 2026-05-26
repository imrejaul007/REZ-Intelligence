import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import {
  IExperiment,
  VariantConfig,
  SignificanceResult,
} from '../types.js';

export class ExperimentEngine {
  /**
   * Calculate statistical significance using z-test for proportions
   */
  calculateSignificance(
    n1: number,
    c1: number,
    n2: number,
    c2: number
  ): SignificanceResult {
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
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
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
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * absX);
    const y =
      1.0 -
      (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
        Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Check if user matches experiment audience
   */
  matchesAudience(experiment: IExperiment, appId?: string): boolean {
    const { audience } = experiment;

    // Check app filter
    if (audience.apps?.length && appId && !audience.apps.includes(appId)) {
      return false;
    }

    // Check percentage
    if (audience.percentage < 100) {
      const hash = this.hashCode(appId || uuidv4());
      if (hash % 100 > audience.percentage) {
        return false;
      }
    }

    return true;
  }

  /**
   * Assign a variant to a user based on weights
   */
  assignVariant(variants: VariantConfig[]): string {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    // Use crypto for secure random variant assignment
    const random = randomInt(0, totalWeight);

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (random < cumulative) {
        return variant.variantId;
      }
    }

    return variants[0].variantId;
  }

  /**
   * Simple hash function for consistent user sampling
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const experimentEngine = new ExperimentEngine();
