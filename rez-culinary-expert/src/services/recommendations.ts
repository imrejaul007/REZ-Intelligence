/**
 * Recommendations Service
 * Handles food recommendations, pairing suggestions, and personalization
 */

import { Db, Collection } from 'mongodb';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { type MenuItem } from './menuService';
import { PAIRING_GUIDE, matchCuisine } from '../config/knowledge';
import { DietaryService, getDietaryService } from './dietaryService';

export interface RecommendationContext {
  userId?: string;
  occasion?: 'casual' | 'date' | 'business' | 'family' | 'celebration' | 'quick';
  timeOfDay?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'late-night';
  budget?: 'budget' | 'moderate' | 'premium' | 'luxury';
  mood?: 'adventurous' | 'comfort' | 'healthy' | 'indulgent' | 'light' | 'hearty';
  cuisinePreference?: string;
  groupSize?: number;
}

export interface Recommendation {
  item: MenuItem;
  score: number;
  reasons: string[];
  pairings: string[];
  matchFactors: string[];
}

export interface MealPlan {
  name: string;
  items: MenuItem[];
  totalPrice: number;
  totalCalories?: number;
  dietaryTags: string[];
}

export class RecommendationsService {
  private db: Db | null = null;
  private redis: Redis | null = null;
  private dietaryService: DietaryService;
  private recommendationsCollection: Collection | null = null;
  private initialized = false;

  constructor() {
    this.dietaryService = getDietaryService();
  }

  async initialize(db: Db, redis: Redis): Promise<void> {
    this.db = db;
    this.redis = redis;
    this.recommendationsCollection = db.collection('recommendations');

    // Create indexes for personalization
    await this.recommendationsCollection?.createIndex({ userId: 1, itemId: 1 });
    await this.recommendationsCollection?.createIndex({ userId: 1, score: -1 });

    this.initialized = true;
    logger.info('RecommendationsService initialized');
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    menuItems: MenuItem[],
    context: RecommendationContext,
    limit = 5
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get user preferences
    const userProfile = await this.dietaryService.getUserProfile(userId);

    for (const item of menuItems) {
      if (!item.available) continue;

      const { isCompatible } = await this.dietaryService.checkDishCompatibility(
        userId,
        item.description,
        item.allergens,
        item.dietaryTags
      );

      if (!isCompatible && !context.cuisinePreference) continue;

      let score = 50; // Base score
      const reasons: string[] = [];
      const matchFactors: string[] = [];

      // Apply scoring based on various factors

      // Cuisine preference matching
      if (context.cuisinePreference && item.cuisine) {
        const preferredCuisine = matchCuisine(context.cuisinePreference);
        if (preferredCuisine && item.cuisine.toLowerCase().includes(preferredCuisine.name.toLowerCase())) {
          score += 25;
          reasons.push(`Matches your ${context.cuisinePreference} preference`);
          matchFactors.push('cuisine');
        }
      }

      // User cuisine history
      if (userProfile?.preferences.preferredCuisines) {
        const historyMatch = userProfile.preferences.preferredCuisines.some(
          pref => item.cuisine?.toLowerCase().includes(pref.toLowerCase())
        );
        if (historyMatch) {
          score += 15;
          reasons.push('Based on your favorites');
          matchFactors.push('history');
        }
      }

      // Dietary tag matching
      if (userProfile?.restrictions) {
        const matchingTags = item.dietaryTags.filter(tag =>
          userProfile.restrictions.includes(tag)
        );
        if (matchingTags.length > 0) {
          score += 20 * matchingTags.length;
          reasons.push(`Suitable for ${matchingTags.join(', ')}`);
          matchFactors.push('dietary');
        }
      }

      // Mood-based scoring
      if (context.mood) {
        const moodScore = this.getMoodScore(item, context.mood);
        score += moodScore;
        if (moodScore > 0) {
          matchFactors.push('mood');
        }
      }

      // Occasion-based scoring
      if (context.occasion) {
        const occasionScore = this.getOccasionScore(item, context.occasion);
        score += occasionScore;
        if (occasionScore > 0) {
          matchFactors.push('occasion');
        }
      }

      // Time of day scoring
      if (context.timeOfDay) {
        const timeScore = this.getTimeOfDayScore(item, context.timeOfDay);
        score += timeScore;
        if (timeScore > 0) {
          matchFactors.push('time');
        }
      }

      // Budget scoring
      if (context.budget && item.price) {
        const budgetScore = this.getBudgetScore(item.price, context.budget);
        score += budgetScore;
        if (budgetScore > 0) {
          matchFactors.push('budget');
        }
      }

      // Signature item bonus
      if (item.isSignature) {
        score += 10;
        reasons.push('Chef\'s specialty');
        matchFactors.push('signature');
      }

      // Cap score at 100
      score = Math.min(score, 100);

      if (score >= 50) {
        recommendations.push({
          item,
          score,
          reasons: reasons.length > 0 ? reasons : ['Great choice'],
          pairings: this.getPairingSuggestions(item),
          matchFactors,
        });
      }
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get pairing suggestions for an item
   */
  getPairingSuggestions(item: MenuItem): string[] {
    const pairings: string[] = [];

    // Wine pairings
    const winePairings = PAIRING_GUIDE.WINE;
    for (const [category, dishes] of Object.entries(winePairings)) {
      if (Array.isArray(dishes)) {
        const matches = dishes.some(d =>
          item.name.toLowerCase().includes(d.toLowerCase()) ||
          item.description.toLowerCase().includes(d.toLowerCase())
        );
        if (matches && category !== 'sparkling') {
          const wineType = this.getWineForCategory(category);
          if (wineType) pairings.push(wineType);
        }
      }
    }

    // Beer pairings
    const beerPairings = PAIRING_GUIDE.BEER;
    for (const [category, dishes] of Object.entries(beerPairings)) {
      if (Array.isArray(dishes)) {
        const matches = dishes.some(d =>
          item.name.toLowerCase().includes(d.toLowerCase()) ||
          item.description.toLowerCase().includes(d.toLowerCase())
        );
        if (matches) {
          const beerType = this.getBeerForCategory(category);
          if (beerType) pairings.push(beerType);
        }
      }
    }

    // Add general suggestions based on cuisine or main ingredients
    if (item.cuisine) {
      const cuisinePairing = this.getCuisineDefaultPairing(item.cuisine);
      if (cuisinePairing && !pairings.includes(cuisinePairing)) {
        pairings.push(cuisinePairing);
      }
    }

    return pairings.slice(0, 3);
  }

  /**
   * Build a complete meal plan
   */
  async buildMealPlan(
    userId: string,
    menuItems: MenuItem[],
    context: RecommendationContext
  ): Promise<MealPlan> {
    const recommendations = await this.getPersonalizedRecommendations(
      userId,
      menuItems,
      context,
      10
    );

    const mealItems: MenuItem[] = [];
    let totalPrice = 0;
    let totalCalories = 0;
    const dietaryTags = new Set<string>();

    // Select items based on meal type
    const starterCategories = ['appetizer', 'starter', 'soup', 'salad'];
    const mainCategories = ['main', 'entree', 'main course'];
    const dessertCategories = ['dessert', 'sweet'];

    // Add a starter
    const starters = recommendations.filter(r => {
      const cat = r.item.category.toLowerCase();
      return starterCategories.some(s => cat.includes(s));
    });
    if (starters.length > 0 && context.occasion !== 'quick') {
      mealItems.push(starters[0].item);
      totalPrice += starters[0].item.price;
      if (starters[0].item.calories) totalCalories += starters[0].item.calories;
      starters[0].item.dietaryTags.forEach(t => dietaryTags.add(t));
    }

    // Add a main course
    const mains = recommendations.filter(r => {
      const cat = r.item.category.toLowerCase();
      return mainCategories.some(m => cat.includes(m));
    });
    if (mains.length > 0) {
      mealItems.push(mains[0].item);
      totalPrice += mains[0].item.price;
      if (mains[0].item.calories) totalCalories += mains[0].item.calories;
      mains[0].item.dietaryTags.forEach(t => dietaryTags.add(t));
    }

    // Add a dessert for special occasions
    if (context.occasion === 'celebration' || context.occasion === 'date') {
      const desserts = recommendations.filter(r => {
        const cat = r.item.category.toLowerCase();
        return dessertCategories.some(d => cat.includes(d));
      });
      if (desserts.length > 0) {
        mealItems.push(desserts[0].item);
        totalPrice += desserts[0].item.price;
        if (desserts[0].item.calories) totalCalories += desserts[0].item.calories;
        desserts[0].item.dietaryTags.forEach(t => dietaryTags.add(t));
      }
    }

    return {
      name: this.generateMealPlanName(context),
      items: mealItems,
      totalPrice,
      totalCalories: totalCalories > 0 ? totalCalories : undefined,
      dietaryTags: Array.from(dietaryTags),
    };
  }

  /**
   * Generate complementary item suggestions
   */
  async getComplementaryItems(
    userId: string,
    selectedItem: MenuItem,
    menuItems: MenuItem[]
  ): Promise<Recommendation[]> {
    const availableItems = menuItems.filter(item =>
      item.id !== selectedItem.id && item.available
    );

    const recommendations: Recommendation[] = [];

    for (const item of availableItems) {
      const { isCompatible } = await this.dietaryService.checkDishCompatibility(
        userId,
        item.description,
        item.allergens,
        item.dietaryTags
      );

      if (!isCompatible) continue;

      let score = 30;
      const reasons: string[] = [];

      // Check if it's a good accompaniment
      const cat = item.category.toLowerCase();

      // Sides for mains
      if (cat.includes('main') || cat.includes('entree')) {
        if (selectedItem.category.toLowerCase().includes('appetizer')) {
          score += 30;
          reasons.push('Continue with a main course');
        }
      }

      // Drinks for food
      if (cat.includes('beverage') || cat.includes('drink')) {
        score += 25;
        reasons.push('Pairs well');
        const pairings = this.getPairingSuggestions(selectedItem);
        if (pairings.some(p => item.name.toLowerCase().includes(p.toLowerCase()))) {
          score += 20;
          reasons.push('Suggested pairing');
        }
      }

      // Desserts for mains
      if (cat.includes('dessert')) {
        if (selectedItem.category.toLowerCase().includes('main') ||
            selectedItem.category.toLowerCase().includes('entree')) {
          score += 20;
          reasons.push('Sweet ending');
        }
      }

      // Sides for mains
      if (cat.includes('side') || cat.includes('accompaniment')) {
        if (selectedItem.category.toLowerCase().includes('main')) {
          score += 35;
          reasons.push('Perfect side dish');
        }
      }

      recommendations.push({
        item,
        score,
        reasons: reasons.length > 0 ? reasons : ['Good choice'],
        pairings: [],
        matchFactors: ['complementary'],
      });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * Get wine recommendation for a dish
   */
  getWineRecommendation(item: MenuItem): string {
    const pairings = this.getPairingSuggestions(item);
    const winePairing = pairings.find(p =>
      p.toLowerCase().includes('wine') ||
      ['red', 'white', 'rosé', 'sparkling'].some(w => p.toLowerCase().includes(w))
    );
    return winePairing || this.getDefaultWinePairing(item);
  }

  // Helper methods

  private getMoodScore(item: MenuItem, mood: string): number {
    const moodLower = mood.toLowerCase();
    const description = `${item.name} ${item.description}`.toLowerCase();
    const tags = item.dietaryTags.map(t => t.toLowerCase());

    switch (moodLower) {
      case 'comfort':
        if (tags.includes('comfort') || description.includes('creamy') || description.includes('rich')) {
          return 20;
        }
        break;
      case 'healthy':
        if (tags.includes('healthy') || tags.includes('gluten-free') || tags.includes('vegan')) {
          return 20;
        }
        break;
      case 'indulgent':
        if (description.includes('rich') || description.includes('decadent') || description.includes('truffle')) {
          return 20;
        }
        break;
      case 'light':
        if (tags.includes('light') || description.includes('fresh') || description.includes('grilled')) {
          return 20;
        }
        break;
      case 'adventurous':
        if (item.spiceLevel && ['hot', 'extra-hot'].includes(item.spiceLevel)) {
          return 15;
        }
        if (item.isSignature) {
          return 10;
        }
        break;
      case 'hearty':
        if (description.includes('hearty') || description.includes('filling') || description.includes('generous')) {
          return 20;
        }
        break;
    }

    return 0;
  }

  private getOccasionScore(item: MenuItem, occasion: string): number {
    const occasionLower = occasion.toLowerCase();
    const description = `${item.name} ${item.description}`.toLowerCase();

    switch (occasionLower) {
      case 'celebration':
      case 'date':
        if (item.isSignature || description.includes('premium') || description.includes('chef')) {
          return 25;
        }
        break;
      case 'business':
        if (description.includes('professional') || item.isSignature) {
          return 20;
        }
        break;
      case 'family':
        if (description.includes('shareable') || description.includes('family')) {
          return 20;
        }
        break;
      case 'casual':
        return 10;
      case 'quick':
        if (item.prepTime && item.prepTime < 15) {
          return 20;
        }
        break;
    }

    return 0;
  }

  private getTimeOfDayScore(item: MenuItem, timeOfDay: string): number {
    const category = item.category.toLowerCase();

    switch (timeOfDay) {
      case 'breakfast':
        if (category.includes('breakfast') || category.includes('brunch')) {
          return 25;
        }
        break;
      case 'lunch':
        if (category.includes('lunch') || category.includes('sandwich') || category.includes('salad')) {
          return 15;
        }
        break;
      case 'dinner':
        if (category.includes('dinner') || category.includes('main') || category.includes('entree')) {
          return 15;
        }
        break;
      case 'snack':
        if (category.includes('snack') || category.includes('appetizer')) {
          return 15;
        }
        break;
    }

    return 0;
  }

  private getBudgetScore(price: number, budget: string): number {
    switch (budget) {
      case 'budget':
        if (price < 15) return 25;
        if (price < 25) return 10;
        return -10;
      case 'moderate':
        if (price >= 15 && price < 30) return 20;
        if (price < 40) return 10;
        return -5;
      case 'premium':
        if (price >= 30 && price < 60) return 15;
        return 0;
      case 'luxury':
        return price >= 50 ? 15 : -10;
      default:
        return 0;
    }
  }

  private getWineForCategory(category: string): string | null {
    const wineMap: Record<string, string> = {
      lightWhite: 'Pinot Grigio',
      fullWhite: 'Chardonnay',
      lightRed: 'Pinot Noir',
      fullRed: 'Cabernet Sauvignon',
      rosé: 'Provence Rosé',
      sparkling: 'Champagne',
    };
    return wineMap[category] || null;
  }

  private getBeerForCategory(category: string): string | null {
    const beerMap: Record<string, string> = {
      lager: 'Lager or Pilsner',
      ipa: 'India Pale Ale',
      stout: 'Stout or Porter',
      wheat: 'Wheat Beer',
      sour: 'Sour or Gose',
    };
    return beerMap[category] || null;
  }

  private getCuisineDefaultPairing(cuisine: string): string | null {
    const cuisineLower = cuisine.toLowerCase();

    if (cuisineLower.includes('italian')) return 'Italian Red Wine';
    if (cuisineLower.includes('japanese')) return 'Sake or Japanese Beer';
    if (cuisineLower.includes('mexican')) return 'Mexican Lager or Tequila';
    if (cuisineLower.includes('indian')) return 'India Pale Ale';
    if (cuisineLower.includes('french')) return 'French Wine';
    if (cuisineLower.includes('thai') || cuisineLower.includes('chinese')) return 'Rice Wine or Tea';

    return null;
  }

  private getDefaultWinePairing(item: MenuItem): string {
    const description = item.description.toLowerCase();
    const category = item.category.toLowerCase();

    if (category.includes('fish') || category.includes('seafood') || description.includes('fish')) {
      return 'Light White Wine (Pinot Grigio or Sauvignon Blanc)';
    }
    if (category.includes('beef') || category.includes('lamb') || description.includes('red meat')) {
      return 'Full-Bodied Red Wine (Cabernet Sauvignon or Merlot)';
    }
    if (category.includes('chicken') || category.includes('pork') || description.includes('poultry')) {
      return 'Medium-Bodied Red or Full White Wine';
    }

    return 'House Wine or Your Preference';
  }

  private generateMealPlanName(context: RecommendationContext): string {
    const parts: string[] = [];

    if (context.occasion) {
      switch (context.occasion) {
        case 'date': parts.push('Romantic'); break;
        case 'business': parts.push('Business'); break;
        case 'family': parts.push('Family'); break;
        case 'celebration': parts.push('Celebration'); break;
        case 'casual': parts.push('Casual'); break;
        case 'quick': parts.push('Quick'); break;
      }
    }

    if (context.timeOfDay) {
      switch (context.timeOfDay) {
        case 'breakfast': parts.push('Breakfast'); break;
        case 'lunch': parts.push('Lunch'); break;
        case 'dinner': parts.push('Dinner'); break;
        case 'snack': parts.push('Snack'); break;
        case 'late-night': parts.push('Late Night'); break;
      }
    }

    parts.push('Experience');

    return parts.join(' ');
  }
}

// Singleton instance
let recommendationsService: RecommendationsService | null = null;

export function getRecommendationsService(): RecommendationsService {
  if (!recommendationsService) {
    recommendationsService = new RecommendationsService();
  }
  return recommendationsService;
}
