export const PREDEFINED_SEGMENTS = {
  high_value: {
    name: 'High Value Customers',
    description: 'Top 20% by Lifetime Value',
    criteria: {
      type: 'ltv',
      conditions: [
        { field: 'ltv', operator: 'gte', value: 80 }
      ],
      combinator: 'AND' as const
    },
    priority: 1
  },
  churned: {
    name: 'Churned Customers',
    description: 'No order in 30+ days',
    criteria: {
      type: 'recency',
      conditions: [
        { field: 'days_since_last_order', operator: 'gte', value: 30 }
      ],
      combinator: 'AND' as const
    },
    priority: 2
  },
  window_shoppers: {
    name: 'Window Shoppers',
    description: 'Browse frequently but rarely purchase',
    criteria: {
      type: 'behavior',
      conditions: [
        { field: 'browsing_frequency', operator: 'gte', value: 5 },
        { field: 'purchase_frequency', operator: 'lte', value: 1 }
      ],
      combinator: 'AND' as const
    },
    priority: 3
  },
  deal_seekers: {
    name: 'Deal Seekers',
    description: 'Always responsive to discounts and promotions',
    criteria: {
      type: 'behavior',
      conditions: [
        { field: 'is_discount_responsive', operator: 'eq', value: true }
      ],
      combinator: 'AND' as const
    },
    priority: 4
  },
  foodies: {
    name: 'Foodies',
    description: 'High frequency, variety seekers',
    criteria: {
      type: 'frequency',
      conditions: [
        { field: 'total_orders', operator: 'gte', value: 10 },
        { field: 'purchase_frequency', operator: 'gte', value: 4 }
      ],
      combinator: 'AND' as const
    },
    priority: 5
  },
  budget_minders: {
    name: 'Budget Minders',
    description: 'Low AOV, price sensitive customers',
    criteria: {
      type: 'behavior',
      conditions: [
        { field: 'avg_order_value', operator: 'lte', value: 25 }
      ],
      combinator: 'AND' as const
    },
    priority: 6
  },
  new_users: {
    name: 'New Users',
    description: 'First order within 7 days',
    criteria: {
      type: 'recency',
      conditions: [
        { field: 'days_since_first_order', operator: 'lte', value: 7 }
      ],
      combinator: 'AND' as const
    },
    priority: 7
  },
  reorder_probability_high: {
    name: 'High Reorder Probability',
    description: 'Users likely to reorder soon based on purchase patterns',
    criteria: {
      type: 'behavior',
      conditions: [
        { field: 'days_since_last_order', operator: 'between', value: [5, 14] },
        { field: 'total_orders', operator: 'gte', value: 3 }
      ],
      combinator: 'AND' as const
    },
    priority: 8
  },
  recently_purchased: {
    name: 'Recently Purchased',
    description: 'Made a purchase in the last 7 days',
    criteria: {
      type: 'recency',
      conditions: [
        { field: 'days_since_last_order', operator: 'lte', value: 7 }
      ],
      combinator: 'AND' as const
    },
    priority: 9
  }
} as const;

export const CHANNEL_CONFIG = {
  banner: {
    name: 'Banner Ads',
    cost_multiplier: 1.0,
    min_template_fields: ['body', 'image_url'],
    delivery_rate: 0.98,
    engagement_rate_baseline: 0.02
  },
  push: {
    name: 'Push Notifications',
    cost_multiplier: 0.5,
    min_template_fields: ['body'],
    delivery_rate: 0.95,
    engagement_rate_baseline: 0.15
  },
  in_app: {
    name: 'In-App Messages',
    cost_multiplier: 0.3,
    min_template_fields: ['body', 'headline'],
    delivery_rate: 1.0,
    engagement_rate_baseline: 0.25
  },
  sms: {
    name: 'SMS',
    cost_multiplier: 2.0,
    min_template_fields: ['body'],
    delivery_rate: 0.90,
    engagement_rate_baseline: 0.08
  },
  email: {
    name: 'Email',
    cost_multiplier: 0.1,
    min_template_fields: ['body', 'headline'],
    delivery_rate: 0.85,
    engagement_rate_baseline: 0.05
  }
} as const;

export const OPTIMAL_SEND_TIMES = {
  morning: { start: 8, end: 11 },
  afternoon: { start: 12, end: 16 },
  evening: { start: 17, end: 20 },
  night: { start: 21, end: 23 }
} as const;

export const CAMPAIGN_STATUS_TRANSITIONS = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: []
} as const;

export const FREQUENCY_CAPPING_DEFAULTS = {
  daily: 5,
  weekly: 15,
  lifetime: 50
} as const;

export const BUDGET_PACING_MODES = {
  even: { description: 'Distribute impressions evenly throughout the day' },
  accelerated: { description: 'Front-load impressions early in the day' },
  front_loaded: { description: 'Spend budget in first half of day' }
} as const;
