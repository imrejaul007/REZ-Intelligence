// Thresholds for anomaly detection and alerting

export const THRESHOLDS = {
  // Revenue thresholds
  REVENUE: {
    DAILY_CHANGE_MIN: -0.15,      // -15% daily change triggers alert
    DAILY_CHANGE_MAX: 0.50,       // +50% daily change triggers review
    WEEKLY_TREND_MIN: -0.10,       // -10% weekly trend
    WEEKLY_TREND_MAX: 0.30,       // +30% weekly trend
  },

  // Order thresholds
  ORDERS: {
    HOURLY_DROP_MIN: 0.20,        // 20% drop in hourly orders
    HOURLY_SPIKE_MAX: 2.0,        // 2x spike in hourly orders
    DAILY_DROP_MIN: 0.25,         // 25% drop in daily orders
    DAILY_SPIKE_MAX: 1.5,         // 50% spike in daily orders
  },

  // Customer thresholds
  CUSTOMERS: {
    CHURN_RATE_WARNING: 0.10,     // 10% churn rate
    CHURN_RATE_CRITICAL: 0.20,    // 20% churn rate
    ACQUISITION_DROP_MIN: 0.30,  // 30% drop in acquisitions
    ACTIVITY_DROP_MIN: 0.20,     // 20% drop in activity
  },

  // Product thresholds
  PRODUCTS: {
    STOCK_WARNING: 10,            // Units remaining
    RETURN_RATE_WARNING: 0.08,    // 8% return rate
    RETURN_RATE_CRITICAL: 0.15,  // 15% return rate
    SALES_DROP_MIN: 0.30,        // 30% sales drop
    PRICE_CHANGE_THRESHOLD: 0.05, // 5% price change
  },

  // Channel thresholds
  CHANNELS: {
    CONVERSION_MIN: 0.02,         // 2% minimum conversion
    CTR_MIN: 0.01,                // 1% minimum click-through
    BOUNCE_RATE_MAX: 0.60,        // 60% maximum bounce
    UNSUBSCRIBE_MAX: 0.03,       // 3% unsubscribe rate
  },

  // Engagement thresholds
  ENGAGEMENT: {
    EMAIL_OPEN_MIN: 0.15,         // 15% minimum open rate
    EMAIL_CLICK_MIN: 0.02,        // 2% minimum click rate
    PUSH_OPEN_MIN: 0.10,          // 10% minimum push open rate
    RETENTION_30D_MIN: 0.30,      // 30% 30-day retention
    RETENTION_90D_MIN: 0.15,      // 15% 90-day retention
  },

  // Opportunity thresholds
  OPPORTUNITY: {
    MIN_CONFIDENCE: 60,           // Minimum 60% confidence
    HIGH_IMPACT_MIN: 75,          // 75%+ confidence for high impact
    MIN_REACH: 100,               // Minimum 100 reach
    MIN_CONVERSION: 0.05,         // 5% minimum conversion estimate
  },

  // Alert thresholds
  ALERTS: {
    CRITICAL_COOLDOWN: 3600,      // 1 hour between critical alerts
    HIGH_COOLDOWN: 1800,          // 30 min between high alerts
    MEDIUM_COOLDOWN: 900,         // 15 min between medium alerts
    LOW_COOLDOWN: 600,            // 10 min between low alerts
  },

  // Market thresholds
  MARKET: {
    COMPETITOR_PRICE_DIFF_MIN: 0.10,  // 10% price difference
    TREND_SIGNIFICANCE_MIN: 0.15,     // 15% trend significance
    MARKET_SHARE_CHANGE_MIN: 0.05,    // 5% market share change
  },

  // AI Analysis thresholds
  AI: {
    PATTERN_MIN_CONFIDENCE: 70,   // 70% confidence for detected patterns
    ANOMALY_ZSCORE: 2.5,          // 2.5 standard deviations
    TREND_CONSISTENCY_MIN: 0.80, // 80% data points supporting trend
  }
} as const;

// Segment definitions
export const SEGMENT_THRESHOLDS = {
  RFM: {
    RECENCY: {
      HIGH: 30,     // days since last purchase
      MEDIUM: 90,
    },
    FREQUENCY: {
      HIGH: 5,      // number of orders
      MEDIUM: 2,
    },
    MONETARY: {
      HIGH: 500,    // total spend
      MEDIUM: 200,
    }
  },
  CHURN_RISK: {
    LOW: 0.10,      // <10% churn probability
    MEDIUM: 0.30,   // 10-30% churn probability
    HIGH: 0.50,     // >30% churn probability
  },
  LTV: {
    HIGH: 10000,    // High lifetime value
    MEDIUM: 2500,
  }
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  METRICS: 300,           // 5 minutes
  CUSTOMER_SEGMENTS: 600, // 10 minutes
  COMPETITOR_DATA: 3600,  // 1 hour
  MARKET_TRENDS: 7200,    // 2 hours
  OPPORTUNITIES: 1800,    // 30 minutes
  INSIGHTS: 3600,         // 1 hour
  REPORTS: 86400,         // 24 hours
  ALERTS: 60,             // 1 minute
} as const;

// Schedule patterns (cron)
export const SCHEDULES = {
  DAILY_BRIEFING: '0 6 * * *',        // 6 AM daily
  WEEKLY_REPORT: '0 7 * * 1',         // 7 AM Monday
  METRICS_UPDATE: '0 * * * *',        // Every hour
  REALTIME_CHECK: '*/5 * * * *',      // Every 5 minutes
  CLEANUP: '0 3 * * *',               // 3 AM daily cleanup
} as const;

// API Limits
export const API_LIMITS = {
  MAX_QUERY_LENGTH: 2000,
  MAX_BATCH_SIZE: 100,
  MAX_RECOMMENDATIONS: 10,
  MAX_OPPORTUNITIES_PER_REPORT: 20,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Model configurations
export const MODEL_CONFIG = {
  GPT4O: {
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  GPT4O_MINI: {
    model: 'gpt-4o-mini',
    maxTokens: 2048,
    temperature: 0.5,
  }
} as const;

// Export types for convenience
export type ThresholdCategory = keyof typeof THRESHOLDS;
export type CacheTTLCategory = keyof typeof CACHE_TTL;
export type ScheduleType = keyof typeof SCHEDULES;
