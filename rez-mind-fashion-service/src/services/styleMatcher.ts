import { StyleMatch } from '../models';
import { fashionKnowledge } from '../config/knowledge';
import logger from '../utils/logger';

export interface StyleMatchResult {
  matchId: string;
  customerId: string;
  matches: Array<{ productId: string; name: string; category: string; matchScore: number; reasons: string[] }>;
  styleProfile: { bodyType?: string; preferredStyles: string[]; colorPalette: string[] };
  confidence: number;
  timestamp: Date;
}

class StyleMatcherService {
  async matchStyle(customerId: string, merchantId: string, styleProfile?: { bodyType?: string; stylePreferences?: string[]; colorPreferences?: string[]; budgetRange?: { min: number; max: number } }, limit: number = 10): Promise<StyleMatchResult> {
    logger.info('Matching style', { customerId, merchantId });
    const profile = styleProfile || { preferredStyles: ['casual'], colorPreferences: ['black', 'white'] };
    const matches = this.generateMatches(profile, limit);
    const matchRecord = new StyleMatch({ matchId: `STM-${Date.now().toString(36)}`, customerId, merchantId, styleProfile: { bodyType: profile.bodyType, preferredStyles: profile.stylePreferences || [], preferredColors: profile.colorPreferences || [], sizePreferences: {}, budgetRange: profile.budgetRange }, matches: matches.map(m => ({ productId: m.productId, matchScore: m.matchScore, reasons: m.reasons })), confidence: 0.75 });
    await matchRecord.save();
    return { matchId: matchRecord.matchId, customerId, matches, styleProfile: { bodyType: profile.bodyType, preferredStyles: profile.stylePreferences || [], colorPalette: profile.colorPreferences || [] }, confidence: 0.75, timestamp: new Date() };
  }

  async getCustomerSegments(merchantId: string): Promise<{ segments: Array<{ name: string; count: number; characteristics: string[] }> }> {
    return { segments: [{ name: 'Fashion Forward', count: 25, characteristics: ['Trendy styles', 'Bold colors', 'Premium brands'] }, { name: 'Classic Elegant', count: 30, characteristics: ['Timeless pieces', 'Neutral tones', 'Quality focus'] }, { name: 'Comfort Seeker', count: 35, characteristics: ['Relaxed fits', 'Casual wear', 'Value-oriented'] }] };
  }

  private generateMatches(profile: any, limit: number): Array<{ productId: string; name: string; category: string; matchScore: number; reasons: string[] }> {
    const categories = ['tops', 'bottoms', 'dresses', 'ethnic', 'western'];
    const matches = [];
    for (let i = 0; i < Math.min(limit, 10); i++) {
      const category = categories[i % categories.length];
      const matchScore = Math.round(50 + Math.random() * 40);
      const reasons = [];
      if (profile.stylePreferences?.includes('casual')) reasons.push('Matches casual style');
      if (profile.colorPreferences?.includes('black') || profile.colorPreferences?.includes('white')) reasons.push('Matches preferred colors');
      if (profile.budgetRange) reasons.push('Within budget range');
      matches.push({ productId: `PRD-${i + 1}`, name: `Style Match ${i + 1}`, category, matchScore, reasons: reasons.length > 0 ? reasons : ['General match'] });
    }
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }
}

export const styleMatcherService = new StyleMatcherService();
export default styleMatcherService;