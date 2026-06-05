export const fashionKnowledge = {
  categories: ['tops', 'bottoms', 'dresses', 'ethnic', 'western', 'accessories', 'footwear'],
  styles: ['casual', 'formal', 'bohemian', 'minimalist', 'vintage', 'streetwear', 'ethnic', 'traditional', 'contemporary'],
  occasions: ['casual', 'work', 'party', 'wedding', 'festival', 'sports', 'sleepwear', 'loungewear'],
  colors: ['black', 'white', 'navy', 'red', 'blue', 'green', 'pink', 'yellow', 'beige', 'grey', 'brown', 'multicolor'],
  seasons: ['spring', 'summer', 'fall', 'winter', 'festive', 'pre-festive'],
  bodyTypes: ['slim', 'athletic', 'curvy', 'petite', 'tall', 'plus'],

  // Trend indicators
  trendIndicators: {
    highDemand: ['oversized', 'sustainable', 'minimalist', 'ethnic fusion', 'comfort wear', 'neutral tones'],
    declining: ['extreme skinny fit', 'fast fashion basics', 'synthetic heavy'],
    emerging: ['upcycled fashion', 'modest fashion', 'gender-neutral', 'artisan made'],
  },

  // Size demand patterns
  sizeDemand: {
    women: { XS: 5, S: 25, M: 40, L: 20, XL: 8, XXL: 2 },
    men: { S: 10, M: 35, L: 35, XL: 15, XXL: 5 },
    kids: { '2-3Y': 15, '4-5Y': 20, '6-7Y': 25, '8-9Y': 20, '10-12Y': 15, '13-14Y': 5 },
  },

  // Seasonal patterns
  seasonalPatterns: {
    spring: { colors: ['pastels', 'florals', 'light fabrics'], popular: ['dresses', 'tops', 'light jackets'] },
    summer: { colors: ['white', 'bright colors', 'cool fabrics'], popular: ['tops', 'shorter hem', 'cotton'] },
    fall: { colors: ['earth tones', 'burgundy', 'olive'], popular: ['layers', 'jackets', 'boots'] },
    winter: { colors: ['dark colors', 'metallics', 'plush'], popular: ['sweaters', 'coats', 'boots'] },
    festive: { colors: ['gold', 'red', 'bright'], popular: ['ethnic', 'sequin', 'jewel tones'] },
  },

  // Cross-sell mappings
  crossSellCategories: {
    tops: ['bottoms', 'accessories', 'footwear'],
    bottoms: ['tops', 'accessories', 'footwear'],
    dresses: ['accessories', 'footwear', 'jackets'],
    ethnic: ['jewelry', 'footwear', 'bags'],
    western: ['accessories', 'footwear', 'outerwear'],
  },
};

export const getTrendPrediction = (
  category: string,
  currentMonth: number
): { season: string; popularity: number; recommendation: string } => {
  const monthSeasons: Record<number, string> = {
    1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer',
    7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'festive', 12: 'winter',
  };

  const season = monthSeasons[currentMonth] || 'casual';
  const pattern = fashionKnowledge.seasonalPatterns[season as keyof typeof fashionKnowledge.seasonalPatterns];

  return {
    season,
    popularity: 0.8,
    recommendation: `Focus on ${pattern?.popular?.join(', ') || 'essentials'} in ${pattern?.colors?.join(', ') || 'neutral colors'}`,
  };
};

export default fashionKnowledge;