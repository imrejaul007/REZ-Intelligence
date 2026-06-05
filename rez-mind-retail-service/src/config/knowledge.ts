/**
 * ReZ Mind Retail Service - Knowledge Base
 * Retail industry domain knowledge for AI operations
 */

export const PRODUCT_CATEGORIES = {
  electronics: {
    name: 'Electronics',
    subcategories: ['smartphones', 'laptops', 'tablets', 'audio', 'cameras', 'wearables', 'accessories'],
    avgMargin: 0.25,
    seasonalityPeak: ['november', 'december'],
    seasonalityLow: ['january', 'february'],
  },
  fashion: {
    name: 'Fashion',
    subcategories: ['clothing', 'shoes', 'bags', 'jewelry', 'accessories', 'activewear'],
    avgMargin: 0.55,
    seasonalityPeak: ['march', 'april', 'september', 'october'],
    seasonalityLow: ['january', 'july'],
  },
  grocery: {
    name: 'Grocery',
    subcategories: ['fresh', 'packaged', 'beverages', 'snacks', 'organic', 'frozen'],
    avgMargin: 0.20,
    seasonalityPeak: ['december', 'july', 'august'],
    seasonalityLow: ['february', 'march'],
  },
  home: {
    name: 'Home',
    subcategories: ['kitchen', 'bedding', 'bath', 'decor', 'storage', 'cleaning'],
    avgMargin: 0.40,
    seasonalityPeak: ['march', 'april', 'september', 'october'],
    seasonalityLow: ['january', 'february'],
  },
  furniture: {
    name: 'Furniture',
    subcategories: ['living_room', 'bedroom', 'dining', 'office', 'outdoor'],
    avgMargin: 0.35,
    seasonalityPeak: ['january', 'february', 'june', 'july'],
    seasonalityLow: ['november', 'december'],
  },
  beauty: {
    name: 'Beauty',
    subcategories: ['skincare', 'makeup', 'haircare', 'fragrance', 'bath_body', 'nails'],
    avgMargin: 0.60,
    seasonalityPeak: ['november', 'december', 'may', 'june'],
    seasonalityLow: ['january', 'february'],
  },
  sports: {
    name: 'Sports',
    subcategories: ['fitness', 'outdoor', 'team_sports', 'water_sports', 'cycling', 'running'],
    avgMargin: 0.35,
    seasonalityPeak: ['january', 'february', 'may', 'june', 'july'],
    seasonalityLow: ['november', 'december'],
  },
  toys: {
    name: 'Toys',
    subcategories: ['action_figures', 'educational', 'games', 'outdoor', 'dolls', 'electronics'],
    avgMargin: 0.40,
    seasonalityPeak: ['november', 'december'],
    seasonalityLow: ['january', 'february', 'september'],
  },
  books: {
    name: 'Books',
    subcategories: ['fiction', 'non_fiction', 'children', 'academic', 'ebooks'],
    avgMargin: 0.30,
    seasonalityPeak: ['june', 'july', 'november', 'december'],
    seasonalityLow: ['february', 'march'],
  },
} as const;

export const CUSTOMER_SEGMENTS = {
  bargain_hunter: {
    name: 'Bargain Hunter',
    description: 'Price-sensitive customers who actively seek deals and discounts',
    characteristics: [
      'Always looking for sales and promotions',
      'Compares prices across retailers',
      'Uses coupons and discount codes',
      'Waits for seasonal sales',
      'More likely to buy clearance items',
    ],
    avgOrderValue: 0.6, // multiplier against base
    purchaseFrequency: 'medium',
    preferredCategories: ['grocery', 'fashion'],
  },
  premium_buyer: {
    name: 'Premium Buyer',
    description: 'Quality-focused customers willing to pay more for superior products',
    characteristics: [
      'Prioritizes quality over price',
      'Brand-conscious',
      'Values premium features',
      'Less price-sensitive',
      'Appreciates exclusivity',
    ],
    avgOrderValue: 1.8, // multiplier against base
    purchaseFrequency: 'low',
    preferredCategories: ['beauty', 'electronics', 'furniture'],
  },
  occasional: {
    name: 'Occasional Shopper',
    description: 'Irregular shoppers who purchase based on specific needs',
    characteristics: [
      'Makes purchases when needed',
      'Low browsing behavior',
      'Higher cart abandonment rate',
      'Researches before buying',
      'Loyal once converted',
    ],
    avgOrderValue: 1.0, // multiplier against base
    purchaseFrequency: 'low',
    preferredCategories: ['electronics', 'furniture'],
  },
  routine: {
    name: 'Routine Buyer',
    description: 'Regular customers with predictable purchase patterns',
    characteristics: [
      'Consistent purchase schedule',
      'Often subscribes to auto-replenishment',
      'Prefers familiar brands',
      'Low price sensitivity for staples',
      'High customer lifetime value',
    ],
    avgOrderValue: 1.2, // multiplier against base
    purchaseFrequency: 'high',
    preferredCategories: ['grocery', 'beauty'],
  },
  first_timer: {
    name: 'First Timer',
    description: 'New customers exploring the store for the first time',
    characteristics: [
      'No purchase history yet',
      'Exploring product range',
      'Sensitive to first purchase incentives',
      'High potential for conversion with right offer',
      'Important for brand impression',
    ],
    avgOrderValue: 0.8, // multiplier against base
    purchaseFrequency: 'low_initial',
    preferredCategories: ['all'],
  },
} as const;

export const UPSELL_MAPPINGS: Record<string, { category: string; upsellProducts: string[]; minConfidence: number }> = {
  smartphone: {
    category: 'electronics',
    upsellProducts: ['case', 'screen_protector', 'wireless_charger', 'airpods', 'power_bank', 'car_mount'],
    minConfidence: 0.7,
  },
  laptop: {
    category: 'electronics',
    upsellProducts: ['laptop_bag', 'mouse', 'keyboard', 'monitor', 'webcam', 'usb_hub'],
    minConfidence: 0.65,
  },
  camera: {
    category: 'electronics',
    upsellProducts: ['memory_card', 'camera_bag', 'tripod', 'lens_filter', 'extra_battery'],
    minConfidence: 0.6,
  },
  clothing: {
    category: 'fashion',
    upsellProducts: ['accessories', 'matching_items', 'footwear', 'jewelry'],
    minConfidence: 0.55,
  },
  skincare: {
    category: 'beauty',
    upsellProducts: ['moisturizer', 'sunscreen', 'serum', 'face_mask', 'beauty_tools'],
    minConfidence: 0.7,
  },
  fitness_gear: {
    category: 'sports',
    upsellProducts: ['workout_clothes', 'water_bottle', 'gym_bag', 'fitness_tracker', 'supplements'],
    minConfidence: 0.65,
  },
};

export const CROSS_SELL_MAPPINGS: Record<string, string[]> = {
  coffee_maker: ['coffee', 'filters', 'mugs', 'syrups', 'cleaning_supplies'],
  mattress: ['bedding', 'pillows', 'mattress_protector', 'bed_frame'],
  blender: ['recipe_books', 'replacement_parts', 'additional_jars', 'ingredients'],
  laptop: ['software', 'warranty', 'accessories_bundle', 'cloud_storage'],
  printer: ['ink', 'paper', 'toner', 'printer_cable'],
  gaming_console: ['games', 'controller', 'headset', 'gaming_chair', 'screen'],
  watch: ['watch_band', 'screen_protector', 'charging_cable', 'jewelry_cleaner'],
};

export const BUNDLE_OPPORTUNITIES: Record<string, { products: string[]; discount: number; name: string }[]> = {
  electronics: [
    { products: ['laptop', 'mouse', 'bag'], discount: 15, name: 'Work From Home Bundle' },
    { products: ['smartphone', 'case', 'screen_protector', 'wireless_charger'], discount: 20, name: 'Smartphone Starter Kit' },
    { products: ['headphones', 'phone_case', 'power_bank'], discount: 18, name: 'Audio Bundle' },
  ],
  fashion: [
    { products: ['outfit', 'shoes', 'accessory'], discount: 12, name: 'Complete Look' },
    { products: ['tops', 'bottoms'], discount: 10, name: 'Mix & Match Set' },
  ],
  home: [
    { products: ['sheets', 'pillows', 'quilt'], discount: 18, name: 'Bedding Set' },
    { products: ['pots', 'pans', 'utensils'], discount: 15, name: 'Kitchen Essentials' },
  ],
  beauty: [
    { products: ['skincare_set', 'makeup_bundle'], discount: 20, name: 'Beauty Routine Kit' },
    { products: ['perfume', 'lotion', 'body_wash'], discount: 15, name: 'Gift Set' },
  ],
  sports: [
    { products: ['yoga_mat', 'blocks', 'strap'], discount: 15, name: 'Yoga Starter Pack' },
    { products: ['gym_bag', 'water_bottle', 'towel'], discount: 12, name: 'Gym Essentials' },
  ],
};

export const PRICING_STRATEGY_TIERS = {
  economy: {
    name: 'Economy',
    markupRange: [0, 0.2],
    characteristics: ['Budget-friendly', 'Volume-focused', 'Minimal features'],
    targetSegment: 'bargain_hunter',
  },
  standard: {
    name: 'Standard',
    markupRange: [0.2, 0.4],
    characteristics: ['Balanced value', 'Good quality-to-price ratio', 'Most popular'],
    targetSegment: 'occasional',
  },
  premium: {
    name: 'Premium',
    markupRange: [0.4, 0.8],
    characteristics: ['High quality', 'Extra features', 'Better materials'],
    targetSegment: 'premium_buyer',
  },
  luxury: {
    name: 'Luxury',
    markupRange: [0.8, Infinity],
    characteristics: ['Top-tier quality', 'Exclusivity', 'Status symbol'],
    targetSegment: 'premium_buyer',
  },
} as const;

export const SEASONAL_PATTERNS = {
  month: {
    january: { events: ['New Year'], categories: ['sports', 'fitness', 'books'] },
    february: { events: ['Valentine\'s Day'], categories: ['beauty', 'fashion', 'gifts'] },
    march: { events: ['Spring'], categories: ['fashion', 'home', 'beauty'] },
    april: { events: ['Easter'], categories: ['grocery', 'home', 'toys'] },
    may: { events: ['Mother\'s Day'], categories: ['beauty', 'fashion', 'jewelry'] },
    june: { events: ['Father\'s Day', 'Summer Start'], categories: ['sports', 'electronics', 'beauty'] },
    july: { events: ['Summer'], categories: ['sports', 'furniture', 'grocery'] },
    august: { events: ['Back to School'], categories: ['electronics', 'fashion', 'books'] },
    september: { events: ['Fall'], categories: ['home', 'fashion', 'beauty'] },
    october: { events: ['Halloween'], categories: ['toys', 'grocery', 'home'] },
    november: { events: ['Black Friday', 'Cyber Monday', 'Thanksgiving'], categories: ['electronics', 'fashion', 'toys'] },
    december: { events: ['Holiday Season', 'Christmas'], categories: ['toys', 'electronics', 'beauty', 'grocery'] },
  },
  lifecycle: {
    new_product: { priceAdjustment: 1.1, reason: 'Early adopter premium' },
    growth: { priceAdjustment: 1.0, reason: 'Stable pricing' },
    maturity: { priceAdjustment: 0.95, reason: 'Competitive pricing' },
    decline: { priceAdjustment: 0.7, reason: 'Clearance pricing' },
  },
};

export const DEMAND_SIGNALS = {
  high: { multiplier: 1.2, action: 'Consider price increase' },
  normal: { multiplier: 1.0, action: 'Maintain current pricing' },
  low: { multiplier: 0.9, action: 'Consider promotion' },
  very_low: { multiplier: 0.7, action: 'Urgent clearance needed' },
} as const;

export const TREND_INDICATORS = {
  trending_up: { score: 80, label: 'Trending', color: '#10b981' },
  stable: { score: 50, label: 'Stable', color: '#6b7280' },
  trending_down: { score: 20, label: 'Declining', color: '#ef4444' },
};

export const REORDER_THRESHOLDS = {
  critical: { days_remaining: 7, urgency: 'critical' },
  low: { days_remaining: 14, urgency: 'low' },
  medium: { days_remaining: 21, urgency: 'medium' },
  high: { days_remaining: 30, urgency: 'high' },
};