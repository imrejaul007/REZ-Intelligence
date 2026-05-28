import { v4 as uuidv4 } from 'uuid';
import { Campaign, ICampaign, CampaignTrigger, BudgetPacing } from '../models';
import { targetingEngine } from './TargetingEngine';
import {
  Campaign as CampaignType,
  CampaignRules,
  AudiencePreview,
  TriggerResponse,
  CampaignStats,
  UserContext,
  UserAttributes
} from '../types';
import { PREDEFINED_SEGMENTS, CAMPAIGN_STATUS_TRANSITIONS } from '../config/constants';

export interface CreateCampaignInput {
  name: string;
  description?: string;
  rules: CampaignRules;
  ab_test_config?: CampaignType['ab_test_config'];
  start_date?: string;
  end_date?: string;
  created_by: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  rules?: CampaignRules;
  status?: CampaignType['status'];
  start_date?: string;
  end_date?: string;
}

class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(input: CreateCampaignInput): Promise<ICampaign> {
    const campaignId = this.generateCampaignId(input.name);

    const campaign = new Campaign({
      campaign_id: campaignId,
      name: input.name,
      description: input.description,
      rules: input.rules,
      ab_test_config: input.ab_test_config,
      start_date: input.start_date ? new Date(input.start_date) : undefined,
      end_date: input.end_date ? new Date(input.end_date) : undefined,
      created_by: input.created_by,
      status: 'draft'
    });

    await campaign.save();

    // Initialize budget pacing
    await BudgetPacing.findOneAndUpdate(
      { campaign_id: campaignId },
      {
        campaign_id: campaignId,
        daily_spent: 0,
        daily_limit: input.rules.budget.daily_limit,
        lifetime_spent: 0,
        lifetime_limit: input.rules.budget.lifetime_limit,
        pacing_percentage: 0,
        daily_reset_at: this.getNextMidnight()
      },
      { upsert: true, new: true }
    );

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<ICampaign | null> {
    return Campaign.findOne({ campaign_id: campaignId });
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, input: UpdateCampaignInput): Promise<ICampaign | null> {
    const updateData: Record<string, unknown> = {};

    if (input.name) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.rules) updateData.rules = input.rules;
    if (input.status) {
      updateData.status = input.status;
    }
    if (input.start_date) updateData.start_date = new Date(input.start_date);
    if (input.end_date) updateData.end_date = new Date(input.end_date);

    return Campaign.findOneAndUpdate(
      { campaign_id: campaignId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete campaign (soft delete - change status to cancelled)
   */
  async deleteCampaign(campaignId: string): Promise<boolean> {
    const result = await Campaign.updateOne(
      { campaign_id: campaignId },
      { $set: { status: 'cancelled' } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * List campaigns with filtering
   */
  async listCampaigns(options: {
    status?: CampaignType['status'];
    created_by?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ campaigns: ICampaign[]; total: number }> {
    const filter: Record<string, unknown> = {};

    if (options.status) filter.status = options.status;
    if (options.created_by) filter.created_by = options.created_by;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ created_at: -1 })
        .skip(options.offset || 0)
        .limit(options.limit || 20),
      Campaign.countDocuments(filter)
    ]);

    return { campaigns, total };
  }

  /**
   * Preview audience for a campaign
   */
  async previewAudience(campaignId: string, sampleSize: number = 100): Promise<AudiencePreview> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const { targeting } = campaign.rules;
    const preview: AudiencePreview = {
      campaign_id: campaignId,
      total_matching: 0,
      by_segment: [],
      excluded_count: 0,
      breakdown: {
        meets_recency: 0,
        meets_min_orders: 0,
        meets_custom_conditions: 0
      },
      sampled_users: []
    };

    // Calculate segment breakdown
    for (const segmentId of targeting.user_segments) {
      const segmentDef = PREDEFINED_SEGMENTS[segmentId as keyof typeof PREDEFINED_SEGMENTS];
      const estimatedSize = this.estimateSegmentSize(segmentId);

      preview.by_segment.push({
        segment_id: segmentId,
        segment_name: segmentDef?.name || segmentId,
        count: estimatedSize,
        percentage: 0 // Will calculate after getting total
      });
    }

    // Calculate total estimated matching
    const totalEstimated = this.estimateAudienceSize(campaign.rules as unknown as CampaignRules);

    // Calculate percentages
    preview.total_matching = totalEstimated;
    preview.by_segment = preview.by_segment.map(seg => ({
      ...seg,
      percentage: totalEstimated > 0 ? Math.round((seg.count / totalEstimated) * 100) : 0
    }));

    // Estimate exclusions
    for (const exclusionId of targeting.exclusions) {
      const excludedSize = this.estimateSegmentSize(exclusionId);
      preview.excluded_count += excludedSize;
    }

    // Breakdown estimates
    preview.breakdown = {
      meets_recency: this.estimateRecencyMatch(totalEstimated, targeting.recency_days),
      meets_min_orders: this.estimateMinOrdersMatch(totalEstimated, targeting.min_orders),
      meets_custom_conditions: targeting.custom_conditions ? totalEstimated * 0.8 : totalEstimated
    };

    // Generate sample user IDs (mock data for preview)
    preview.sampled_users = Array.from({ length: Math.min(sampleSize, 10) }, (_, i) => ({
      user_id: `sample_user_${i + 1}`,
      match_reasons: ['Matches segment criteria']
    }));

    return preview;
  }

  /**
   * Trigger campaign execution
   */
  async triggerCampaign(
    campaignId: string,
    userContexts: UserContext[]
  ): Promise<TriggerResponse> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'active') {
      throw new Error(`Campaign must be active to trigger. Current status: ${campaign.status}`);
    }

    const triggerId = `trigger_${uuidv4()}`;
    const { rules } = campaign;

    // Check budget
    const budgetCheck = await targetingEngine.checkBudget(
      campaignId,
      rules.budget.cost_per_impression,
      rules.budget.daily_limit,
      rules.budget.lifetime_limit
    );

    if (!budgetCheck.allowed) {
      throw new Error(`Budget exhausted: ${budgetCheck.reason}`);
    }

    // Process users in batches
    const batchSize = 100;
    const eligibleUsers: Array<{
      userContext: UserContext;
      variantId?: string;
      templateId: string;
      cost: number;
    }> = [];

    let totalCost = 0;

    for (const userContext of userContexts) {
      // Evaluate targeting
      const targetingResult = await targetingEngine.evaluateTargeting(userContext, rules.targeting);

      if (!targetingResult.eligible) {
        continue;
      }

      // Check frequency cap
      const frequencyCheck = await targetingEngine.checkFrequencyCap(
        userContext.user_id,
        'push' // Default channel, would be dynamic based on campaign config
      );

      if (!frequencyCheck.allowed) {
        continue;
      }

      // Check budget
      if (totalCost + rules.budget.cost_per_impression > rules.budget.daily_limit) {
        break; // Budget exhausted for this batch
      }

      // Determine template and variant
      let templateId = rules.content.ad_template_id;
      let variantId: string | undefined;

      if (campaign.ab_test_config?.enabled && campaign.ab_test_config.variants.length > 0) {
        const assignment = targetingEngine.assignABTestVariant(
          userContext.user_id,
          campaign.ab_test_config.variants
        );
        if (assignment) {
          variantId = assignment.variant_id;
          templateId = assignment.ad_template_id;
        }
      }

      const costEstimate = targetingEngine.calculateCost('push', targetingResult.segments_matched);

      eligibleUsers.push({
        userContext,
        variantId,
        templateId,
        cost: costEstimate.total_cost
      });

      totalCost += costEstimate.total_cost;

      // Record impression for frequency cap
      await targetingEngine.recordImpression(userContext.user_id, 'push', campaignId);
    }

    // Record spend
    await targetingEngine.recordSpend(
      campaignId,
      totalCost,
      rules.budget.daily_limit,
      rules.budget.lifetime_limit
    );

    // Create triggers for all eligible users
    const triggerPromises = eligibleUsers.map(user =>
      new CampaignTrigger({
        trigger_id: `trigger_${uuidv4()}`,
        campaign_id: campaignId,
        user_id: user.userContext.user_id,
        variant_id: user.variantId,
        channel: 'push',
        status: 'queued',
        cost: user.cost
      }).save()
    );

    await Promise.all(triggerPromises);

    // Calculate batches
    const totalBatches = Math.ceil(eligibleUsers.length / batchSize);

    return {
      trigger_id: triggerId,
      campaign_id: campaignId,
      status: 'processed',
      total_recipients: eligibleUsers.length,
      estimated_cost: totalCost as number,
      estimated_delivery_time: new Date(Date.now() + totalBatches * 60000).toISOString(),
      batch_info: {
        total_batches: totalBatches,
        current_batch: 1,
        batch_size: batchSize
      }
    };
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Aggregate trigger data
    const triggers = await CampaignTrigger.aggregate([
      { $match: { campaign_id: campaignId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_cost: { $sum: '$cost' },
          total_revenue: { $sum: { $ifNull: ['$revenue', 0] } }
        }
      }
    ]);

    // Aggregate by variant
    const byVariant = await CampaignTrigger.aggregate([
      { $match: { campaign_id: campaignId } },
      {
        $group: {
          _id: '$variant_id',
          impressions: { $sum: 1 },
          clicks: {
            $sum: { $cond: [{ $in: ['$status', ['clicked', 'converted']] }, 1, 0] }
          },
          conversions: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
          },
          cost: { $sum: '$cost' },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } }
        }
      }
    ]);

    // Calculate metrics
    const statusCounts = triggers.reduce((acc, t) => {
      acc[t._id] = t.count;
      return acc;
    }, {} as Record<string, number>);

    const totalImpressions = Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0);
    const totalClicks = statusCounts['clicked'] || 0;
    const totalConversions = statusCounts['converted'] || 0;
    const totalCost = triggers.reduce((sum, t) => sum + (t.total_cost as number), 0);
    const totalRevenue = triggers.reduce((sum, t) => sum + (t.total_revenue as number), 0);

    const stats: CampaignStats = {
      campaign_id: campaignId,
      period: {
        start: campaign.created_at,
        end: new Date()
      },
      impressions: totalImpressions as number,
      deliveries: statusCounts["delivered"] as number || 0,
      views: statusCounts["viewed"] as number || 0,
      clicks: totalClicks as number,
      conversions: totalConversions as number,
      revenue: totalRevenue as number,
      cost: totalCost as number,
      ctr: (totalImpressions as number) > 0 ? ((totalClicks as number) / (totalImpressions as number)) * 100 : 0,
      conversion_rate: (totalClicks as number) > 0 ? ((totalConversions as number) / (totalClicks as number)) * 100 : 0,
      cpc: (totalClicks as number) > 0 ? (totalCost as number) / (totalClicks as number) : 0,
      cpm: (totalImpressions as number) > 0 ? ((totalCost as number) / (totalImpressions as number)) * 1000 : 0,
      roas: (totalCost as number) > 0 ? (totalRevenue as number) / (totalCost as number) : 0,
      by_segment: {},
      by_channel: {
        push: {
          sent: statusCounts['sent'] || 0,
          delivered: statusCounts["delivered"] as number || 0,
          viewed: statusCounts["viewed"] as number || 0,
          clicked: statusCounts['clicked'] || 0,
          conversion_rate: (statusCounts['clicked'] || 0) > 0
            ? (totalConversions as number / statusCounts['clicked']) * 100
            : 0
        }
      }
    };

    return stats;
  }

  /**
   * Get all campaigns with stats summary
   */
  async getAllCampaignsStats(): Promise<{
    campaigns: Array<{ campaign: ICampaign; stats: Partial<CampaignStats> }>;
    summary: {
      total_campaigns: number;
      active_campaigns: number;
      total_spend: number;
      total_impressions: number;
      avg_ctr: number;
    };
  }> {
    const { campaigns } = await this.listCampaigns({ limit: 100 });

    const campaignsWithStats = await Promise.all(
      campaigns.map(async campaign => {
        const stats = await this.getCampaignStats(campaign.campaign_id);
        return { campaign, stats };
      })
    );

    const summary = {
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter(c => c.status === 'active').length,
      total_spend: campaignsWithStats.reduce((sum, c) => sum + c.stats.cost, 0),
      total_impressions: campaignsWithStats.reduce((sum, c) => sum + c.stats.impressions, 0),
      avg_ctr: campaignsWithStats.length > 0
        ? campaignsWithStats.reduce((sum, c) => sum + c.stats.ctr, 0) / campaignsWithStats.length
        : 0
    };

    return { campaigns: campaignsWithStats, summary };
  }

  /**
   * Generate unique campaign ID
   */
  private generateCampaignId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 30);
    const timestamp = Date.now().toString(36);
    return `${slug}_${timestamp}`;
  }

  /**
   * Get next midnight for budget reset
   */
  private getNextMidnight(): Date {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return midnight;
  }

  /**
   * Estimate audience size based on targeting rules
   */
  private estimateAudienceSize(rules: CampaignRules): number {
    // Mock estimates based on typical ReZ user base
    const baseAudience = 50000;

    // Adjust based on segments
    const segmentMultipliers: Record<string, number> = {
      high_value: 0.2,
      churned: 0.15,
      window_shoppers: 0.25,
      deal_seekers: 0.3,
      foodies: 0.2,
      budget_minders: 0.25,
      new_users: 0.1,
      reorder_probability_high: 0.15,
      recently_purchased: 0.2
    };

    let multiplier = 1;
    for (const segment of rules.targeting.user_segments) {
      multiplier *= segmentMultipliers[segment] || 0.2;
    }

    // Apply recency filter
    const recencyMultiplier = rules.targeting.recency_days <= 7 ? 0.3 :
                               rules.targeting.recency_days <= 30 ? 0.5 : 0.7;

    // Apply min orders filter
    const ordersMultiplier = rules.targeting.min_orders >= 5 ? 0.4 :
                            rules.targeting.min_orders >= 3 ? 0.6 : 0.8;

    return Math.round(baseAudience * multiplier * recencyMultiplier * ordersMultiplier);
  }

  /**
   * Estimate segment size
   */
  private estimateSegmentSize(segmentId: string): number {
    const segmentSizes: Record<string, number> = {
      high_value: 10000,
      churned: 7500,
      window_shoppers: 12500,
      deal_seekers: 15000,
      foodies: 10000,
      budget_minders: 12500,
      new_users: 5000,
      reorder_probability_high: 7500,
      recently_purchased: 10000
    };

    return segmentSizes[segmentId] || 5000;
  }

  /**
   * Estimate recency match
   */
  private estimateRecencyMatch(total: number, recencyDays: number): number {
    const recencyRates: Record<number, number> = {
      7: 0.2,
      14: 0.35,
      30: 0.5,
      60: 0.7,
      90: 0.85
    };

    const rate = recencyRates[recencyDays] || 0.5;
    return Math.round(total * rate);
  }

  /**
   * Estimate min orders match
   */
  private estimateMinOrdersMatch(total: number, minOrders: number): number {
    const ordersRates: Record<number, number> = {
      0: 1,
      1: 0.8,
      2: 0.6,
      3: 0.4,
      5: 0.25,
      10: 0.1
    };

    const rate = ordersRates[minOrders] || 0.5;
    return Math.round(total * rate);
  }
}

export const campaignService = new CampaignService();
export default campaignService;
