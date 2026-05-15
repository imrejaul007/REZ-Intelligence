import { TasteProfile, MerchantVisit, FlywheelStage } from '../types.js';

// In-memory taste profile store
const tasteProfiles: Record<string, TasteProfile> = {};

export class TasteProfileService {
  async update(userId: string, merchantId: string, eventType: string): Promise<{ success: boolean; profile: TasteProfile }> {
    if (!tasteProfiles[userId]) {
      tasteProfiles[userId] = {
        userId,
        merchants: {},
        categories: {},
        updatedAt: new Date().toISOString(),
      };
    }

    const profile = tasteProfiles[userId];

    // Update merchant affinity
    if (!profile.merchants[merchantId]) {
      profile.merchants[merchantId] = {
        visits: 0,
        lastVisit: null,
      };
    }
    profile.merchants[merchantId].visits++;
    profile.merchants[merchantId].lastVisit = new Date().toISOString();

    // Update categories based on event
    if (eventType === 'order') {
      profile.categories[merchantId] = (profile.categories[merchantId] || 0) + 10;
    } else if (eventType === 'browse') {
      profile.categories[merchantId] = (profile.categories[merchantId] || 0) + 2;
    }

    profile.updatedAt = new Date().toISOString();

    return { success: true, profile };
  }

  async get(userId: string): Promise<TasteProfile | null> {
    return tasteProfiles[userId] || null;
  }

  getAllProfiles(): Record<string, TasteProfile> {
    return tasteProfiles;
  }

  clearProfiles(): void {
    Object.keys(tasteProfiles).forEach((key) => delete tasteProfiles[key]);
  }
}

export const tasteProfileService = new TasteProfileService();
