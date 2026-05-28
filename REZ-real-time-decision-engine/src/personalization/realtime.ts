import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface PersonalizationRequest {
  userId: string;
  sessionId: string;
  contentType: ContentType;
  context: PersonalizationContext;
  audience?: string[];
}

export type ContentType =
  | 'hero_banner'
  | 'featured_products'
  | 'promotional_section'
  | 'content_feed'
  | 'notification'
  | 'email_template'
  | 'landing_page';

export interface PersonalizationContext {
  currentPage?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek?: 'weekday' | 'weekend';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: LocationContext;
  weather?: WeatherContext;
  season?: string;
  userSegments?: string[];
  browsingHistory?: string[];
  preferences?: UserPreferences;
}

export interface LocationContext {
  country: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface WeatherContext {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
  temperature?: number;
  humidity?: number;
}

export interface UserPreferences {
  favoriteCategories?: string[];
  brandAffinities?: string[];
  priceRange?: { min: number; max: number };
  colorPreferences?: string[];
  stylePreferences?: string[];
  communicationStyle?: 'formal' | 'casual' | 'friendly';
}

export interface PersonalizationResult {
  content: PersonalizedContent;
  signals: PersonalizationSignal[];
  metadata: Record<string, unknown>;
  processingTimeMs: number;
}

export interface PersonalizedContent {
  id: string;
  type: ContentType;
  elements: ContentElement[];
  layout: LayoutConfig;
  copy: CopyVariants;
  ctas: CTACollection;
  metadata: Record<string, unknown>;
}

export interface ContentElement {
  id: string;
  type: 'image' | 'video' | 'text' | 'product' | 'category' | 'cta';
  content: Record<string, unknown>;
  position: { x: number; y: number };
  style: Record<string, unknown>;
}

export interface LayoutConfig {
  template: string;
  columns: number;
  spacing: 'compact' | 'standard' | 'spacious';
  alignment: 'left' | 'center' | 'right';
}

export interface CopyVariants {
  headline: string;
  subheadline?: string;
  body?: string;
  alternatives?: { variant: string; headline: string; subheadline?: string }[];
}

export interface CTACollection {
  primary?: CTA;
  secondary?: CTA;
  tertiary?: CTA;
}

export interface CTA {
  text: string;
  url: string;
  style: 'primary' | 'secondary' | 'ghost';
  analyticsLabel: string;
}

export interface PersonalizationSignal {
  name: string;
  value: string | number | boolean;
  weight: number;
  source: 'profile' | 'behavior' | 'context' | 'ml_model';
}

export interface PersonalizationRule {
  id: string;
  name: string;
  priority: number;
  condition: (request: PersonalizationRequest, context: UserContext) => boolean;
  modifications: ContentModification[];
}

export interface UserContext {
  profile: UserProfile;
  behavior: UserBehavior;
  realTime: RealTimeContext;
}

export interface UserProfile {
  userId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  accountAge: number;
  totalSpent: number;
  avgOrderValue: number;
  categories: string[];
  brands: string[];
  lifetimeValue: number;
}

export interface UserBehavior {
  lastVisit: string;
  visitFrequency: 'daily' | 'weekly' | 'monthly' | 'rare';
  conversionRate: number;
  cartAbandonmentRate: number;
  topCategories: string[];
  recentViews: string[];
  recentPurchases: string[];
}

export interface RealTimeContext {
  currentSession: SessionData;
  deviceInfo: DeviceInfo;
  location: LocationContext;
  weather?: WeatherContext;
}

export interface SessionData {
  duration: number;
  pages: string[];
  events: string[];
  cartValue?: number;
  inCheckout: boolean;
}

export interface DeviceInfo {
  type: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  screenSize?: string;
}

export interface ContentModification {
  elementType: 'image' | 'headline' | 'cta' | 'layout';
  modification: Partial<ContentElement | CopyVariants | LayoutConfig | CTACollection>;
  reason: string;
}

export class RealTimePersonalization {
  private logger: Logger;
  private rules: PersonalizationRule[];

  constructor(logger: Logger) {
    this.logger = logger;
    this.rules = this.initializeRules();
  }

  private initializeRules(): PersonalizationRule[] {
    return [
      // Time-based rules
      {
        id: 'time_morning',
        name: 'Morning Personalization',
        priority: 10,
        condition: (req, ctx) => ctx.realTime.currentSession.duration < 300 && req.context.timeOfDay === 'morning',
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Good morning! Start your day right' },
            reason: 'Early morning greeting',
          },
        ],
      },
      {
        id: 'time_evening',
        name: 'Evening Personalization',
        priority: 10,
        condition: (req, ctx) => req.context.timeOfDay === 'evening',
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Evening deals just for you' },
            reason: 'Evening time context',
          },
        ],
      },

      // Device-based rules
      {
        id: 'mobile_user',
        name: 'Mobile Optimization',
        priority: 15,
        condition: (req) => req.context.deviceType === 'mobile',
        modifications: [
          {
            elementType: 'layout',
            modification: { columns: 1, spacing: 'compact' },
            reason: 'Mobile-optimized layout',
          },
          {
            elementType: 'image',
            modification: { content: { format: 'mobile_first' } },
            reason: 'Mobile-friendly imagery',
          },
        ],
      },
      {
        id: 'desktop_user',
        name: 'Desktop Experience',
        priority: 15,
        condition: (req) => req.context.deviceType === 'desktop',
        modifications: [
          {
            elementType: 'layout',
            modification: { columns: 3, spacing: 'standard' },
            reason: 'Desktop-optimized layout',
          },
        ],
      },

      // Weather-based rules
      {
        id: 'weather_rainy',
        name: 'Rainy Day Deals',
        priority: 12,
        condition: (req, ctx) => ctx.realTime.weather?.condition === 'rainy',
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Indoor fun awaits! ☔' },
            reason: 'Rainy weather context',
          },
          {
            elementType: 'cta',
            modification: { primary: { text: 'Shop Indoor Items', url: '/indoor', style: 'primary', analyticsLabel: 'weather_cta' } },
            reason: 'Weather-appropriate CTA',
          },
        ],
      },
      {
        id: 'weather_sunny',
        name: 'Sunny Day Promotions',
        priority: 12,
        condition: (req, ctx) => ctx.realTime.weather?.condition === 'sunny',
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Make the most of the sunshine!' },
            reason: 'Sunny weather context',
          },
        ],
      },

      // Tier-based rules
      {
        id: 'tier_gold',
        name: 'Gold Tier Experience',
        priority: 20,
        condition: (req, ctx) => ctx.profile.tier === 'gold' || ctx.profile.tier === 'platinum',
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Exclusive for our VIP members' },
            reason: 'VIP tier treatment',
          },
          {
            elementType: 'cta',
            modification: { primary: { text: 'View VIP Offers', url: '/vip-offers', style: 'primary', analyticsLabel: 'vip_cta' } },
            reason: 'Premium styling',
          },
        ],
      },

      // Behavioral rules
      {
        id: 'cart_abandoner',
        name: 'Cart Abandonment Recovery',
        priority: 25,
        condition: (req, ctx) => ctx.behavior.cartAbandonmentRate > 0.5,
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Your cart is waiting!' },
            reason: 'Cart abandonment recovery',
          },
          {
            elementType: 'cta',
            modification: { primary: { text: 'Complete Your Purchase', url: '/checkout', style: 'primary', analyticsLabel: 'cart_recovery' } },
            reason: 'Recovery CTA',
          },
        ],
      },
      {
        id: 'high_intent',
        name: 'High Purchase Intent',
        priority: 22,
        condition: (req, ctx) => ctx.realTime.currentSession.inCheckout,
        modifications: [
          {
            elementType: 'headline',
            modification: { headline: 'Complete your order and save!' },
            reason: 'Checkout context',
          },
          {
            elementType: 'cta',
            modification: { primary: { text: 'Finish Order', url: '/checkout', style: 'primary', analyticsLabel: 'checkout_cta' }, secondary: { text: 'Need Help?', url: '/help', style: 'ghost', analyticsLabel: 'help_cta' } },
            reason: 'Checkout CTAs',
          },
        ],
      },

      // Location-based rules
      {
        id: 'region_specific',
        name: 'Regional Content',
        priority: 18,
        condition: (req) => req.context.location?.country !== undefined,
        modifications: [
          {
            elementType: 'image',
            modification: { content: { region: 'dynamic' } }, // Region set dynamically at runtime
            reason: 'Regional imagery',
          },
        ],
      },
    ];
  }

  async getPersonalizedContent(request: PersonalizationRequest): Promise<PersonalizationResult> {
    const startTime = Date.now();
    const resultId = uuidv4();

    try {
      this.logger.info({
        resultId,
        userId: request.userId,
        contentType: request.contentType,
        context: request.context,
      }, 'Generating personalized content');

      // Fetch user context
      const userContext = await this.buildUserContext(request);

      // Generate base content
      const baseContent = this.generateBaseContent(request.contentType, userContext);

      // Apply personalization rules
      const appliedRules = this.applyPersonalizationRules(request, userContext);

      // Generate personalization signals
      const signals = this.generateSignals(request, userContext, appliedRules);

      // Build final content
      const personalizedContent = this.buildContent(baseContent, appliedRules, userContext);

      const result: PersonalizationResult = {
        content: personalizedContent,
        signals,
        metadata: {
          resultId,
          userId: request.userId,
          sessionId: request.sessionId,
          rulesApplied: appliedRules.map(r => r.id),
          contentType: request.contentType,
        },
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.info({
        resultId,
        userId: request.userId,
        rulesApplied: appliedRules.length,
        signalsCount: signals.length,
        processingTimeMs: result.processingTimeMs,
      }, 'Personalization complete');

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error({ resultId, error: err.message }, 'Personalization failed');
      throw error;
    }
  }

  private async buildUserContext(request: PersonalizationRequest): Promise<UserContext> {
    // Fetch user profile
    const profile = await this.fetchUserProfile(request.userId);

    // Fetch user behavior
    const behavior = await this.fetchUserBehavior(request.userId);

    // Build real-time context
    const realTime: RealTimeContext = {
      currentSession: {
        duration: behavior.currentSessionDuration || 0,
        pages: behavior.recentPages || [],
        events: [],
        inCheckout: behavior.recentPages?.includes('checkout') || false,
      },
      deviceInfo: {
        type: request.context.deviceType || 'desktop',
        browser: 'unknown',
        os: 'unknown',
      },
      location: request.context.location || { country: 'US' },
      weather: request.context.weather,
    };

    return { profile, behavior, realTime };
  }

  private async fetchUserProfile(userId: string): Promise<UserProfile> {
    // Would fetch from User Service
    return {
      userId,
      tier: 'silver',
      accountAge: 120,
      totalSpent: 2500,
      avgOrderValue: 125,
      categories: ['electronics', 'accessories'],
      brands: ['BrandA', 'BrandB'],
      lifetimeValue: 3000,
    };
  }

  private async fetchUserBehavior(userId: string): Promise<UserBehavior & { currentSessionDuration?: number; recentPages?: string[] }> {
    // Would fetch from Analytics Service
    return {
      lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      visitFrequency: 'weekly',
      conversionRate: 0.15,
      cartAbandonmentRate: 0.3,
      topCategories: ['electronics'],
      recentViews: [],
      recentPurchases: [],
      currentSessionDuration: 180,
      recentPages: ['home', 'category', 'product'],
    };
  }

  private generateBaseContent(
    contentType: ContentType,
    context: UserContext
  ): PersonalizedContent {
    const templates: Record<ContentType, Partial<PersonalizedContent>> = {
      hero_banner: {
        elements: [
          {
            id: 'hero-image',
            type: 'image',
            content: { url: '/images/hero-default.jpg', alt: 'Hero Banner' },
            position: { x: 0, y: 0 },
            style: { width: '100%', height: '400px' },
          },
          {
            id: 'hero-headline',
            type: 'text',
            content: { headline: 'Welcome to REZ' },
            position: { x: 10, y: 20 },
            style: { fontSize: '48px', color: '#fff' },
          },
        ],
        layout: { template: 'hero', columns: 1, spacing: 'standard', alignment: 'center' },
        copy: {
          headline: 'Welcome to REZ',
          subheadline: 'Discover amazing products',
          body: 'Your one-stop destination for everything you need.',
        },
        ctas: {
          primary: { text: 'Shop Now', url: '/shop', style: 'primary', analyticsLabel: 'hero_cta_primary' },
          secondary: { text: 'Learn More', url: '/about', style: 'secondary', analyticsLabel: 'hero_cta_secondary' },
        },
      },
      featured_products: {
        elements: [],
        layout: { template: 'grid', columns: 4, spacing: 'standard', alignment: 'left' },
        copy: { headline: 'Featured Products', subheadline: 'Handpicked just for you' },
        ctas: { primary: { text: 'View All', url: '/products', style: 'secondary', analyticsLabel: 'featured_view_all' } },
      },
      promotional_section: {
        elements: [],
        layout: { template: 'promo', columns: 2, spacing: 'spacious', alignment: 'center' },
        copy: { headline: 'Special Offers', subheadline: 'Limited time deals' },
        ctas: { primary: { text: 'Shop Sale', url: '/sale', style: 'primary', analyticsLabel: 'promo_shop_sale' } },
      },
      content_feed: {
        elements: [],
        layout: { template: 'feed', columns: 1, spacing: 'compact', alignment: 'left' },
        copy: { headline: 'For You', subheadline: 'Based on your interests' },
        ctas: {},
      },
      notification: {
        elements: [],
        layout: { template: 'notification', columns: 1, spacing: 'standard', alignment: 'left' },
        copy: { headline: 'New Update', body: 'Check out what\'s new!' },
        ctas: { primary: { text: 'View', url: '/updates', style: 'primary', analyticsLabel: 'notification_cta' } },
      },
      email_template: {
        elements: [],
        layout: { template: 'email', columns: 1, spacing: 'standard', alignment: 'center' },
        copy: { headline: 'Hello!', subheadline: 'We have something for you', body: 'Check out our latest offers.' },
        ctas: { primary: { text: 'Explore', url: '/email/cta', style: 'primary', analyticsLabel: 'email_cta' } },
      },
      landing_page: {
        elements: [],
        layout: { template: 'landing', columns: 3, spacing: 'standard', alignment: 'center' },
        copy: { headline: 'Welcome', subheadline: 'Start your journey with us' },
        ctas: { primary: { text: 'Get Started', url: '/signup', style: 'primary', analyticsLabel: 'landing_cta' } },
      },
    };

    return {
      id: uuidv4(),
      type: contentType,
      ...templates[contentType],
      metadata: {},
    } as PersonalizedContent;
  }

  private applyPersonalizationRules(
    request: PersonalizationRequest,
    context: UserContext
  ): PersonalizationRule[] {
    const matchingRules = this.rules
      .filter(rule => rule.condition(request, context))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    this.logger.info({
      userId: request.userId,
      matchingRules: matchingRules.map(r => r.id),
      totalRules: matchingRules.length,
    }, 'Applied personalization rules');

    return matchingRules;
  }

  private generateSignals(
    request: PersonalizationRequest,
    context: UserContext,
    appliedRules: PersonalizationRule[]
  ): PersonalizationSignal[] {
    const signals: PersonalizationSignal[] = [];

    // Profile signals
    signals.push({
      name: 'user_tier',
      value: context.profile.tier,
      weight: 0.3,
      source: 'profile',
    });
    signals.push({
      name: 'account_age',
      value: context.profile.accountAge,
      weight: 0.1,
      source: 'profile',
    });

    // Behavior signals
    signals.push({
      name: 'visit_frequency',
      value: context.behavior.visitFrequency,
      weight: 0.25,
      source: 'behavior',
    });
    signals.push({
      name: 'conversion_rate',
      value: context.behavior.conversionRate,
      weight: 0.2,
      source: 'behavior',
    });

    // Context signals
    if (request.context.timeOfDay) {
      signals.push({
        name: 'time_of_day',
        value: request.context.timeOfDay,
        weight: 0.15,
        source: 'context',
      });
    }
    if (request.context.weather) {
      signals.push({
        name: 'weather_condition',
        value: request.context.weather.condition,
        weight: 0.1,
        source: 'context',
      });
    }

    // Applied rules
    signals.push({
      name: 'personalization_rules_applied',
      value: appliedRules.length,
      weight: 0.05,
      source: 'ml_model',
    });

    return signals;
  }

  private buildContent(
    baseContent: PersonalizedContent,
    appliedRules: PersonalizationRule[],
    context: UserContext
  ): PersonalizedContent {
    const content = JSON.parse(JSON.stringify(baseContent)); // Deep clone

    // Apply modifications from rules
    for (const rule of appliedRules) {
      for (const mod of rule.modifications) {
        this.applyModification(content, mod);
      }
    }

    // Add rule metadata
    content.metadata.appliedRules = appliedRules.map(r => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
    }));

    return content;
  }

  private applyModification(content: PersonalizedContent, mod: ContentModification): void {
    const modAny = mod.modification as Record<string, unknown>;
    switch (mod.elementType) {
      case 'headline':
        if (modAny.headline) {
          content.copy.headline = modAny.headline as string;
        }
        if (modAny.subheadline) {
          content.copy.subheadline = modAny.subheadline as string;
        }
        break;

      case 'layout':
        Object.assign(content.layout, mod.modification);
        break;

      case 'cta':
        if (content.ctas) {
          Object.assign(content.ctas, mod.modification);
        }
        break;

      case 'image':
        const imageElement = content.elements?.find(e => e.type === 'image');
        if (imageElement && modAny.content) {
          Object.assign(imageElement.content, modAny.content);
        }
        break;
    }
  }

  // Register custom rule
  registerRule(rule: PersonalizationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.logger.info({ ruleId: rule.id, ruleName: rule.name }, 'Registered custom personalization rule');
  }
}
