import { v4 as uuidv4 } from 'uuid';
import { VendorCategory, EventType } from '../types';
import { VENDOR_SPECIALIZATION } from '../config/knowledge';
import { logger } from '../utils/logger';

interface MatchInput {
  eventId: string;
  eventType: EventType;
  requirements?: string[];
  budget?: number;
}

interface VendorMatchResult {
  matchId: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  matchScore: number;
  compatibility: string[];
  pricing: { min: number; max: number };
  performance: { reliability: number; quality: number; value: number };
  recommendations: string[];
}

export class VendorMatcher {
  async findMatches(input: MatchInput): Promise<VendorMatchResult[]> {
    logger.debug('Finding vendor matches', { eventId: input.eventId, eventType: input.eventType });

    const specialties = VENDOR_SPECIALIZATION[input.eventType] || [VendorCategory.CATERING];
    const matches: VendorMatchResult[] = [];

    const vendorNames: Record<VendorCategory, string[]> = {
      [VendorCategory.CATERING]: ['Gourmet Delights Catering', 'Chef\'s Table Catering', 'Elegant Eats'],
      [VendorCategory.VENUE]: ['Grand Hall Events', 'Skyline Venue', 'Heritage Spaces'],
      [VendorCategory.DECORATION]: ['Blissful Designs', 'Floral Fantasy', 'Event Styling Co'],
      [VendorCategory.AUDIO_VISUAL]: ['SoundWave Productions', 'Visual Solutions Inc', 'Tech Events'],
      [VendorCategory.PHOTOGRAPHY]: ['Captured Moments', 'Lens & Light Studios', 'Memory Makers'],
      [VendorCategory.ENTERTAINMENT]: ['ShowStopper Productions', 'Party Vibes DJ', 'Live Band Agency'],
      [VendorCategory.TRANSPORTATION]: ['Luxury Limo Service', 'Event Shuttle Co', 'VIP Transport'],
      [VendorCategory.SECURITY]: ['Secure Events Inc', 'Safety First Services', 'Event Protection Pro'],
      [VendorCategory.MARKETING]: ['Event Boost Agency', 'Promo Masters', 'Reach Marketing'],
    };

    for (const category of specialties) {
      const names = vendorNames[category] || [`${category} Vendor`];
      for (let i = 0; i < 2; i++) {
        const matchScore = 60 + Math.random() * 35;
        const budgetFit = input.budget ? (matchScore > 75 ? 1.1 : 0.9) : 1;

        matches.push({
          matchId: uuidv4(), vendorId: `vendor-${category}-${i}`,
          vendorName: names[i] || `${category} Services`,
          category,
          matchScore: Math.round(matchScore * budgetFit),
          compatibility: this.getCompatibility(matchScore),
          pricing: { min: 1000 + Math.random() * 5000, max: 15000 + Math.random() * 30000 },
          performance: { reliability: 70 + Math.random() * 25, quality: 70 + Math.random() * 25, value: 65 + Math.random() * 30 },
          recommendations: this.getRecommendations(matchScore),
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  private getCompatibility(score: number): string[] {
    if (score >= 85) return ['Excellent fit', 'Highly recommended', 'Premium option'];
    if (score >= 70) return ['Good fit', 'Recommended', 'Reliable choice'];
    return ['Adequate fit', 'Consider alternatives', 'Budget option'];
  }

  private getRecommendations(score: number): string[] {
    if (score >= 85) return ['Book immediately', 'Request premium package', 'Negotiate for better terms'];
    if (score >= 70) return ['Book early', 'Review contract carefully', 'Ask for references'];
    return ['Compare multiple options', 'Request detailed quotes', 'Check reviews thoroughly'];
  }

  async getPerformanceMetrics(eventId: string): Promise<any> {
    logger.debug('Getting performance metrics', { eventId });
    return {
      eventId,
      avgVendorScore: 75 + Math.random() * 15,
      reliabilityRate: 85 + Math.random() * 10,
      qualityScore: 80 + Math.random() * 15,
      valueScore: 70 + Math.random() * 20,
      topPerformingVendors: ['Gourmet Delights Catering', 'Grand Hall Events'],
      recommendations: ['Maintain relationships with top vendors', 'Develop backup vendor list'],
    };
  }
}

export default VendorMatcher;