/**
 * Grocery Industry Knowledge Base
 * Contains product categories, seasonal patterns, expiry patterns, and supplier information
 */

export enum GroceryCategory {
  PRODUCE = 'produce',
  DAIRY = 'dairy',
  BAKERY = 'bakery',
  FROZEN = 'frozen',
  BEVERAGES = 'beverages',
  SNACKS = 'snacks',
  ESSENTIALS = 'essentials',
}

export interface ProductCategoryData {
  name: string;
  subcategories: string[];
  avgShelfLife: number; // days at room temperature
  refrigeratedShelfLife: number; // days when refrigerated
  frozenShelfLife: number; // days when frozen
  storageRequirements: string[];
  disposalThreshold: number; // percentage (0-100)
}

export interface SeasonalPattern {
  categories: GroceryCategory[];
  highDemandProducts: string[];
  lowDemandProducts: string[];
  priceFluctuation: number; // percentage
}

export interface SupplierPerformanceFactors {
  onTimeDelivery: number; // percentage
  qualityScore: number; // 0-100
  priceCompetitiveness: number; // percentage
  responsiveness: number; // 0-100
  sustainability: number; // 0-100
  orderAccuracy: number; // percentage
}

export interface ExpiryPatternData {
  category: GroceryCategory;
  baseShelfLife: number; // days
  refrigeratedDays: number;
  frozenDays: number;
  warningThreshold: number; // days before expiry
  criticalThreshold: number; // days before expiry
  suggestedDiscountStart: number; // days before expiry
  donationThreshold: number; // days before expiry
}

// Product Categories with metadata
export const PRODUCT_CATEGORIES: Record<GroceryCategory, ProductCategoryData> = {
  [GroceryCategory.PRODUCE]: {
    name: 'Fresh Produce',
    subcategories: [
      'Leafy Greens',
      'Root Vegetables',
      'Fruits',
      'Herbs',
      'Mushrooms',
      'Tomatoes',
      'Peppers',
      'Onions & Garlic',
    ],
    avgShelfLife: 5,
    refrigeratedShelfLife: 10,
    frozenShelfLife: 240,
    storageRequirements: ['cool temperature', 'avoid direct sunlight', 'proper ventilation'],
    disposalThreshold: 15,
  },
  [GroceryCategory.DAIRY]: {
    name: 'Dairy Products',
    subcategories: [
      'Milk',
      'Cheese',
      'Yogurt',
      'Butter',
      'Eggs',
      'Cream',
      'Sour Cream',
      'Cottage Cheese',
    ],
    avgShelfLife: 14,
    refrigeratedShelfLife: 21,
    frozenShelfLife: 90,
    storageRequirements: ['refrigerated at 40°F or below', 'sealed containers'],
    disposalThreshold: 10,
  },
  [GroceryCategory.BAKERY]: {
    name: 'Bakery Items',
    subcategories: [
      'Bread',
      'Buns & Rolls',
      'Pastries',
      'Cakes',
      'Cookies',
      'Pies',
      'Bagels',
      'Muffins',
    ],
    avgShelfLife: 4,
    refrigeratedShelfLife: 7,
    frozenShelfLife: 180,
    storageRequirements: ['cool dry place', 'avoid moisture', 'bread boxes'],
    disposalThreshold: 20,
  },
  [GroceryCategory.FROZEN]: {
    name: 'Frozen Foods',
    subcategories: [
      'Frozen Meals',
      'Ice Cream',
      'Frozen Vegetables',
      'Frozen Fruits',
      'Frozen Pizza',
      'Frozen Snacks',
      'Fish Sticks',
      'Frozen Desserts',
    ],
    avgShelfLife: 180,
    refrigeratedShelfLife: 0,
    frozenShelfLife: 365,
    storageRequirements: ['frozen at 0°F or below', 'no temperature fluctuations'],
    disposalThreshold: 5,
  },
  [GroceryCategory.BEVERAGES]: {
    name: 'Beverages',
    subcategories: [
      'Soft Drinks',
      'Juices',
      'Water',
      'Coffee & Tea',
      'Energy Drinks',
      'Sports Drinks',
      'Alcoholic Beverages',
      'Plant-Based Drinks',
    ],
    avgShelfLife: 90,
    refrigeratedShelfLife: 30,
    frozenShelfLife: 365,
    storageRequirements: ['cool dry place', 'away from direct sunlight'],
    disposalThreshold: 15,
  },
  [GroceryCategory.SNACKS]: {
    name: 'Snacks',
    subcategories: [
      'Chips',
      'Cookies',
      'Candy',
      'Nuts',
      'Crackers',
      'Popcorn',
      'Granola Bars',
      'Dried Fruit',
    ],
    avgShelfLife: 60,
    refrigeratedShelfLife: 0,
    frozenShelfLife: 365,
    storageRequirements: ['cool dry place', 'sealed containers after opening'],
    disposalThreshold: 20,
  },
  [GroceryCategory.ESSENTIALS]: {
    name: 'Kitchen Essentials',
    subcategories: [
      'Rice',
      'Pasta',
      'Cooking Oil',
      'Sugar',
      'Flour',
      'Canned Goods',
      'Sauces & Condiments',
      'Spices',
    ],
    avgShelfLife: 365,
    refrigeratedShelfLife: 0,
    frozenShelfLife: 730,
    storageRequirements: ['cool dry place', 'sealed containers', 'away from heat sources'],
    disposalThreshold: 25,
  },
};

// Seasonal Patterns by Month
export const SEASONAL_PATTERNS: Record<string, SeasonalPattern> = {
  january: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.ESSENTIALS, GroceryCategory.BEVERAGES],
    highDemandProducts: ['citrus fruits', 'root vegetables', 'hot beverages', 'soups'],
    lowDemandProducts: ['ice cream', 'fresh berries', ' BBQ supplies'],
    priceFluctuation: 10,
  },
  february: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.BAKERY, GroceryCategory.SNACKS],
    highDemandProducts: ['heart-healthy foods', 'valentine candies', 'fresh produce'],
    lowDemandProducts: ['BBQ items', 'summer beverages'],
    priceFluctuation: 15,
  },
  march: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.DAIRY, GroceryCategory.BEVERAGES],
    highDemandProducts: ['St. Patrick\'s Day items', 'fresh greens', 'spring vegetables'],
    lowDemandProducts: ['holiday treats', 'warm beverages'],
    priceFluctuation: 12,
  },
  april: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.DAIRY, GroceryCategory.BAKERY],
    highDemandProducts: ['Easter candy', 'fresh produce', 'baking ingredients'],
    lowDemandProducts: ['winter vegetables', 'hot beverages'],
    priceFluctuation: 18,
  },
  may: {
    categories: [GroceryCategory.BEVERAGES, GroceryCategory.FROZEN, GroceryCategory.SNACKS],
    highDemandProducts: ['ice cream', 'grilling supplies', 'soft drinks', 'memorial day items'],
    lowDemandProducts: ['soups', 'hot chocolate'],
    priceFluctuation: 20,
  },
  june: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.BEVERAGES, GroceryCategory.FROZEN],
    highDemandProducts: ['watermelon', 'corn', 'ice cream', 'lemonade', 'BBQ items'],
    lowDemandProducts: ['winter vegetables', 'soups'],
    priceFluctuation: 15,
  },
  july: {
    categories: [GroceryCategory.BEVERAGES, GroceryCategory.FROZEN, GroceryCategory.SNACKS],
    highDemandProducts: ['ice cream', 'hot dogs', 'burgers', 'soft drinks', 'watermelon'],
    lowDemandProducts: ['baking supplies', 'hot beverages'],
    priceFluctuation: 12,
  },
  august: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.BEVERAGES, GroceryCategory.FROZEN],
    highDemandProducts: ['back to school snacks', 'summer produce', 'sports drinks'],
    lowDemandProducts: ['holiday items', 'baking ingredients'],
    priceFluctuation: 10,
  },
  september: {
    categories: [GroceryCategory.DAIRY, GroceryCategory.ESSENTIALS, GroceryCategory.BAKERY],
    highDemandProducts: ['football snacks', 'breakfast items', 'school lunches'],
    lowDemandProducts: ['ice cream', 'summer beverages'],
    priceFluctuation: 8,
  },
  october: {
    categories: [GroceryCategory.BAKERY, GroceryCategory.SNACKS, GroceryCategory.BEVERAGES],
    highDemandProducts: ['Halloween candy', 'pumpkin items', 'fall baking supplies'],
    lowDemandProducts: ['summer produce', 'ice cream'],
    priceFluctuation: 25,
  },
  november: {
    categories: [GroceryCategory.PRODUCE, GroceryCategory.ESSENTIALS, GroceryCategory.BAKERY],
    highDemandProducts: ['turkey', 'cranberries', 'pie ingredients', 'holiday baking'],
    lowDemandProducts: ['summer items', 'grilling supplies'],
    priceFluctuation: 30,
  },
  december: {
    categories: [GroceryCategory.BAKERY, GroceryCategory.BEVERAGES, GroceryCategory.SNACKS],
    highDemandProducts: ['holiday cookies', 'egg nog', 'party snacks', 'gift items'],
    lowDemandProducts: ['summer produce', 'grilling items'],
    priceFluctuation: 35,
  },
};

// Expiry Patterns by Category
export const EXPIRY_PATTERNS: Record<GroceryCategory, ExpiryPatternData> = {
  [GroceryCategory.PRODUCE]: {
    category: GroceryCategory.PRODUCE,
    baseShelfLife: 5,
    refrigeratedDays: 10,
    frozenDays: 240,
    warningThreshold: 3,
    criticalThreshold: 1,
    suggestedDiscountStart: 2,
    donationThreshold: 2,
  },
  [GroceryCategory.DAIRY]: {
    category: GroceryCategory.DAIRY,
    baseShelfLife: 14,
    refrigeratedDays: 21,
    frozenDays: 90,
    warningThreshold: 5,
    criticalThreshold: 2,
    suggestedDiscountStart: 5,
    donationThreshold: 3,
  },
  [GroceryCategory.BAKERY]: {
    category: GroceryCategory.BAKERY,
    baseShelfLife: 4,
    refrigeratedDays: 7,
    frozenDays: 180,
    warningThreshold: 2,
    criticalThreshold: 1,
    suggestedDiscountStart: 1,
    donationThreshold: 1,
  },
  [GroceryCategory.FROZEN]: {
    category: GroceryCategory.FROZEN,
    baseShelfLife: 180,
    refrigeratedDays: 0,
    frozenDays: 365,
    warningThreshold: 30,
    criticalThreshold: 14,
    suggestedDiscountStart: 60,
    donationThreshold: 30,
  },
  [GroceryCategory.BEVERAGES]: {
    category: GroceryCategory.BEVERAGES,
    baseShelfLife: 90,
    refrigeratedDays: 30,
    frozenDays: 365,
    warningThreshold: 14,
    criticalThreshold: 7,
    suggestedDiscountStart: 14,
    donationThreshold: 7,
  },
  [GroceryCategory.SNACKS]: {
    category: GroceryCategory.SNACKS,
    baseShelfLife: 60,
    refrigeratedDays: 0,
    frozenDays: 365,
    warningThreshold: 14,
    criticalThreshold: 7,
    suggestedDiscountStart: 14,
    donationThreshold: 7,
  },
  [GroceryCategory.ESSENTIALS]: {
    category: GroceryCategory.ESSENTIALS,
    baseShelfLife: 365,
    refrigeratedDays: 0,
    frozenDays: 730,
    warningThreshold: 60,
    criticalThreshold: 30,
    suggestedDiscountStart: 90,
    donationThreshold: 60,
  },
};

// Cross-sell and up-sell mappings for basket analysis
export const CROSS_SELL_MAPPINGS: Record<string, { products: string[]; category: GroceryCategory; minConfidence: number }> = {
  milk: { products: ['cereal', 'cookies', 'coffee'], category: GroceryCategory.ESSENTIALS, minConfidence: 0.8 },
  bread: { products: ['butter', 'cheese', 'jelly'], category: GroceryCategory.BAKERY, minConfidence: 0.75 },
  eggs: { products: ['bacon', 'cheese', 'bread'], category: GroceryCategory.DAIRY, minConfidence: 0.78 },
  chicken: { products: ['rice', 'vegetables', 'marinade'], category: GroceryCategory.PRODUCE, minConfidence: 0.82 },
  coffee: { products: ['cream', 'sugar', 'cookies'], category: GroceryCategory.BEVERAGES, minConfidence: 0.85 },
  pasta: { products: ['sauce', 'cheese', 'ground beef'], category: GroceryCategory.ESSENTIALS, minConfidence: 0.8 },
  salad: { products: ['dressing', 'croutons', 'chicken'], category: GroceryCategory.PRODUCE, minConfidence: 0.77 },
  ice_cream: { products: ['cones', 'sprinkles', 'toppings'], category: GroceryCategory.FROZEN, minConfidence: 0.83 },
  chips: { products: ['dip', 'salsa', 'soda'], category: GroceryCategory.SNACKS, minConfidence: 0.81 },
  juice: { products: ['fruits', 'smoothie ingredients', 'pancake mix'], category: GroceryCategory.BEVERAGES, minConfidence: 0.76 },
};

// Upsell mappings for premium products
export const UPSELL_MAPPINGS: Record<string, { products: string[]; category: GroceryCategory; minConfidence: number }> = {
  regular_milk: { products: ['organic_milk', 'oat_milk', 'almond_milk'], category: GroceryCategory.DAIRY, minConfidence: 0.7 },
  white_bread: { products: ['sourdough', 'whole_wheat', 'artisan_bread'], category: GroceryCategory.BAKERY, minConfidence: 0.68 },
  store_cheese: { products: ['premium_cheese', 'artisan_cheese', 'imported_cheese'], category: GroceryCategory.DAIRY, minConfidence: 0.72 },
  canned_soup: { products: ['organic_soup', 'gourmet_soup', 'premium_soup'], category: GroceryCategory.ESSENTIALS, minConfidence: 0.65 },
  basic_chips: { products: ['premium_chips', 'kettle_chips', 'artisan_chips'], category: GroceryCategory.SNACKS, minConfidence: 0.7 },
};

// Supplier performance factors
export const SUPPLIER_FACTORS: Record<string, SupplierPerformanceFactors> = {
  freshness_score: { onTimeDelivery: 30, qualityScore: 25, priceCompetitiveness: 20, responsiveness: 15, sustainability: 5, orderAccuracy: 5 },
  reliability_score: { onTimeDelivery: 40, qualityScore: 20, priceCompetitiveness: 15, responsiveness: 10, sustainability: 5, orderAccuracy: 10 },
  cost_score: { onTimeDelivery: 15, qualityScore: 20, priceCompetitiveness: 35, responsiveness: 10, sustainability: 10, orderAccuracy: 10 },
};

// Demand signal weights
export const DEMAND_SIGNALS = {
  seasonal: 0.3,
  promotional: 0.25,
  weather: 0.15,
  social_trend: 0.15,
  historical: 0.15,
};

// Reorder thresholds by category
export const REORDER_THRESHOLDS = {
  critical: { days_remaining: 1, percentage: 10 },
  high: { days_remaining: 3, percentage: 20 },
  medium: { days_remaining: 5, percentage: 30 },
  low: { days_remaining: 7, percentage: 40 },
};

// Waste reduction strategies
export const WASTE_REDUCTION_STRATEGIES = {
  discount_schedule: [
    { daysRemaining: 2, discountPercentage: 25 },
    { daysRemaining: 1, discountPercentage: 50 },
    { hoursRemaining: 12, discountPercentage: 75 },
  ],
  donation_schedule: [
    { daysRemaining: 2, eligible: true },
    { daysRemaining: 1, eligible: true },
  ],
};

// Customer preferences mapping
export const CUSTOMER_PREFERENCES = {
  dietary_restrictions: ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free', 'kosher', 'halal'],
  shopping_habits: ['weekly', 'biweekly', 'monthly', 'impulse', 'planned'],
  price_sensitivity: ['budget', 'moderate', 'premium'],
  quality_priority: ['freshness', 'organic', 'local', 'convenience', 'variety'],
};

export default {
  PRODUCT_CATEGORIES,
  SEASONAL_PATTERNS,
  EXPIRY_PATTERNS,
  CROSS_SELL_MAPPINGS,
  UPSELL_MAPPINGS,
  SUPPLIER_FACTORS,
  DEMAND_SIGNALS,
  REORDER_THRESHOLDS,
  WASTE_REDUCTION_STRATEGIES,
  CUSTOMER_PREFERENCES,
};