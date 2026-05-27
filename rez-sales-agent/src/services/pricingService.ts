import logger from './utils/logger.js';

import { CustomerSegment } from './salesAgent';

interface PricingFactors {
  segment: CustomerSegment;
  quantity: number;
  timeToTravel: number;
  inventoryLevel: number;
  demandScore: number;
  bookingDay?: 'weekday' | 'weekend';
  specialOccasion?: boolean;
  repeatCustomer?: boolean;
}

interface DiscountEligibility {
  eligible: boolean;
  applicableDiscounts: Discount[];
  loyaltyBonus: number;
  potentialSavings: number;
  nextTier: string | null;
  suggestions: string[];
}

interface Discount {
  name: string;
  description: string;
  code: string;
  type: 'percentage' | 'fixed' | 'tiered';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  expiresAt?: Date;
}

interface DynamicPricingConfig {
  basePrice: number;
  maxDiscountPercent: number;
  minPricePercent: number;
  surgeMultiplierMax: number;
  loyaltyDiscountPercent: Record<CustomerSegment, number>;
  volumeDiscountTiers: VolumeDiscountTier[];
  seasonalMultiplier: Record<string, number>;
}

interface VolumeDiscountTier {
  minQuantity: number;
  discountPercent: number;
}

const PRICING_CONFIG: DynamicPricingConfig = {
  basePrice: 0,
  maxDiscountPercent: 35,
  minPricePercent: 60,
  surgeMultiplierMax: 1.5,
  loyaltyDiscountPercent: {
    [CustomerSegment.NEW_CUSTOMER]: 0,
    [CustomerSegment.RETURNING]: 5,
    [CustomerSegment.VIP]: 15,
    [CustomerSegment.ENTERPRISE]: 20
  },
  volumeDiscountTiers: [
    { minQuantity: 2, discountPercent: 5 },
    { minQuantity: 5, discountPercent: 10 },
    { minQuantity: 10, discountPercent: 15 },
    { minQuantity: 20, discountPercent: 20 }
  ],
  seasonalMultiplier: {
    'peak': 1.25,
    'high': 1.15,
    'normal': 1.0,
    'low': 0.85,
    'off': 0.75
  }
};

export function validateEnv(): void {
  const required = ['NODE_ENV', 'LOG_LEVEL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(`Missing environment variables: ${missing.join(', ')}. Using defaults.`);
  }
}

export function calculateDynamicPrice(basePrice: number, factors: PricingFactors): number {
  let finalPrice = basePrice;

  const season = getCurrentSeason();
  const seasonMultiplier = PRICING_CONFIG.seasonalMultiplier[season] || 1.0;
  finalPrice *= seasonMultiplier;

  const demandMultiplier = 1 + (factors.demandScore * (PRICING_CONFIG.surgeMultiplierMax - 1));
  finalPrice *= demandMultiplier;

  const loyaltyDiscount = PRICING_CONFIG.loyaltyDiscountPercent[factors.segment] / 100;
  finalPrice *= (1 - loyaltyDiscount);

  const volumeDiscount = getVolumeDiscount(factors.quantity);
  finalPrice *= (1 - volumeDiscount);

  if (factors.timeToTravel > 30) {
    const earlyBirdDiscount = Math.min(0.1, factors.timeToTravel / 365);
    finalPrice *= (1 - earlyBirdDiscount);
  } else if (factors.timeToTravel < 3) {
    const lastMinutePremium = 0.15;
    finalPrice *= (1 + lastMinutePremium);
  }

  if (factors.inventoryLevel < 5) {
    finalPrice *= 1.1;
  } else if (factors.inventoryLevel > 20) {
    finalPrice *= 0.95;
  }

  if (factors.bookingDay === 'weekend') {
    finalPrice *= 1.08;
  }

  if (factors.specialOccasion) {
    finalPrice *= 1.12;
  }

  if (factors.repeatCustomer) {
    finalPrice *= 0.97;
  }

  const minPrice = basePrice * PRICING_CONFIG.minPricePercent;
  const maxDiscount = basePrice * (1 - PRICING_CONFIG.maxDiscountPercent / 100);

  finalPrice = Math.max(minPrice, Math.min(basePrice * PRICING_CONFIG.surgeMultiplierMax, finalPrice));

  if (finalPrice < maxDiscount) {
    finalPrice = maxDiscount;
  }

  return Math.round(finalPrice * 100) / 100;
}

function getVolumeDiscount(quantity: number): number {
  const sortedTiers = [...PRICING_CONFIG.volumeDiscountTiers].sort((a, b) => b.minQuantity - a.minQuantity);

  for (const tier of sortedTiers) {
    if (quantity >= tier.minQuantity) {
      return tier.discountPercent / 100;
    }
  }

  return 0;
}

function getCurrentSeason(): 'peak' | 'high' | 'normal' | 'low' | 'off' {
  const month = new Date().getMonth();
  const dayOfWeek = new Date().getDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = isMajorHoliday(month);

  if (isHoliday) return 'peak';
  if (isSummer(month)) return 'high';
  if (isWinter(month) && isWeekend) return 'high';
  if (isShoulderSeason(month)) return 'normal';
  return 'low';
}

function isSummer(month: number): boolean {
  return month >= 5 && month <= 7;
}

function isWinter(month: number): boolean {
  return month === 11 || month <= 1;
}

function isShoulderSeason(month: number): boolean {
  return month === 3 || month === 4 || month === 9 || month === 10;
}

function isMajorHoliday(month: number): boolean {
  const holidayMonths = [6, 11, 11];
  return month === 6 || month === 11;
}

export function getDiscountEligibility(params: {
  customerId: string | null;
  segment: CustomerSegment;
  lifetimeValue: number;
  totalOrders: number;
  cartValue: number;
}): DiscountEligibility {
  const discounts: Discount[] = [];
  const suggestions: string[] = [];
  let loyaltyBonus = 0;
  let potentialSavings = 0;

  const segmentDiscount = PRICING_CONFIG.loyaltyDiscountPercent[params.segment];
  if (segmentDiscount > 0) {
    discounts.push({
      name: `${getSegmentDisplayName(params.segment)} Discount`,
      description: `${segmentDiscount}% off for ${getSegmentDisplayName(params.segment).toLowerCase()}s`,
      code: `SEGMENT_${params.segment.toUpperCase()}`,
      type: 'percentage',
      value: segmentDiscount
    });
    loyaltyBonus = segmentDiscount;
  }

  if (params.totalOrders >= 3) {
    const loyaltyTier = calculateLoyaltyTier(params.totalOrders, params.lifetimeValue);
    if (loyaltyTier > 0) {
      discounts.push({
        name: 'Loyalty Reward',
        description: `${loyaltyTier}% additional loyalty reward`,
        code: 'LOYALTY_REWARD',
        type: 'percentage',
        value: loyaltyTier
      });
      potentialSavings += params.cartValue * (loyaltyTier / 100);
    }
  }

  if (params.cartValue >= 500) {
    discounts.push({
      name: 'Big Order Discount',
      description: '$50 off orders over $500',
      code: 'BIG_ORDER',
      type: 'fixed',
      value: 50,
      minPurchase: 500,
      maxDiscount: 50
    });
    potentialSavings += 50;
  } else if (params.cartValue >= 200) {
    suggestions.push('Add $' + (500 - params.cartValue).toFixed(2) + ' more to your cart to unlock a $50 discount!');
  }

  if (params.lifetimeValue >= 1000) {
    const referralDiscount: Discount = {
      name: 'Referral Bonus',
      description: 'Refer a friend and both get 10% off',
      code: 'REFER_FRIEND',
      type: 'percentage',
      value: 10,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    discounts.push(referralDiscount);
    potentialSavings += params.cartValue * 0.1;
  }

  if (params.totalOrders === 0 && params.cartValue > 0) {
    discounts.push({
      name: 'First Order Discount',
      description: '15% off your first booking',
      code: 'WELCOME15',
      type: 'percentage',
      value: 15,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    potentialSavings += params.cartValue * 0.15;
    suggestions.push('Use code WELCOME15 for 15% off your first order!');
  }

  if (discounts.length === 0 && params.cartValue < 200) {
    suggestions.push('Book more frequently to unlock loyalty rewards');
    suggestions.push('Consider our bundle packages for better value');
  }

  let nextTier: string | null = null;
  if (params.segment === CustomerSegment.NEW_CUSTOMER) {
    nextTier = 'Returning Customer (5% discount on all bookings)';
  } else if (params.segment === CustomerSegment.RETURNING) {
    nextTier = 'VIP Status (15% discount + priority support)';
  } else if (params.segment === CustomerSegment.VIP) {
    nextTier = 'Enterprise Partner (20% discount + dedicated account manager)';
  }

  return {
    eligible: discounts.length > 0,
    applicableDiscounts: discounts,
    loyaltyBonus,
    potentialSavings,
    nextTier,
    suggestions
  };
}

function getSegmentDisplayName(segment: CustomerSegment): string {
  const names: Record<CustomerSegment, string> = {
    [CustomerSegment.NEW_CUSTOMER]: 'New Customer',
    [CustomerSegment.RETURNING]: 'Returning Customer',
    [CustomerSegment.VIP]: 'VIP Member',
    [CustomerSegment.ENTERPRISE]: 'Enterprise Partner'
  };
  return names[segment];
}

function calculateLoyaltyTier(totalOrders: number, lifetimeValue: number): number {
  if (totalOrders >= 20 || lifetimeValue >= 10000) return 10;
  if (totalOrders >= 10 || lifetimeValue >= 5000) return 7;
  if (totalOrders >= 5 || lifetimeValue >= 2000) return 5;
  if (totalOrders >= 3 || lifetimeValue >= 500) return 3;
  return 0;
}

export function calculateBundlePrice(items: Array<{ basePrice: number; quantity: number }>): {
  originalTotal: number;
  bundlePrice: number;
  savings: number;
  savingsPercent: number;
} {
  const originalTotal = items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  let bundleDiscount = 0;

  if (totalQuantity >= 4) {
    bundleDiscount = 0.15;
  } else if (totalQuantity >= 3) {
    bundleDiscount = 0.10;
  } else if (totalQuantity >= 2) {
    bundleDiscount = 0.05;
  }

  const bundlePrice = originalTotal * (1 - bundleDiscount);
  const savings = originalTotal - bundlePrice;
  const savingsPercent = originalTotal > 0 ? (savings / originalTotal) * 100 : 0;

  return {
    originalTotal: Math.round(originalTotal * 100) / 100,
    bundlePrice: Math.round(bundlePrice * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    savingsPercent: Math.round(savingsPercent * 10) / 10
  };
}

export function calculatePriceWithPromoCode(
  basePrice: number,
  promoCode: string,
  customerSegment: CustomerSegment
): { finalPrice: number; discount: number; message: string } {
  const promoCodes: Record<string, { discount: number; type: 'percentage' | 'fixed'; message: string }> = {
    'SAVE20': { discount: 20, type: 'percentage', message: '20% discount applied!' },
    'FLASH50': { discount: 50, type: 'fixed', message: '$50 discount applied!' },
    'SUMMER25': { discount: 25, type: 'percentage', message: '25% summer sale applied!' },
    'WELCOME15': { discount: 15, type: 'percentage', message: '15% welcome discount applied!' },
    'VIP30': { discount: 30, type: 'percentage', message: '30% VIP exclusive discount applied!' },
    'EARLYBIRD10': { discount: 10, type: 'percentage', message: '10% early bird discount applied!' },
    'HOLIDAY20': { discount: 20, type: 'percentage', message: '20% holiday special applied!' }
  };

  const promo = promoCodes[promoCode.toUpperCase()];

  if (!promo) {
    return {
      finalPrice: basePrice,
      discount: 0,
      message: 'Invalid promo code. Please check and try again.'
    };
  }

  let discount: number;
  if (promo.type === 'percentage') {
    discount = basePrice * (promo.discount / 100);
  } else {
    discount = Math.min(promo.discount, basePrice);
  }

  const finalPrice = Math.round((basePrice - discount) * 100) / 100;

  return {
    finalPrice,
    discount: Math.round(discount * 100) / 100,
    message: promo.message
  };
}

export function estimateTaxesAndFees(basePrice: number, countryCode: string = 'US'): {
  subtotal: number;
  tax: number;
  serviceFee: number;
  total: number;
  breakdown: Array<{ name: string; amount: number; rate?: number }>;
} {
  const taxRates: Record<string, number> = {
    'US': 0.0875,
    'UK': 0.20,
    'EU': 0.21,
    'CA': 0.13,
    'AU': 0.10,
    'JP': 0.10,
    'IN': 0.18,
    'SG': 0.08,
    'AE': 0.05,
    'DEFAULT': 0.10
  };

  const taxRate = taxRates[countryCode] || taxRates['DEFAULT'];
  const tax = basePrice * taxRate;
  const serviceFee = basePrice * 0.03;
  const subtotal = basePrice;
  const total = subtotal + tax + serviceFee;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    breakdown: [
      { name: 'Subtotal', amount: subtotal },
      { name: 'Tax', amount: tax, rate: taxRate },
      { name: 'Service Fee', amount: serviceFee, rate: 0.03 }
    ]
  };
}

export function generatePriceValidUntil(basePrice: number): Date {
  const validityMinutes = 15;
  return new Date(Date.now() + validityMinutes * 60 * 1000);
}

export function isPriceValid(priceTimestamp: Date): boolean {
  const validityMinutes = 15;
  const expiryTime = new Date(priceTimestamp.getTime() + validityMinutes * 60 * 1000);
  return new Date() < expiryTime;
}
