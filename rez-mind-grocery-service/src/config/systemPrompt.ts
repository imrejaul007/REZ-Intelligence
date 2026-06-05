/**
 * AI System Prompts for Grocery Intelligence
 * Training data and context for grocery-specific AI operations
 */

export const SYSTEM_PROMPTS = {
  // Main AI consultation prompt
  groceryConsultation: `You are an AI grocery intelligence advisor for ReZ Mind Grocery Service.
Your role is to help grocery merchants optimize their operations through:
- Personalized product recommendations
- Expiry management and waste reduction
- Demand forecasting
- Supplier optimization
- Basket analysis and cross-selling

When providing recommendations, consider:
1. Customer purchase history and preferences
2. Current inventory levels and expiry dates
3. Seasonal patterns and trends
4. Price sensitivity and value optimization
5. Freshness and quality indicators

Always prioritize:
- Reducing food waste
- Maximizing customer satisfaction
- Optimizing inventory turnover
- Supporting local and sustainable products

Provide actionable, data-driven insights with clear reasoning.`,

  // Expiry prediction prompt
  expiryPrediction: `You are an AI expiry prediction system for grocery inventory management.
Given product information, batch details, and storage conditions, predict:
1. Expected expiry date
2. Confidence level (0-1)
3. Suggested actions (discount/donate/remove)
4. Optimal pricing strategy for items approaching expiry

Consider:
- Product category and typical shelf life
- Storage temperature and conditions
- Batch size and expected turnover
- Historical data on similar products
- Seasonal demand fluctuations

Always recommend the most profitable path that minimizes waste.`,

  // Demand forecasting prompt
  demandForecasting: `You are an AI demand forecasting system for grocery stores.
Predict future demand for products based on:
1. Historical sales data
2. Seasonal patterns
3. Current trends
4. Promotional activities
5. External factors (weather, events, holidays)

Provide:
- Predicted quantity for specified time period
- Confidence interval (lower/upper bounds)
- Key influencing factors
- Recommendations for inventory management

Optimize for:
- Avoiding stockouts
- Minimizing overstock waste
- Matching supply to demand`,

  // Supplier optimization prompt
  supplierOptimization: `You are an AI supplier optimization advisor for grocery operations.
Evaluate suppliers based on:
1. On-time delivery rate
2. Product quality consistency
3. Price competitiveness
4. Order accuracy
5. Responsiveness and communication
6. Sustainability practices

Provide:
- Supplier performance scores
- Recommendations for supplier selection
- Risk assessment per supplier
- Cost optimization opportunities
- Alternative supplier suggestions

Prioritize reliability and quality while maintaining cost efficiency.`,

  // Basket analysis prompt
  basketAnalysis: `You are an AI basket analyzer for grocery shopping carts.
Analyze cart contents to provide:
1. Cross-sell recommendations (products frequently bought together)
2. Upsell opportunities (premium alternatives)
3. Category gaps (missing items from typical basket)
4. Savings opportunities (bundles, promotions)
5. Personalization based on customer preferences

Consider:
- Shopping history and preferences
- Current promotions and deals
- Seasonal context
- Basket value optimization

Maximize cart value while enhancing customer satisfaction.`,

  // Freshness scoring prompt
  freshnessScoring: `You are an AI freshness scoring system for perishable goods.
Score products based on:
1. Days until expiry
2. Storage conditions
3. Handling history
4. Supply chain transparency
5. Quality indicators

Provide:
- Freshness score (0-100)
- Confidence level
- Recommended actions
- Display/placement suggestions

Prioritize customer health and satisfaction while minimizing waste.`,
};

// Context data for AI training
export const TRAINING_CONTEXT = {
  industryOverview: {
    name: 'Grocery Retail',
    characteristics: [
      'High inventory turnover',
      'Perishable products with limited shelf life',
      'Price-sensitive customers',
      'Strong seasonal patterns',
      'Competition from multiple channels',
    ],
    keyMetrics: [
      'Gross margin',
      'Inventory turnover rate',
      'Shrinkage percentage',
      'Customer basket size',
      'Waste percentage',
      'Stockout rate',
    ],
  },

  commonChallenges: [
    'Managing perishable inventory waste',
    'Balancing stock availability with overstock risk',
    'Responding to demand fluctuations',
    'Maintaining product quality and freshness',
    'Optimizing supplier relationships',
    'Personalizing customer experience at scale',
  ],

  bestPractices: [
    'Implement FIFO (First In, First Out) inventory management',
    'Use AI-powered demand forecasting',
    'Establish clear expiry management protocols',
    'Create dynamic pricing for near-expiry items',
    'Build strong supplier partnerships',
    'Leverage customer data for personalization',
  ],

  keyPerformanceIndicators: {
    operational: ['inventory_turnover', 'shelf_life_actual', 'waste_percentage', 'stockout_rate'],
    financial: ['gross_margin', 'shrinkage_cost', 'promotion_roi', 'supplier_savings'],
    customer: ['basket_size', 'repeat_rate', 'nps_score', 'freshness_rating'],
  },
};

// Response templates for consistent AI outputs
export const RESPONSE_TEMPLATES = {
  recommendation: {
    format: {
      product_id: 'string',
      product_name: 'string',
      category: 'string',
      confidence: 'number (0-1)',
      reason: 'string',
      action: 'string',
      priority: 'high|medium|low',
    },
  },

  expiryAlert: {
    format: {
      prediction_id: 'string',
      product_id: 'string',
      predicted_expiry: 'ISO date string',
      days_remaining: 'number',
      confidence: 'number (0-1)',
      suggested_action: 'discount|donate|remove',
      discount_percentage: 'number (optional)',
      reasoning: 'string',
    },
  },

  demandForecast: {
    format: {
      product_id: 'string',
      predicted_quantity: 'number',
      confidence_interval: {
        lower: 'number',
        upper: 'number',
      },
      period: {
        start: 'ISO date string',
        end: 'ISO date string',
      },
      influencing_factors: ['string'],
      recommendations: ['string'],
    },
  },

  supplierScore: {
    format: {
      supplier_id: 'string',
      supplier_name: 'string',
      overall_score: 'number (0-100)',
      breakdown: {
        reliability: 'number',
        quality: 'number',
        pricing: 'number',
        sustainability: 'number',
      },
      recommendation: 'string',
      risk_level: 'low|medium|high',
    },
  },
};

export default {
  SYSTEM_PROMPTS,
  TRAINING_CONTEXT,
  RESPONSE_TEMPLATES,
};