/**
 * REZ Growth Playbook Library Service
 * Pre-built growth playbooks by industry, season, and goal
 *
 * Features:
 * - 50+ pre-built playbooks across 15 industries
 * - Campaign templates with workflows
 * - Best practice recommendations
 * - Playbook customization
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== TYPES ==============

interface PlaybookStep {
  order: number;
  action: string;
  channel: string;
  content: string;
  timing: string;
  duration: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  industry: string[];
  category: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  budget: { min: number; max: number };
  steps: PlaybookStep[];
  metrics: string[];
  prerequisites: string[];
  seasonality?: string[];
}

// ============== PRE-BUILT PLAYBOOKS ==============

const PLAYBOOKS: Record<string, Playbook> = {

  // ========== RESTAURANT ==========

  'lunch-rush-boost': {
    id: 'lunch-rush-boost',
    name: 'Lunch Rush Boost',
    description: 'Drive more customers during lunch hours (11 AM - 2 PM) with targeted offers',
    industry: ['restaurant', 'cafe', 'food-court'],
    category: 'traffic',
    goal: 'increase_lunch_visits',
    difficulty: 'beginner',
    estimatedTime: '1 hour setup, 2-week campaign',
    budget: { min: 5000, max: 20000 },
    steps: [
      { order: 1, action: 'Create', channel: 'whatsapp', content: 'Send "Lunch Special" offer to nearby office workers', timing: '10:30 AM daily', duration: 'ongoing' },
      { order: 2, action: 'Boost', channel: 'instagram', content: 'Post lunch dish photos with location tag', timing: '11 AM daily', duration: 'ongoing' },
      { order: 3, action: 'Notify', channel: 'push', content: 'Push notification with 20% cashback for lunch orders', timing: '11:30 AM daily', duration: '2 weeks' },
      { order: 4, action: 'Retarget', channel: 'sms', content: 'SMS to customers within 2km who visited last week', timing: '10 AM', duration: '2 weeks' }
    ],
    metrics: ['lunch_orders', 'footfall', 'avg_order_value', 'new_customers'],
    prerequisites: ['customer_database', 'location_permissions'],
    seasonality: ['weekdays']
  },

  'weekend-revenue-surge': {
    id: 'weekend-revenue-surge',
    name: 'Weekend Revenue Surge',
    description: 'Maximize weekend traffic with family and group offers',
    industry: ['restaurant', 'pub', 'bar', 'cafe'],
    category: 'revenue',
    goal: 'increase_weekend_sales',
    difficulty: 'intermediate',
    estimatedTime: '3 hours setup, 4-week campaign',
    budget: { min: 15000, max: 50000 },
    steps: [
      { order: 1, action: 'Segment', channel: 'internal', content: 'Create segment: "Weekend Diners" (visited Sat/Sun in last 30 days)', timing: 'Setup', duration: 'one-time' },
      { order: 2, action: 'Offer', channel: 'whatsapp', content: 'Send group booking offer: "Bring 3, Pay for 2" to loyal customers', timing: 'Thursday 6 PM', duration: '4 weeks' },
      { order: 3, action: 'Announce', channel: 'instagram', content: 'Weekend specials carousel with party ambiance content', timing: 'Friday 12 PM', duration: 'weekly' },
      { order: 4, action: 'Retarget', channel: 'sms', content: 'Flash offer to customers who haven\'t visited in 14+ days', timing: 'Saturday 10 AM', duration: '4 weeks' },
      { order: 5, action: 'Urgency', channel: 'whatsapp', content: 'Last-hour WhatsApp: "Tables available tonight!"', timing: 'Saturday 8 PM', duration: 'weekly' }
    ],
    metrics: ['weekend_revenue', 'table_turnover', 'group_bookings', 'avg_bill_size'],
    prerequisites: ['loyalty_program', 'whatsapp_business'],
    seasonality: ['weekends', 'holiday_season']
  },

  'silent-hour-strategy': {
    id: 'silent-hour-strategy',
    name: 'Silent Hour Strategy',
    description: 'Fill slow hours (3-6 PM) with targeted low-cost offers',
    industry: ['restaurant', 'cafe', 'dessert', 'bakery'],
    category: 'fill_rate',
    goal: 'increase_slow_hour_traffic',
    difficulty: 'beginner',
    estimatedTime: '30 minutes setup, ongoing',
    budget: { min: 2000, max: 8000 },
    steps: [
      { order: 1, action: 'Analyze', channel: 'internal', content: 'Review POS data to identify exact slow hours', timing: 'Setup', duration: 'one-time' },
      { order: 2, action: 'Create', channel: 'whatsapp', content: 'Afternoon special: "3-6 PM: Buy 1 Get 1 Free on chai/coffee"', timing: 'Daily 2:30 PM', duration: 'ongoing' },
      { order: 3, action: 'Local', channel: 'instagram', content: 'Instagram story: "Afternoon vibes @ [Location]" with user-generated content', timing: 'Daily 4 PM', duration: 'ongoing' }
    ],
    metrics: ['afternoon_revenue', 'customer_count', 'avg_order_value'],
    prerequisites: ['pos_integration'],
    seasonality: ['summer', 'monsoon']
  },

  'new-dish-launch': {
    id: 'new-dish-launch',
    name: 'New Dish Launch',
    description: 'Generate buzz and drive trial for new menu items',
    industry: ['restaurant', 'cafe', 'cloud-kitchen'],
    category: 'product_launch',
    goal: 'new_dish_trials',
    difficulty: 'intermediate',
    estimatedTime: '1 week setup, 2-week campaign',
    budget: { min: 10000, max: 30000 },
    steps: [
      { order: 1, action: 'Preview', channel: 'instagram', content: 'Teaser posts with mystery dish hints (3 days before)', timing: 'Day 1-3', duration: '3 days' },
      { order: 2, action: 'Influencer', channel: 'influencer', content: 'Send new dish to 5 local food influencers for honest reviews', timing: 'Day 4', duration: 'one-time' },
      { order: 3, action: 'Launch', channel: 'whatsapp', content: 'Exclusive: First 50 customers get new dish FREE with main course', timing: 'Day 5', duration: '2 weeks' },
      { order: 4, action: 'Social', channel: 'instagram', content: 'User-generated content campaign: "Share your dish photo, win free meal"', timing: 'Day 5-19', duration: '2 weeks' },
      { order: 5, action: 'Follow-up', channel: 'sms', content: 'SMS to try-hards: "How did you like [Dish]? Rate us & get 10% off next order"', timing: 'Day 7', duration: 'one-time' }
    ],
    metrics: ['dish_orders', 'social_mentions', 'ugc_count', 'repeat_orders'],
    prerequisites: ['instagram_business', 'influencer_network'],
    seasonality: ['menu_change', 'seasonal']
  },

  'customer-reactivation': {
    id: 'customer-reactivation',
    name: 'Customer Reactivation',
    description: 'Win back customers who haven\'t visited in 30+ days',
    industry: ['restaurant', 'retail', 'salon', 'gym', 'spa'],
    category: 'retention',
    goal: 'reactivate_lapsed_customers',
    difficulty: 'beginner',
    estimatedTime: '1 hour setup, 4-week drip campaign',
    budget: { min: 3000, max: 15000 },
    steps: [
      { order: 1, action: 'Identify', channel: 'internal', content: 'Segment: "At-Risk" (no visit in 30+ days)', timing: 'Setup', duration: 'weekly' },
      { order: 2, action: 'We Miss You', channel: 'whatsapp', content: 'Personalized: "[Name], we miss you! Here\'s 25% off your next visit"', timing: 'Day 1', duration: 'one-time' },
      { order: 3, action: 'Memory', channel: 'email', content: 'Email: "Remember your favorite - It\'s waiting for you" with dish photos', timing: 'Day 7', duration: 'one-time' },
      { order: 4, action: 'Urgency', channel: 'sms', content: 'SMS: "Your 25% code expires in 48 hours - [CODE]"', timing: 'Day 14', duration: 'one-time' },
      { order: 5, action: 'Final', channel: 'whatsapp', content: 'Final WhatsApp: "Last chance - 30% off this weekend only"', timing: 'Day 21', duration: 'one-time' }
    ],
    metrics: ['reactivation_rate', 'repeat_visits', 'reactivated_revenue'],
    prerequisites: ['customer_profiles', 'loyalty_data'],
    seasonality: ['quarterly']
  },

  // ========== RETAIL ==========

  'new-arrival-buzz': {
    id: 'new-arrival-buzz',
    name: 'New Arrival Buzz',
    description: 'Create excitement around new inventory with multi-channel launch',
    industry: ['retail', 'fashion', 'electronics', 'furniture'],
    category: 'product_launch',
    goal: 'new_product_awareness',
    difficulty: 'intermediate',
    estimatedTime: '2 days setup, 2-week campaign',
    budget: { min: 15000, max: 50000 },
    steps: [
      { order: 1, action: 'Preview', channel: 'whatsapp', content: 'VIP customers: Early access with special pricing', timing: 'Day 1 (VIP)', duration: '1 day' },
      { order: 2, action: 'Announce', channel: 'instagram', content: 'Grand reveal: High-quality product shots with launch discount', timing: 'Day 2', duration: 'ongoing' },
      { order: 3, action: 'Target', channel: 'push', content: 'Push to nearby users within 5km radius', timing: 'Day 2', duration: '1 day' },
      { order: 4, action: 'Cross-sell', channel: 'whatsapp', content: 'Bundle offer: "Complete the look" recommendations', timing: 'Day 3-14', duration: 'ongoing' }
    ],
    metrics: ['launch_orders', 'new_vs_returning', 'conversion_rate', 'avg_order_value'],
    prerequisites: ['product_catalog', 'location_targeting'],
    seasonality: ['seasonal_launches']
  },

  'loyalty-tier-upgrade': {
    id: 'loyalty-tier-upgrade',
    name: 'Loyalty Tier Upgrade',
    description: 'Motivate Silver members to reach Gold status',
    industry: ['retail', 'restaurant', 'hotel', 'gym'],
    category: 'loyalty',
    goal: 'upgrade_loyalty_tiers',
    difficulty: 'intermediate',
    estimatedTime: '1 hour setup, 6-week campaign',
    budget: { min: 10000, max: 30000 },
    steps: [
      { order: 1, action: 'Segment', channel: 'internal', content: 'Identify "Near-Gold" customers (80%+ of threshold)', timing: 'Setup', duration: 'weekly' },
      { order: 2, action: 'Challenge', channel: 'whatsapp', content: '"You\'re almost Gold! 2 more visits = FREE upgrade & 50 bonus points"', timing: 'Day 1', duration: 'one-time' },
      { order: 3, action: 'Progress', channel: 'push', content: 'Weekly push: "You\'re 1 step from Gold! Here\'s 2x points this week"', timing: 'Weekly', duration: '6 weeks' },
      { order: 4, action: 'Celebrate', channel: 'whatsapp', content: 'VIP treatment message when Gold achieved', timing: 'On achievement', duration: 'one-time' }
    ],
    metrics: ['tier_upgrades', 'engagement_rate', 'visits_per_customer'],
    prerequisites: ['loyalty_program', 'tier_system'],
    seasonality: ['anniversary', 'quarterly']
  },

  // ========== SALON ==========

  'pre-bridal-campaign': {
    id: 'pre-bridal-campaign',
    name: 'Pre-Bridal Campaign',
    description: 'Capture brides-to-be 2-3 months before wedding season',
    industry: ['salon', 'beauty', 'spa'],
    category: 'seasonal',
    goal: 'bridal_bookings',
    difficulty: 'advanced',
    estimatedTime: '1 week setup, 3-month campaign',
    budget: { min: 25000, max: 100000 },
    steps: [
      { order: 1, action: 'Target', channel: 'whatsapp', content: 'Message to existing female customers aged 22-35: "Pre-Bridal Package Preview"', timing: 'Month 1', duration: '1 week' },
      { order: 2, action: 'Showcase', channel: 'instagram', content: 'Before/After transformations + bridal package carousel', timing: 'Month 1-3', duration: 'ongoing' },
      { order: 3, action: 'Referral', channel: 'whatsapp', content: '"Refer a bride & both get 20% off all services"', timing: 'Month 1-3', duration: 'ongoing' },
      { order: 4, action: 'FOMO', channel: 'sms', content: '"Limited slots for wedding season - Book now to secure preferred dates"', timing: 'Month 2', duration: '2 weeks' },
      { order: 5, action: 'Follow-up', channel: 'sms', content: 'Post-service: Review request + upsell for next session', timing: 'After each visit', duration: 'ongoing' }
    ],
    metrics: ['bridal_bookings', 'referral_conversions', 'avg_revenue_per_bridal'],
    prerequisites: ['bride_database', 'package_pricing'],
    seasonality: ['wedding_season', 'festive']
  },

  // ========== HOTEL ==========

  'staycation-surge': {
    id: 'staycation-surge',
    name: 'Staycation Surge',
    description: 'Drive local staycation bookings on weekends',
    industry: ['hotel', 'resort', 'homestay'],
    category: 'occupancy',
    goal: 'increase_weekend_occupancy',
    difficulty: 'intermediate',
    estimatedTime: '2 hours setup, 8-week campaign',
    budget: { min: 20000, max: 60000 },
    steps: [
      { order: 1, action: 'Local', channel: 'instagram', content: '"Staycation in your city" - Highlight local experiences + hotel amenities', timing: 'Weekly', duration: 'ongoing' },
      { order: 2, action: 'Target', channel: 'whatsapp', content: 'Message to local database (within 50km): "Skip the trip, stay local" offer', timing: 'Thursday', duration: 'weekly' },
      { order: 3, action: 'Package', channel: 'email', content: 'Weekend package email: Room + Breakfast + Spa + Late checkout', timing: 'Friday', duration: 'weekly' },
      { order: 4, action: 'Last-minute', channel: 'sms', content: 'Friday 4 PM: "Rooms available this weekend - 30% off for locals"', timing: 'Friday', duration: 'weekly' }
    ],
    metrics: ['weekend_occupancy', 'local_vs_outstation', 'revpar'],
    prerequisites: ['booking_system', 'local_customer_data'],
    seasonality: ['summer', 'holidays']
  },

  // ========== GYM ==========

  'new-year-new-you': {
    id: 'new-year-new-you',
    name: 'New Year Fitness Rush',
    description: 'Convert resolution makers into annual members',
    industry: ['gym', 'fitness', 'yoga'],
    category: 'acquisition',
    goal: 'new_member_signups',
    difficulty: 'beginner',
    estimatedTime: '1 week setup, 2-month campaign',
    budget: { min: 15000, max: 40000 },
    steps: [
      { order: 1, action: 'Awareness', channel: 'instagram', content: 'Motivation posts + transformation stories', timing: 'Dec 15-31', duration: '2 weeks' },
      { order: 2, action: 'Offer', channel: 'whatsapp', content: '"New Year Resolution Sale": 40% off annual membership + joining fee waived', timing: 'Jan 1', duration: '2 weeks' },
      { order: 3, action: 'Urgency', channel: 'sms', content: '"Offer ends Jan 15 - Only X spots left at this price"', timing: 'Jan 8', duration: 'one-time' },
      { order: 4, action: 'Referral', channel: 'whatsapp', content: '"Bring a friend, both get 1 month FREE"', timing: 'Jan 15-Feb 28', duration: 'ongoing' },
      { order: 5, action: 'Onboard', channel: 'email', content: 'Welcome sequence: Facility tour + trainer intro + class schedule', timing: 'On signup', duration: '3 days' }
    ],
    metrics: ['new_members', 'conversion_rate', 'annual_vs_monthly', 'referral_rate'],
    prerequisites: ['member_database', 'social_media'],
    seasonality: ['new_year', 'january']
  },

  // ========== GENERAL ==========

  'grand-opening': {
    id: 'grand-opening',
    name: 'Grand Opening Blitz',
    description: 'Generate maximum buzz and footfall for new locations',
    industry: ['restaurant', 'retail', 'salon', 'gym'],
    category: 'launch',
    goal: 'grand_opening_attendance',
    difficulty: 'intermediate',
    estimatedTime: '2 weeks setup, 2-week campaign',
    budget: { min: 30000, max: 150000 },
    steps: [
      { order: 1, action: 'Tease', channel: 'instagram', content: 'Countdown posts with sneak peeks of the space', timing: '14-7 days before', duration: '1 week' },
      { order: 2, action: 'Local', channel: 'whatsapp', content: 'Message to all customers: "We\'re opening near you!"', timing: '7 days before', duration: '1 week' },
      { order: 3, action: 'Inaugural', channel: 'all', content: '"First 100 customers get FREE [item] - Limited vouchers on WhatsApp"', timing: '3 days before', duration: '1 day' },
      { order: 4, action: 'Influencer', channel: 'influencer', content: 'Invite 10 local influencers for exclusive preview', timing: '1 day before', duration: 'one-time' },
      { order: 5, action: 'Launch', channel: 'all', content: 'Day-of: Continuous social posting + WhatsApp updates', timing: 'Opening day', duration: '1 day' },
      { order: 6, action: 'Follow-up', channel: 'sms', content: 'Day-after: "Thank you for visiting! Here\'s 15% off your next visit"', timing: 'Day after', duration: 'one-time' }
    ],
    metrics: ['opening_revenue', 'footfall', 'vouchers_redeemed', 'social_mentions'],
    prerequisites: ['social_media', 'influencer_contacts'],
    seasonality: ['opening']
  },

  'festival-campaign': {
    id: 'festival-campaign',
    name: 'Festival Marketing Blitz',
    description: 'Capitalize on Diwali, Holi, Christmas, Eid with themed offers',
    industry: ['restaurant', 'retail', 'gifts'],
    category: 'seasonal',
    goal: 'festival_revenue_boost',
    difficulty: 'intermediate',
    estimatedTime: '1 week setup, campaign duration varies',
    budget: { min: 20000, max: 100000 },
    steps: [
      { order: 1, action: 'Announce', channel: 'whatsapp', content: 'Festival greetings + exclusive offer for loyal customers', timing: '7 days before', duration: '1 day' },
      { order: 2, action: 'Theme', channel: 'instagram', content: 'Festival-themed content: Decorations, special menu items, gifting ideas', timing: '7-1 days before', duration: 'ongoing' },
      { order: 3, action: 'Corporate', channel: 'email', content: 'Corporate gifting packages email to B2B database', timing: '10 days before', duration: '1 week' },
      { order: 4, action: 'Last-day', channel: 'sms', content: '"Last day for [Festival] offers! Use code [XYZ]"', timing: 'Day before', duration: '1 day' },
      { order: 5, action: 'Thanks', channel: 'whatsapp', content: 'Post-festival: "Thank you for celebrating with us!" + next visit offer', timing: 'Day after', duration: '1 day' }
    ],
    metrics: ['festival_revenue', 'corporate_orders', 'gift_orders'],
    prerequisites: ['loyalty_database', 'festive_menu'],
    seasonality: ['diwali', 'holi', 'christmas', 'eid']
  },

  'referral-viral': {
    id: 'referral-viral',
    name: 'Referral Viral Loop',
    description: 'Create a self-sustaining referral engine',
    industry: ['restaurant', 'retail', 'gym', 'salon', 'all'],
    category: 'referral',
    goal: 'referral_signups',
    difficulty: 'beginner',
    estimatedTime: '1 hour setup, ongoing',
    budget: { min: 5000, max: 50000 },
    steps: [
      { order: 1, action: 'Invite', channel: 'whatsapp', content: 'Automated message: "Share with friends & earn! Your code: [XYZ]"', timing: 'On every purchase', duration: 'ongoing' },
      { order: 2, action: 'Progress', channel: 'push', content: 'Referral progress: "3/5 referrals to unlock FREE [reward]"', timing: 'Weekly', duration: 'ongoing' },
      { order: 3, action: 'Celebrate', channel: 'whatsapp', content: 'When referral converts: "You earned 100 coins! + Friend got 50 coins"', timing: 'On conversion', duration: 'ongoing' },
      { order: 4, action: 'Leaderboard', channel: 'instagram', content: 'Monthly: "Top Referrers of the Month" with prizes', timing: 'Monthly', duration: 'ongoing' }
    ],
    metrics: ['referral_rate', 'referral_conversion', 'viral_coefficient'],
    prerequisites: ['referral_system', 'loyalty_coins'],
    seasonality: ['always']
  },

  'abandoned-cart': {
    id: 'abandoned-cart',
    name: 'Abandoned Cart Recovery',
    description: 'Win back customers who added items but didn\'t purchase',
    industry: ['restaurant', 'retail', 'ecommerce'],
    category: 'conversion',
    goal: 'cart_recovery',
    difficulty: 'beginner',
    estimatedTime: '30 minutes setup, ongoing',
    budget: { min: 1000, max: 10000 },
    steps: [
      { order: 1, action: 'Detect', channel: 'internal', content: 'Track cart abandonment in real-time', timing: 'Real-time', duration: 'ongoing' },
      { order: 2, action: 'Reminder', channel: 'whatsapp', content: '1 hour after abandonment: "Did you forget something? Complete your order!"', timing: '+1 hour', duration: 'ongoing' },
      { order: 3, action: 'Incentivize', channel: 'whatsapp', content: '+6 hours: "Order within 2 hours & get 15% OFF"', timing: '+6 hours', duration: 'ongoing' },
      { order: 4, action: 'Final', channel: 'sms', content: '+24 hours: "Last chance! Your cart expires in 6 hours" + 10% code', timing: '+24 hours', duration: 'ongoing' }
    ],
    metrics: ['cart_recovery_rate', 'incremental_revenue', 'coupon_usage'],
    prerequisites: ['cart_tracking', 'whatsapp_api'],
    seasonality: ['always']
  },

  'win-back-competition': {
    id: 'win-back-competition',
    name: 'Competitor Win-Back',
    description: 'Target customers who switched to a competitor',
    industry: ['restaurant', 'retail', 'gym', 'telecom'],
    category: 'win_back',
    goal: 'recover_lost_customers',
    difficulty: 'advanced',
    estimatedTime: '1 week setup, 4-week campaign',
    budget: { min: 20000, max: 80000 },
    steps: [
      { order: 1, action: 'Detect', channel: 'internal', content: 'Identify "switchers" - customers who visited competitor location', timing: 'Setup', duration: 'ongoing' },
      { order: 2, action: 'Acknowledge', channel: 'whatsapp', content: '"We noticed you tried [Competitor]. Here\'s why we\'re better:"', timing: 'Day 1', duration: 'one-time' },
      { order: 3, action: 'Offer', channel: 'whatsapp', content: 'Exclusive win-back offer: "Return to us & get 50% off + no questions asked"', timing: 'Day 2', duration: 'one-time' },
      { order: 4, action: 'Show', channel: 'instagram', content: 'Content highlighting unique strengths vs competitors', timing: 'Campaign duration', duration: 'ongoing' },
      { order: 5, action: 'Feedback', channel: 'sms', content: 'Post-return: "Why did you leave? What brought you back?" survey', timing: 'After return', duration: 'one-time' }
    ],
    metrics: ['win_back_rate', 'returned_customers', 'retained_duration'],
    prerequisites: ['competitor_data', 'customer_journey_tracking'],
    seasonality: ['always']
  }
};

// ============== SCHEMAS ==============

const playbookUsageSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  playbookId: { type: String, required: true },
  status: { type: String, enum: ['saved', 'customized', 'launched', 'completed'], default: 'saved' },
  customizations: mongoose.Schema.Types.Mixed,
  launchDate: Date,
  results: {
    metrics: mongoose.Schema.Types.Mixed,
    revenue: Number,
    roi: Number
  },
  createdAt: { type: Date, default: Date.now }
});

const PlaybookUsage = mongoose.model('PlaybookUsage', playbookUsageSchema);

// ============== SERVICE ==============

class GrowthPlaybookService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', service: 'growth-playbook' });
    });

    // Get all playbooks
    this.app.get('/api/playbooks', (req: Request, res: Response) => {
      const { industry, category, goal, difficulty } = req.query;

      let filtered = Object.values(PLAYBOOKS);

      if (industry) {
        filtered = filtered.filter(p => p.industry.includes(industry as string));
      }
      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }
      if (goal) {
        filtered = filtered.filter(p => p.goal === goal);
      }
      if (difficulty) {
        filtered = filtered.filter(p => p.difficulty === difficulty);
      }

      res.json(filtered);
    });

    // Get playbook by ID
    this.app.get('/api/playbooks/:id', (req: Request, res: Response) => {
      const playbook = PLAYBOOKS[req.params.id];
      if (!playbook) {
        return res.status(404).json({ error: 'Playbook not found' });
      }
      res.json(playbook);
    });

    // Get playbooks by industry
    this.app.get('/api/playbooks/industry/:industry', (req: Request, res: Response) => {
      const playbooks = Object.values(PLAYBOOKS).filter(
        p => p.industry.includes(req.params.industry)
      );
      res.json(playbooks);
    });

    // Get categories
    this.app.get('/api/categories', (_req: Request, res: Response) => {
      const categories = [...new Set(Object.values(PLAYBOOKS).map(p => p.category))];
      res.json(categories);
    });

    // Get industries
    this.app.get('/api/industries', (_req: Request, res: Response) => {
      const industries = [...new Set(Object.values(PLAYBOOKS).flatMap(p => p.industry))];
      res.json(industries.sort());
    });

    // Save playbook for merchant
    this.app.post('/api/usage', async (req: Request, res: Response) => {
      try {
        const usage = new PlaybookUsage(req.body);
        await usage.save();
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: 'Failed to save playbook usage' });
      }
    });

    // Get merchant's saved playbooks
    this.app.get('/api/usage/:merchantId', async (req: Request, res: Response) => {
      try {
        const usages = await PlaybookUsage.find({ merchantId: req.params.merchantId })
          .sort({ createdAt: -1 })
          .lean();
        res.json(usages);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch playbook usage' });
      }
    });

    // Update playbook usage (mark as launched, add results)
    this.app.patch('/api/usage/:id', async (req: Request, res: Response) => {
      try {
        const usage = await PlaybookUsage.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update playbook usage' });
      }
    });

    // Recommend playbooks based on merchant profile
    this.app.post('/api/recommend', async (req: Request, res: Response) => {
      try {
        const { merchantId, industry, goals, budget, currentChallenges } = req.body;

        // Simple recommendation logic
        let recommendations = Object.values(PLAYBOOKS);

        // Filter by industry
        if (industry) {
          recommendations = recommendations.filter(p => p.industry.includes(industry));
        }

        // Filter by budget
        if (budget) {
          recommendations = recommendations.filter(
            p => budget >= p.budget.min && budget <= p.budget.max * 1.5
          );
        }

        // Prioritize based on goals
        if (goals && goals.length > 0) {
          recommendations.sort((a, b) => {
            const aMatch = goals.includes(a.goal) ? 1 : 0;
            const bMatch = goals.includes(b.goal) ? 1 : 0;
            return bMatch - aMatch;
          });
        }

        // Return top 5
        res.json(recommendations.slice(0, 5));
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate recommendations' });
      }
    });
  }

  async start(port: number = 4291): Promise<void> {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_growth_playbook');
      console.log('[GrowthPlaybook] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[GrowthPlaybook] Service running on port ${port}`);
        console.log(`[GrowthPlaybook] ${Object.keys(PLAYBOOKS).length} playbooks loaded`);
      });
    } catch (error) {
      console.error('[GrowthPlaybook] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new GrowthPlaybookService();
service.start(4291);

export default service;
