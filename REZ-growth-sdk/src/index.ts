/**
 * REZ Merchant Growth OS - Client SDK
 *
 * Usage:
 * ```typescript
 * import { MerchantGrowthSDK } from '@rez/merchant-growth-sdk';
 *
 * const sdk = new MerchantGrowthSDK({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'http://localhost:4290'
 * });
 *
 * const budget = await sdk.budget.optimize({
 *   merchantId: 'm123',
 *   totalBudget: 100000,
 *   strategy: 'roas_based'
 * });
 * ```
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============== TYPES ==============

export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface BudgetOptimizationRequest {
  merchantId: string;
  totalBudget: number;
  strategy?: 'roas_based' | 'balanced' | 'aggressive';
  minChannelBudget?: number;
  excludeChannels?: string[];
}

export interface BudgetAllocation {
  channel: string;
  amount: number;
  percentage: number;
  expectedRoas: number;
  reason: string;
}

export interface HealthScoreRequest {
  merchantId: string;
  industry: string;
  revenue: {
    current: number;
    previous: number;
    target: number;
  };
  customers: {
    total: number;
    new: number;
    active: number;
    churned: number;
    returning: number;
  };
  engagement: {
    loyaltyMembers: number;
    referrals: number;
    reviews: number;
    avgRating: number;
    positiveReviews?: number;
  };
  operational?: {
    avgOrderValue: number;
    ordersPerDay: number;
    fulfillmentRate: number;
    avgDeliveryTime?: number;
    complaints?: number;
  };
}

export interface HealthScore {
  merchantId: string;
  score: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'at_risk';
  components: {
    revenue: { score: number; trend: number };
    customer: { score: number };
    engagement: { score: number };
    operational?: { score: number };
  };
  risks: Array<{
    type: string;
    severity: string;
    message: string;
    recommendation: string;
  }>;
}

export interface OfferRequest {
  merchantId: string;
  name: string;
  type: 'cashback' | 'discount' | 'loyalty' | 'combo';
  value: number;
  minOrderValue?: number;
  channels?: string[];
  startDate?: string;
  endDate?: string;
}

export interface RevenueForecast {
  merchantId: string;
  date: string;
  predicted: number;
  confidence: number;
  lower: number;
  upper: number;
}

export interface ReviewResponse {
  reviewId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  response: string;
  confidence: number;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  industry: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: any[];
  estimatedTime: string;
  expectedROI?: string;
}

// ============== ERROR CLASS ==============

export class MerchantGrowthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'MerchantGrowthError';
  }
}

// ============== BASE CLIENT ==============

class BaseClient {
  protected client: AxiosInstance;

  constructor(config: ClientConfig, basePath: string = '') {
    this.client = axios.create({
      baseURL: `${config.baseUrl || 'http://localhost:4290'}${basePath}`,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          throw new MerchantGrowthError(
            (error.response.data as any)?.error || 'Unknown error',
            'API_ERROR',
            error.response.status
          );
        }
        throw new MerchantGrowthError(
          error.message,
          'NETWORK_ERROR'
        );
      }
    );
  }

  protected async get<T>(path: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(path, { params });
    return response.data;
  }

  protected async post<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(path, data);
    return response.data;
  }

  protected async patch<T>(path: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(path, data);
    return response.data;
  }

  protected async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete<T>(path);
    return response.data;
  }
}

// ============== BUDGET CLIENT ==============

export class BudgetClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Optimize budget allocation across channels
   */
  async optimize(request: BudgetOptimizationRequest): Promise<{
    allocations: BudgetAllocation[];
    totalBudget: number;
    expectedTotalRoas: number;
    confidence: number;
  }> {
    return this.post('/optimize', request);
  }

  /**
   * Get all campaigns for merchant
   */
  async getCampaigns(merchantId: string): Promise<any[]> {
    return this.get(`/campaigns/${merchantId}`);
  }

  /**
   * Create new campaign
   */
  async createCampaign(campaign: any): Promise<any> {
    return this.post('/campaigns', campaign);
  }

  /**
   * Get channel performance
   */
  async getChannelPerformance(): Promise<any[]> {
    return this.get('/channels/performance');
  }

  /**
   * Create A/B experiment
   */
  async createExperiment(experiment: any): Promise<any> {
    return this.post('/experiments', experiment);
  }
}

// ============== HEALTH CLIENT ==============

export class HealthClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Calculate merchant health score
   */
  async calculateScore(request: HealthScoreRequest): Promise<HealthScore> {
    return this.post('/score', request);
  }

  /**
   * Get existing score
   */
  async getScore(merchantId: string): Promise<HealthScore> {
    return this.get(`/score/${merchantId}`);
  }

  /**
   * Get risk alerts
   */
  async getAlerts(merchantId: string): Promise<any[]> {
    return this.get(`/alerts/${merchantId}`);
  }

  /**
   * Get industry benchmarks
   */
  async getBenchmarks(industry: string): Promise<any> {
    return this.get(`/benchmarks/${industry}`);
  }
}

// ============== OFFERS CLIENT ==============

export class OffersClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Create new offer
   */
  async create(request: OfferRequest): Promise<any> {
    return this.post('/offers', request);
  }

  /**
   * Get all offers for merchant
   */
  async getAll(merchantId: string): Promise<any[]> {
    return this.get(`/offers/${merchantId}`);
  }

  /**
   * Get personalized recommendation
   */
  async recommend(customerId: string, context?: any): Promise<any> {
    return this.post(`/offers/recommend/${customerId}`, context);
  }

  /**
   * Optimize offer parameters
   */
  async optimize(offerId: string): Promise<any> {
    return this.post(`/offers/${offerId}/optimize`);
  }

  /**
   * Get offer performance
   */
  async getPerformance(merchantId: string): Promise<any> {
    return this.get(`/offers/${merchantId}/performance`);
  }
}

// ============== REVIEWS CLIENT ==============

export class ReviewsClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Ingest review
   */
  async ingest(review: any): Promise<any> {
    return this.post('/reviews/ingest', review);
  }

  /**
   * Get reviews for merchant
   */
  async getAll(merchantId: string, filters?: any): Promise<any[]> {
    return this.get(`/reviews/${merchantId}`, filters);
  }

  /**
   * Generate AI response
   */
  async generateResponse(reviewId: string): Promise<ReviewResponse> {
    return this.post(`/reviews/${reviewId}/respond`);
  }

  /**
   * Approve and post response
   */
  async approve(reviewId: string, responseText: string, approvedBy: string): Promise<any> {
    return this.post(`/reviews/${reviewId}/approve`, { responseText, approvedBy });
  }

  /**
   * Get sentiment stats
   */
  async getSentimentStats(merchantId: string): Promise<any> {
    return this.get(`/reviews/${merchantId}/sentiment-stats`);
  }

  /**
   * Get escalated reviews
   */
  async getEscalations(merchantId: string): Promise<any[]> {
    return this.get(`/reviews/${merchantId}/escalations`);
  }
}

// ============== FORECAST CLIENT ==============

export class ForecastClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Get today's prediction
   */
  async getTodayPrediction(merchantId: string): Promise<RevenueForecast> {
    return this.get(`/forecast/${merchantId}/today`);
  }

  /**
   * Get weekly forecast
   */
  async getWeeklyForecast(merchantId: string): Promise<any> {
    return this.get(`/forecast/${merchantId}/week`);
  }

  /**
   * Get monthly forecast
   */
  async getMonthlyForecast(merchantId: string): Promise<any> {
    return this.get(`/forecast/${merchantId}/month`);
  }

  /**
   * Predict campaign impact
   */
  async predictCampaignImpact(request: {
    merchantId: string;
    campaignType: string;
    budget: number;
    duration: number;
  }): Promise<any> {
    return this.post('/forecast/campaign-impact', request);
  }

  /**
   * Record revenue
   */
  async recordRevenue(data: any): Promise<any> {
    return this.post('/revenue', data);
  }

  /**
   * Get revenue history
   */
  async getHistory(merchantId: string, startDate?: string, endDate?: string): Promise<any[]> {
    return this.get(`/revenue/${merchantId}`, { startDate, endDate });
  }

  /**
   * Get revenue stats
   */
  async getStats(merchantId: string, days: number = 30): Promise<any> {
    return this.get(`/revenue/${merchantId}/stats`, { days });
  }
}

// ============== PLAYBOOK CLIENT ==============

export class PlaybookClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Get all playbooks
   */
  async getAll(filters?: {
    industry?: string;
    category?: string;
    difficulty?: string;
  }): Promise<Playbook[]> {
    return this.get('/playbooks', filters);
  }

  /**
   * Get playbook by ID
   */
  async getById(id: string): Promise<Playbook> {
    return this.get(`/playbooks/${id}`);
  }

  /**
   * Get playbooks by industry
   */
  async getByIndustry(industry: string): Promise<Playbook[]> {
    return this.get(`/playbooks/industry/${industry}`);
  }

  /**
   * Get recommendations
   */
  async recommend(request: {
    industry: string;
    goals: string[];
    budget?: number;
  }): Promise<Playbook[]> {
    return this.post('/recommend', request);
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<string[]> {
    return this.get('/categories');
  }

  /**
   * Get industries
   */
  async getIndustries(): Promise<string[]> {
    return this.get('/industries');
  }
}

// ============== COMPETITOR CLIENT ==============

export class CompetitorClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Add competitor
   */
  async add(competitor: any): Promise<any> {
    return this.post('/competitors', competitor);
  }

  /**
   * Get competitors
   */
  async getAll(merchantId: string): Promise<any[]> {
    return this.get(`/competitors/${merchantId}`);
  }

  /**
   * Record price snapshot
   */
  async recordPrices(data: any): Promise<any> {
    return this.post('/prices', data);
  }

  /**
   * Get price comparison
   */
  async getPriceComparison(merchantId: string): Promise<any> {
    return this.get(`/prices/compare/${merchantId}`);
  }

  /**
   * Get alerts
   */
  async getAlerts(merchantId: string, status?: string): Promise<any[]> {
    return this.get(`/alerts/${merchantId}`, { status });
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(alertId: string): Promise<any> {
    return this.post(`/alerts/${alertId}/dismiss`);
  }

  /**
   * Get insights
   */
  async getInsights(merchantId: string): Promise<any> {
    return this.get(`/insights/${merchantId}`);
  }
}

// ============== GROWTH AGENT CLIENT ==============

export class GrowthAgentClient extends BaseClient {
  constructor(config: ClientConfig) {
    super(config, '/api');
  }

  /**
   * Create experiment
   */
  async createExperiment(experiment: any): Promise<any> {
    return this.post('/experiments', experiment);
  }

  /**
   * Get experiments
   */
  async getExperiments(merchantId: string): Promise<any[]> {
    return this.get(`/experiments/${merchantId}`);
  }

  /**
   * Start experiment
   */
  async start(experimentId: string): Promise<any> {
    return this.post(`/experiments/${experimentId}/start`);
  }

  /**
   * Get results
   */
  async getResults(experimentId: string): Promise<any> {
    return this.get(`/experiments/${experimentId}/results`);
  }

  /**
   * Scale winning experiment
   */
  async scale(experimentId: string, scaleFactor: number): Promise<any> {
    return this.post(`/experiments/${experimentId}/scale`, { scaleFactor });
  }
}

// ============== MAIN SDK CLASS ==============

export class MerchantGrowthSDK {
  public budget: BudgetClient;
  public health: HealthClient;
  public offers: OffersClient;
  public reviews: ReviewsClient;
  public forecast: ForecastClient;
  public playbooks: PlaybookClient;
  public competitors: CompetitorClient;
  public growthAgent: GrowthAgentClient;

  constructor(config: ClientConfig) {
    this.budget = new BudgetClient(config);
    this.health = new HealthClient(config);
    this.offers = new OffersClient(config);
    this.reviews = new ReviewsClient(config);
    this.forecast = new ForecastClient(config);
    this.playbooks = new PlaybookClient(config);
    this.competitors = new CompetitorClient(config);
    this.growthAgent = new GrowthAgentClient(config);
  }

  /**
   * Health check all services
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const services = [
      { name: 'budget', client: this.budget },
      { name: 'health', client: this.health },
      { name: 'offers', client: this.offers },
      { name: 'reviews', client: this.reviews },
      { name: 'forecast', client: this.forecast },
      { name: 'playbooks', client: this.playbooks },
      { name: 'competitors', client: this.competitors },
      { name: 'growthAgent', client: this.growthAgent }
    ];

    const results: Record<string, boolean> = {};

    for (const service of services) {
      try {
        await (service.client as any).get('/health');
        results[service.name] = true;
      } catch {
        results[service.name] = false;
      }
    }

    return results;
  }
}

export default MerchantGrowthSDK;
