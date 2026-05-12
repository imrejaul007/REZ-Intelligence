import { CustomerSegment, Customer, CartItem, Product } from './salesAgent';

interface RecommendationContext {
  customer: Customer | null;
  recentProducts: string[];
  browsingHistory: string[];
  cart: CartItem[];
  preferences: Record<string, unknown>;
}

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  matchScore: number;
  matchReason: string;
  category: string;
  tags: string[];
  image: string;
}

interface UserPreferenceProfile {
  preferredCategories: string[];
  preferredPriceRange: { min: number; max: number };
  preferredTags: string[];
  bookingLeadTime: 'last_minute' | 'standard' | 'early_bird';
}

const PRODUCT_CATALOG: Product[] = [
  {
    id: 'prod_001',
    name: 'Deluxe Ocean View Room',
    description: 'Spacious room with panoramic ocean views and premium amenities.',
    category: 'hotel',
    basePrice: 299.99,
    inventory: 15,
    rating: 4.8,
    reviewCount: 342,
    tags: ['ocean view', 'premium', 'spacious', 'balcony', 'wifi'],
    images: ['deluxe-ocean-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_002',
    name: 'Premium Suite with Private Pool',
    description: 'Luxury suite featuring a private infinity pool and butler service.',
    category: 'hotel',
    basePrice: 599.99,
    inventory: 5,
    rating: 4.9,
    reviewCount: 128,
    tags: ['luxury', 'private pool', 'butler', 'exclusive', 'spa'],
    images: ['suite-pool-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_003',
    name: 'Standard Garden Room',
    description: 'Comfortable room with garden views, perfect for budget-conscious travelers.',
    category: 'hotel',
    basePrice: 149.99,
    inventory: 25,
    rating: 4.5,
    reviewCount: 567,
    tags: ['budget-friendly', 'garden view', 'quiet', 'nature'],
    images: ['standard-garden-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_004',
    name: 'Adventure Tour Package',
    description: '5-day adventure package including hiking, zip-lining, and jungle exploration.',
    category: 'package',
    basePrice: 899.99,
    inventory: 12,
    rating: 4.7,
    reviewCount: 89,
    tags: ['adventure', 'nature', 'group', 'hiking', 'extreme'],
    images: ['adventure-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_005',
    name: 'Airport Transfer Service',
    description: 'Premium private transfer between airport and hotel with meet & greet.',
    category: 'transfer',
    basePrice: 79.99,
    inventory: 100,
    rating: 4.6,
    reviewCount: 234,
    tags: ['convenience', 'private', 'airport', 'comfortable'],
    images: ['transfer-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_006',
    name: 'Beachfront Family Villa',
    description: 'Large family villa directly on the beach with kitchen and kids area.',
    category: 'hotel',
    basePrice: 449.99,
    inventory: 8,
    rating: 4.7,
    reviewCount: 156,
    tags: ['family', 'beachfront', 'spacious', 'kids-friendly', 'kitchen'],
    images: ['family-villa-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_007',
    name: 'Romantic Sunset Cruise',
    description: 'Private sunset cruise with dinner and champagne for couples.',
    category: 'activity',
    basePrice: 249.99,
    inventory: 20,
    rating: 4.9,
    reviewCount: 78,
    tags: ['romantic', 'couples', 'sunset', 'dinner', 'luxury'],
    images: ['sunset-cruise-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_008',
    name: 'Spa & Wellness Retreat',
    description: '3-day all-inclusive spa package with unlimited treatments.',
    category: 'package',
    basePrice: 699.99,
    inventory: 15,
    rating: 4.8,
    reviewCount: 92,
    tags: ['spa', 'wellness', 'relaxation', 'health', 'yoga'],
    images: ['spa-retreat-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_009',
    name: 'Cultural City Tour',
    description: 'Full-day guided tour of historical landmarks and local cuisine.',
    category: 'activity',
    basePrice: 129.99,
    inventory: 30,
    rating: 4.6,
    reviewCount: 201,
    tags: ['culture', 'history', 'food', 'guided', 'sightseeing'],
    images: ['city-tour-1.jpg'],
    isActive: true
  },
  {
    id: 'prod_010',
    name: 'Water Sports Bundle',
    description: 'Access to all water sports including snorkeling, kayaking, and paddleboarding.',
    category: 'activity',
    basePrice: 89.99,
    inventory: 50,
    rating: 4.5,
    reviewCount: 312,
    tags: ['water sports', 'adventure', 'beach', 'active', 'fun'],
    images: ['water-sports-1.jpg'],
    isActive: true
  }
];

export async function getRecommendations(context: RecommendationContext): Promise<RecommendedProduct[]> {
  const userProfile = buildUserProfile(context);

  const scoredProducts = PRODUCT_CATALOG
    .filter(product => product.isActive && product.inventory > 0)
    .map(product => {
      const matchScore = calculateMatchScore(product, userProfile, context);
      const matchReason = generateMatchReason(product, userProfile, context);
      return {
        id: product.id,
        name: product.name,
        price: product.basePrice,
        matchScore,
        matchReason,
        category: product.category,
        tags: product.tags,
        image: product.images[0] || 'default.jpg'
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const bundleRecommendation = generateBundleRecommendation(context);
  if (bundleRecommendation) {
    scoredProducts.push(bundleRecommendation);
  }

  return scoredProducts.slice(0, 5);
}

function buildUserProfile(context: RecommendationContext): UserPreferenceProfile {
  const preferredCategories = new Set<string>();
  const preferredTags = new Set<string>();
  let totalSpent = 0;
  let purchaseCount = 0;
  const priceRanges: number[] = [];

  if (context.customer) {
    totalSpent = context.customer.lifetimeValue;
    purchaseCount = context.customer.totalOrders;

    if (totalSpent > 5000) {
      preferredTags.add('luxury');
      preferredTags.add('premium');
    } else if (totalSpent > 1000) {
      preferredTags.add('comfortable');
      preferredTags.add('convenient');
    } else {
      preferredTags.add('budget-friendly');
      preferredTags.add('value');
    }
  }

  for (const productId of context.recentProducts) {
    const product = PRODUCT_CATALOG.find(p => p.id === productId);
    if (product) {
      preferredCategories.add(product.category);
      product.tags.forEach(tag => preferredTags.add(tag));
      priceRanges.push(product.basePrice);
    }
  }

  for (const item of context.cart) {
    const product = PRODUCT_CATALOG.find(p => p.id === item.productId);
    if (product) {
      preferredCategories.add(product.category);
      priceRanges.push(item.unitPrice);
    }
  }

  for (const productId of context.browsingHistory) {
    const product = PRODUCT_CATALOG.find(p => p.id === productId);
    if (product) {
      preferredCategories.add(product.category);
      product.tags.forEach(tag => preferredTags.add(tag));
    }
  }

  const avgPrice = priceRanges.length > 0
    ? priceRanges.reduce((sum, p) => sum + p, 0) / priceRanges.length
    : 200;

  const preferenceMultiplier = context.customer?.segment === CustomerSegment.VIP ||
                               context.customer?.segment === CustomerSegment.ENTERPRISE ? 1.5 : 1;

  return {
    preferredCategories: Array.from(preferredCategories),
    preferredPriceRange: {
      min: Math.max(0, avgPrice * 0.5 * preferenceMultiplier),
      max: avgPrice * 1.5 * preferenceMultiplier
    },
    preferredTags: Array.from(preferredTags),
    bookingLeadTime: determineBookingPattern(context)
  };
}

function determineBookingPattern(context: RecommendationContext): 'last_minute' | 'standard' | 'early_bird' {
  if (context.customer && context.customer.lastPurchaseDate) {
    const daysSinceLastPurchase = Math.floor(
      (Date.now() - context.customer.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastPurchase < 7) return 'last_minute';
    if (daysSinceLastPurchase < 30) return 'standard';
  }
  return 'early_bird';
}

function calculateMatchScore(
  product: Product,
  profile: UserPreferenceProfile,
  context: RecommendationContext
): number {
  let score = 0;

  if (profile.preferredCategories.includes(product.category)) {
    score += 30;
  }

  const matchingTags = product.tags.filter(tag =>
    profile.preferredTags.some(pt => pt.toLowerCase() === tag.toLowerCase())
  );
  score += matchingTags.length * 10;

  if (product.basePrice >= profile.preferredPriceRange.min &&
      product.basePrice <= profile.preferredPriceRange.max) {
    score += 25;
  } else {
    const distanceFromRange = Math.min(
      Math.abs(product.basePrice - profile.preferredPriceRange.min),
      Math.abs(product.basePrice - profile.preferredPriceRange.max)
    );
    score -= Math.min(distanceFromRange, 100);
  }

  if (product.rating >= 4.7) score += 15;
  else if (product.rating >= 4.5) score += 10;
  else if (product.rating >= 4.0) score += 5;

  if (product.inventory > 10) score += 5;
  else if (product.inventory < 5) score -= 10;

  if (context.recentProducts.includes(product.id) || context.cart.some(item => item.productId === product.id)) {
    score -= 50;
  }

  if (!context.browsingHistory.includes(product.id)) {
    score += 5;
  }

  if (profile.bookingLeadTime === 'early_bird' && product.basePrice < 400) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function generateMatchReason(
  product: Product,
  profile: UserPreferenceProfile,
  context: RecommendationContext
): string {
  const reasons: string[] = [];

  if (profile.preferredCategories.includes(product.category)) {
    reasons.push(`Based on your interest in ${product.category}s`);
  }

  const matchingTags = product.tags.filter(tag =>
    profile.preferredTags.some(pt => pt.toLowerCase() === tag.toLowerCase())
  );
  if (matchingTags.length > 0) {
    reasons.push(`Matches your preference for ${matchingTags[0]}`);
  }

  if (product.rating >= 4.7) {
    reasons.push('Highly rated by customers');
  }

  if (product.inventory < 5) {
    reasons.push('Selling fast - limited availability');
  }

  if (reasons.length === 0) {
    reasons.push('Popular choice among travelers');
  }

  return reasons[0];
}

function generateBundleRecommendation(context: RecommendationContext): RecommendedProduct | null {
  const cartCategories = new Set(context.cart.map(item => {
    const product = PRODUCT_CATALOG.find(p => p.id === item.productId);
    return product?.category;
  }));

  if (cartCategories.has('hotel') && !cartCategories.has('transfer')) {
    const transfer = PRODUCT_CATALOG.find(p => p.category === 'transfer');
    if (transfer) {
      return {
        id: 'bundle_transfer',
        name: `${transfer.name} - Bundle with your hotel`,
        price: transfer.basePrice * 0.8,
        matchScore: 85,
        matchReason: 'Complete your trip with airport transfer',
        category: 'transfer',
        tags: ['bundle', 'convenience', 'savings'],
        image: transfer.images[0]
      };
    }
  }

  if (cartCategories.has('hotel') && !cartCategories.has('activity')) {
    const activity = PRODUCT_CATALOG.find(p => p.category === 'activity');
    if (activity) {
      return {
        id: 'bundle_activity',
        name: `${activity.name} - Experience more`,
        price: activity.basePrice * 0.85,
        matchScore: 82,
        matchReason: 'Enhance your stay with activities',
        category: 'activity',
        tags: ['bundle', 'experience', 'savings'],
        image: activity.images[0]
      };
    }
  }

  return null;
}

export async function getComplementaryProducts(productId: string): Promise<RecommendedProduct[]> {
  const product = PRODUCT_CATALOG.find(p => p.id === productId);
  if (!product) return [];

  const complementary: Product[] = [];

  switch (product.category) {
    case 'hotel':
      const transfer = PRODUCT_CATALOG.find(p => p.category === 'transfer');
      const activity = PRODUCT_CATALOG.find(p => p.category === 'activity' && p.inventory > 0);
      if (transfer) complementary.push(transfer);
      if (activity) complementary.push(activity);
      break;

    case 'activity':
      const hotel = PRODUCT_CATALOG.find(p => p.category === 'hotel');
      if (hotel) complementary.push(hotel);
      break;

    case 'transfer':
      const tour = PRODUCT_CATALOG.find(p => p.category === 'package');
      if (tour) complementary.push(tour);
      break;

    default:
      break;
  }

  return complementary.map(p => ({
    id: p.id,
    name: p.name,
    price: p.basePrice * 0.9,
    matchScore: 75,
    matchReason: `Often booked with ${product.name}`,
    category: p.category,
    tags: p.tags,
    image: p.images[0]
  }));
}

export async function getTrendingProducts(limit: number = 5): Promise<RecommendedProduct[]> {
  const trending = PRODUCT_CATALOG
    .filter(p => p.isActive && p.inventory > 0)
    .sort((a, b) => {
      const scoreA = a.reviewCount * a.rating * (a.inventory < 10 ? 1.5 : 1);
      const scoreB = b.reviewCount * b.rating * (b.inventory < 10 ? 1.5 : 1);
      return scoreB - scoreA;
    })
    .slice(0, limit);

  return trending.map(p => ({
    id: p.id,
    name: p.name,
    price: p.basePrice,
    matchScore: p.reviewCount * p.rating,
    matchReason: 'Trending based on recent bookings',
    category: p.category,
    tags: p.tags,
    image: p.images[0]
  }));
}

export async function getPersonalizedDeals(context: RecommendationContext): Promise<RecommendedProduct[]> {
  const userProfile = buildUserProfile(context);

  const deals = PRODUCT_CATALOG
    .filter(p => {
      if (!p.isActive || p.inventory <= 0) return false;
      const hasDiscount = p.basePrice < userProfile.preferredPriceRange.max * 0.8;
      const isInRange = p.basePrice <= userProfile.preferredPriceRange.max;
      return hasDiscount || isInRange;
    })
    .map(p => {
      const discount = ((userProfile.preferredPriceRange.max - p.basePrice) / userProfile.preferredPriceRange.max) * 100;
      return {
        id: p.id,
        name: p.name,
        price: p.basePrice,
        originalPrice: p.basePrice * 1.2,
        matchScore: discount,
        matchReason: `${discount.toFixed(0)}% below your usual spending`,
        category: p.category,
        tags: p.tags,
        image: p.images[0]
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  return deals;
}

export { PRODUCT_CATALOG };
