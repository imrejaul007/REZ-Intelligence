import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  Experiment,
  ExperimentHypothesis,
  ExperimentVariant,
  TargetSegment,
  ExperimentBudget,
  ExperimentStatus,
  GrowthGoal,
  GoalType,
  MetricType,
  ConfidenceLevel,
  CreateExperimentRequest,
  ExperimentResults,
  ExperimentResultsSchema
} from '../models/experiment';

/**
 * Generated experiment suggestion with reasoning
 */
export interface ExperimentSuggestion {
  experiment: Partial<Experiment>;
  reasoning: string;
  potentialImpact: 'high' | 'medium' | 'low';
  estimatedCost: number;
  suggestedDuration: number;
  risks: string[];
}

/**
 * Historical data for learning
 */
export interface HistoricalData {
  pastExperiments: Experiment[];
  campaignPerformance: {
    channel: string;
    avgCtr: number;
    avgCvr: number;
    avgRoas: number;
  }[];
  customerSegments: TargetSegment[];
  seasonalTrends: {
    period: string;
    metric: MetricType;
    factor: number;
  }[];
}

/**
 * Growth pattern recognition
 */
interface GrowthPattern {
  pattern: string;
  description: string;
  confidence: number;
  applicableGoalTypes: GoalType[];
}

/**
 * AI Prompt context for experiment generation
 */
interface GenerationContext {
  goals: GrowthGoal[];
  historicalData: HistoricalData;
  currentBudget: number;
  activeExperiments: number;
  targetAudience: string;
}

/**
 * Experiment Generator Service
 * Uses AI patterns and historical data to generate growth experiments
 */
export class ExperimentGeneratorService {
  private logger: Logger;
  private historicalData: HistoricalData | null = null;
  private growthPatterns: GrowthPattern[];

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeGrowthPatterns();
  }

  /**
   * Initialize recognized growth patterns
   */
  private initializeGrowthPatterns(): void {
    this.growthPatterns = [
      {
        pattern: 'onboarding_optimization',
        description: 'Improve user onboarding to increase activation and retention',
        confidence: 0.85,
        applicableGoalTypes: [GoalType.RETENTION, GoalType.CONVERSION]
      },
      {
        pattern: 'pricing_experiment',
        description: 'Test different pricing strategies to optimize revenue',
        confidence: 0.78,
        applicableGoalTypes: [GoalType.REVENUE]
      },
      {
        pattern: 'notification_strategy',
        description: 'Optimize notification timing and content for re-engagement',
        confidence: 0.82,
        applicableGoalTypes: [GoalType.ENGAGEMENT, GoalType.RETENTION]
      },
      {
        pattern: 'referral_program',
        description: 'Incentivize users to refer new customers',
        confidence: 0.88,
        applicableGoalTypes: [GoalType.ACQUISITION, GoalType.CUSTOMERS]
      },
      {
        pattern: 'upsell_crosssell',
        description: 'Increase average order value through related products',
        confidence: 0.75,
        applicableGoalTypes: [GoalType.REVENUE]
      },
      {
        pattern: 'loyalty_reward',
        description: 'Implement rewards to increase customer lifetime value',
        confidence: 0.80,
        applicableGoalTypes: [GoalType.RETENTION, GoalType.REVENUE]
      },
      {
        pattern: 'checkout_optimization',
        description: 'Reduce friction in checkout to improve conversion',
        confidence: 0.90,
        applicableGoalTypes: [GoalType.CONVERSION, GoalType.REVENUE]
      },
      {
        pattern: 'personalization',
        description: 'Use AI-driven personalization for better engagement',
        confidence: 0.83,
        applicableGoalTypes: [GoalType.ENGAGEMENT, GoalType.CONVERSION]
      }
    ];
  }

  /**
   * Set historical data for learning
   */
  setHistoricalData(data: HistoricalData): void {
    this.historicalData = data;
    this.logger.info('Historical data loaded', {
      pastExperiments: data.pastExperiments.length,
      campaignPerformance: data.campaignPerformance.length,
      customerSegments: data.customerSegments.length
    });
  }

  /**
   * Generate experiment suggestions based on goals
   */
  async generateSuggestions(context: GenerationContext): Promise<ExperimentSuggestion[]> {
    this.logger.info('Generating experiment suggestions', {
      goals: context.goals.map(g => g.name),
      budget: context.currentBudget,
      activeExperiments: context.activeExperiments
    });

    const suggestions: ExperimentSuggestion[] = [];

    // Generate suggestions based on each goal
    for (const goal of context.goals) {
      const relevantPatterns = this.growthPatterns.filter(
        p => p.applicableGoalTypes.includes(goal.type)
      );

      // Sort by confidence and select top patterns
      const topPatterns = relevantPatterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 2);

      for (const pattern of topPatterns) {
        const suggestion = await this.generateForPattern(pattern, goal, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Add variations based on historical performance
    if (this.historicalData) {
      const historicalSuggestions = this.generateFromHistorical(context);
      suggestions.push(...historicalSuggestions);
    }

    // Sort by potential impact and return
    return suggestions.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.potentialImpact] - impactOrder[a.potentialImpact];
    });
  }

  /**
   * Generate experiment for a specific pattern
   */
  private async generateForPattern(
    pattern: GrowthPattern,
    goal: GrowthGoal,
    context: GenerationContext
  ): Promise<ExperimentSuggestion | null> {
    const experimentVariants = this.createVariantsForPattern(pattern.pattern, goal);
    if (!experimentVariants) return null;

    const targetSegment = this.identifyTargetSegment(goal, pattern.pattern);
    const estimatedCost = this.estimateExperimentCost(experimentVariants, targetSegment);
    const suggestedDuration = this.estimateDuration(goal, pattern);

    // Calculate potential impact based on pattern confidence and goal distance
    const goalProgress = goal.currentValue / goal.targetValue;
    const potentialImpact = this.calculateImpact(goalProgress, pattern.confidence);

    return {
      experiment: {
        id: uuidv4(),
        name: this.generateExperimentName(pattern.pattern, goal),
        description: this.generateDescription(pattern, goal),
        goalType: goal.type,
        targetMetric: this.mapGoalToMetric(goal),
        hypothesis: this.generateHypothesis(pattern, goal),
        variants: experimentVariants,
        targetSegment,
        budget: {
          totalBudget: estimatedCost,
          spent: 0,
          currency: 'INR',
          autoPauseThreshold: 0.7
        },
        status: ExperimentStatus.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: 'system',
        tags: [pattern.pattern, goal.type]
      },
      reasoning: this.generateReasoning(pattern, goal, context),
      potentialImpact,
      estimatedCost,
      suggestedDuration,
      risks: this.identifyRisks(pattern, goal, experimentVariants)
    };
  }

  /**
   * Create variants for a pattern
   */
  private createVariantsForPattern(pattern: string, goal: GrowthGoal): ExperimentVariant[] | null {
    const baseVariant: ExperimentVariant = {
      id: uuidv4(),
      name: 'Control',
      description: 'Current baseline implementation',
      trafficAllocation: 50,
      changes: {},
      successCriteria: {
        primary: {
          metric: this.mapGoalToMetric(goal),
          improvement: 0.1,
          minimumSampleSize: 1000
        }
      }
    };

    switch (pattern) {
      case 'onboarding_optimization':
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'Simplified Onboarding',
            description: 'Reduced onboarding steps from 5 to 3',
            trafficAllocation: 25,
            changes: {
              messaging: 'Get started in 2 minutes',
              timing: { steps: 3 }
            },
            successCriteria: {
              primary: { metric: MetricType.RETENTION_RATE, improvement: 0.15, minimumSampleSize: 1000 },
              secondary: [
                { metric: MetricType.ACTIVE_USERS, improvement: 0.1 }
              ]
            }
          },
          {
            id: uuidv4(),
            name: 'Personalized Onboarding',
            description: 'AI-driven personalized onboarding based on user intent',
            trafficAllocation: 25,
            changes: {
              messaging: 'Personalized to your goals',
              custom: { personalization: true }
            },
            successCriteria: {
              primary: { metric: MetricType.RETENTION_RATE, improvement: 0.2, minimumSampleSize: 1000 }
            }
          }
        ];

      case 'pricing_experiment':
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'Discounted Price',
            description: '10% discount on subscription',
            trafficAllocation: 25,
            changes: {
              custom: { discount: 0.1 }
            },
            successCriteria: {
              primary: { metric: MetricType.REVENUE, improvement: 0.15, minimumSampleSize: 500 }
            }
          },
          {
            id: uuidv4(),
            name: 'Bundle Pricing',
            description: 'Bundle with additional features',
            trafficAllocation: 25,
            changes: {
              custom: { bundle: true }
            },
            successCriteria: {
              primary: { metric: MetricType.AOV, improvement: 0.25, minimumSampleSize: 500 }
            }
          }
        ];

      case 'notification_strategy':
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'Morning Notifications',
            description: 'Push notifications at 9 AM',
            trafficAllocation: 25,
            changes: {
              timing: { hour: 9, timezone: 'Asia/Kolkata' },
              channel: 'push'
            },
            successCriteria: {
              primary: { metric: MetricType.ENGAGEMENT, improvement: 0.2, minimumSampleSize: 2000 }
            }
          },
          {
            id: uuidv4(),
            name: 'Evening Notifications',
            description: 'Push notifications at 7 PM',
            trafficAllocation: 25,
            changes: {
              timing: { hour: 19, timezone: 'Asia/Kolkata' },
              channel: 'push'
            },
            successCriteria: {
              primary: { metric: MetricType.ENGAGEMENT, improvement: 0.2, minimumSampleSize: 2000 }
            }
          }
        ];

      case 'referral_program':
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'Referral with Reward',
            description: 'Both referrer and referee get rewards',
            trafficAllocation: 25,
            changes: {
              custom: {
                referral: true,
                referrerReward: 50,
                refereeReward: 25
              }
            },
            successCriteria: {
              primary: { metric: MetricType.ACQUISITION, improvement: 0.3, minimumSampleSize: 1000 }
            }
          },
          {
            id: uuidv4(),
            name: 'Double-sided Referral',
            description: 'Increased rewards for successful referrals',
            trafficAllocation: 25,
            changes: {
              custom: {
                referral: true,
                referrerReward: 100,
                refereeReward: 50
              }
            },
            successCriteria: {
              primary: { metric: MetricType.ACQUISITION, improvement: 0.4, minimumSampleSize: 1000 }
            }
          }
        ];

      case 'checkout_optimization':
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'One-click Checkout',
            description: 'Simplified one-click checkout for returning users',
            trafficAllocation: 25,
            changes: {
              custom: { oneClickCheckout: true }
            },
            successCriteria: {
              primary: { metric: MetricType.CONVERSION_RATE, improvement: 0.25, minimumSampleSize: 1000 }
            }
          },
          {
            id: uuidv4(),
            name: 'Guest Checkout',
            description: 'Allow checkout without account creation',
            trafficAllocation: 25,
            changes: {
              custom: { guestCheckout: true }
            },
            successCriteria: {
              primary: { metric: MetricType.CONVERSION_RATE, improvement: 0.15, minimumSampleSize: 1000 }
            }
          }
        ];

      default:
        // Generic experiment for unknown patterns
        return [
          baseVariant,
          {
            id: uuidv4(),
            name: 'Treatment A',
            description: 'Variant with proposed changes',
            trafficAllocation: 50,
            changes: { custom: { experiment: true } },
            successCriteria: {
              primary: {
                metric: this.mapGoalToMetric(goal),
                improvement: 0.15,
                minimumSampleSize: 1000
              }
            }
          }
        ];
    }
  }

  /**
   * Identify target segment for the experiment
   */
  private identifyTargetSegment(goal: GrowthGoal, pattern: string): TargetSegment {
    // Default segments based on goal type
    const segments: Record<GoalType, Partial<TargetSegment>> = {
      [GoalType.REVENUE]: {
        name: 'High-Value Users',
        criteria: { spendRanges: { min: 5000 } },
        size: 10000,
        estimatedReach: 8000
      },
      [GoalType.CUSTOMERS]: {
        name: 'New Users (Last 30 Days)',
        criteria: { userTypes: ['new'] },
        size: 50000,
        estimatedReach: 40000
      },
      [GoalType.ENGAGEMENT]: {
        name: 'Active Users',
        criteria: { userTypes: ['existing'], activities: ['last_7_days'] },
        size: 100000,
        estimatedReach: 75000
      },
      [GoalType.RETENTION]: {
        name: 'At-Risk Users',
        criteria: { userTypes: ['churned'] },
        size: 20000,
        estimatedReach: 15000
      },
      [GoalType.ACQUISITION]: {
        name: 'Lookalike Audience',
        criteria: { userTypes: ['new'] },
        size: 1000000,
        estimatedReach: 500000
      },
      [GoalType.CONVERSION]: {
        name: 'Intenders',
        criteria: { activities: ['browsed_not_purchased'] },
        size: 50000,
        estimatedReach: 35000
      }
    };

    const segment = segments[goal.type] || segments[GoalType.ENGAGEMENT];

    return {
      id: uuidv4(),
      name: segment.name!,
      criteria: segment.criteria as TargetSegment['criteria'],
      size: segment.size!,
      estimatedReach: segment.estimatedReach!
    };
  }

  /**
   * Generate experiment name
   */
  private generateExperimentName(pattern: string, goal: GrowthGoal): string {
    const patternNames: Record<string, string> = {
      onboarding_optimization: 'Onboarding',
      pricing_experiment: 'Pricing',
      notification_strategy: 'Notifications',
      referral_program: 'Referral',
      upsell_crosssell: 'Upsell',
      loyalty_reward: 'Loyalty',
      checkout_optimization: 'Checkout',
      personalization: 'Personalization'
    };

    const prefix = patternNames[pattern] || pattern;
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix} ${goal.type} Experiment ${timestamp}`;
  }

  /**
   * Generate experiment description
   */
  private generateDescription(pattern: GrowthPattern, goal: GrowthGoal): string {
    return `Automated ${pattern.pattern.replace(/_/g, ' ')} experiment targeting ${goal.type} with expected ${goal.unit === 'percentage' ? '' : ''}${goal.targetValue}${goal.unit === 'percentage' ? '%' : ''} improvement. Pattern confidence: ${Math.round(pattern.confidence * 100)}%.`;
  }

  /**
   * Generate hypothesis for the experiment
   */
  private generateHypothesis(pattern: GrowthPattern, goal: GrowthGoal): ExperimentHypothesis {
    const hypothesisTemplates: Record<string, string> = {
      onboarding_optimization: `By simplifying the onboarding flow, we expect to see a ${Math.round(pattern.confidence * 20)}% increase in user activation and retention.`,
      pricing_experiment: `By testing alternative pricing strategies, we expect to optimize revenue per user by ${Math.round(pattern.confidence * 15)}%.`,
      notification_strategy: `By optimizing notification timing and content, we expect to increase user engagement by ${Math.round(pattern.confidence * 20)}%.`,
      referral_program: `By incentivizing referrals, we expect to acquire new customers at a ${Math.round(pattern.confidence * 30)}% lower CAC.`,
      upsell_crosssell: `By promoting relevant upsells, we expect to increase average order value by ${Math.round(pattern.confidence * 15)}%.`,
      loyalty_reward: `By rewarding loyal customers, we expect to improve retention by ${Math.round(pattern.confidence * 20)}%.`,
      checkout_optimization: `By reducing checkout friction, we expect to improve conversion rate by ${Math.round(pattern.confidence * 25)}%.`,
      personalization: `By personalizing the experience, we expect to increase engagement by ${Math.round(pattern.confidence * 25)}%.`
    };

    return {
      id: uuidv4(),
      statement: hypothesisTemplates[pattern.pattern] || `By implementing ${pattern.pattern.replace(/_/g, ' ')}, we expect to improve ${goal.type} metrics.`,
      expectedOutcome: `${goal.type} improvement of ${goal.targetValue}${goal.unit === 'percentage' ? '%' : ''}`,
      confidenceLevel: pattern.confidence >= 0.85 ? ConfidenceLevel.HIGH :
                       pattern.confidence >= 0.75 ? ConfidenceLevel.MEDIUM :
                       ConfidenceLevel.LOW,
      supportingData: `Pattern analysis of ${pattern.description}`,
      risks: this.identifyHypothesisRisks(pattern, goal)
    };
  }

  /**
   * Identify risks for the experiment
   */
  private identifyRisks(
    pattern: GrowthPattern,
    goal: GrowthGoal,
    variants: ExperimentVariant[]
  ): string[] {
    const risks: string[] = [];

    // Budget risk
    const estimatedCost = this.estimateExperimentCost(variants, this.identifyTargetSegment(goal, pattern.pattern));
    risks.push(`Estimated cost of ₹${estimatedCost.toLocaleString()} may impact other experiments`);

    // Sample size risk
    const totalMinSample = variants.reduce((sum, v) => sum + v.successCriteria.primary.minimumSampleSize, 0);
    if (totalMinSample > 50000) {
      risks.push(`Large sample size required (${totalMinSample.toLocaleString()}) may delay results`);
    }

    // Pattern-specific risks
    if (pattern.pattern === 'pricing_experiment') {
      risks.push('Pricing changes may negatively impact brand perception');
      risks.push('May trigger competitor response');
    }

    if (pattern.pattern === 'notification_strategy') {
      risks.push('Over-notification may lead to app uninstalls');
      risks.push('May annoy users if timing is incorrect');
    }

    if (pattern.pattern === 'referral_program') {
      risks.push('May attract low-quality users');
      risks.push('Fraud risk from fake referrals');
    }

    return risks;
  }

  /**
   * Identify hypothesis-level risks
   */
  private identifyHypothesisRisks(pattern: GrowthPattern, goal: GrowthGoal): string[] {
    const risks = this.identifyRisks(pattern, goal, []);
    return risks.slice(0, 3); // Return top 3 risks
  }

  /**
   * Estimate experiment cost
   */
  private estimateExperimentCost(variants: ExperimentVariant[], segment: TargetSegment): number {
    // Base cost per variant
    const baseCostPerVariant = 5000;

    // Cost per 1000 impressions
    const costPerThousand = 100;

    // Estimated impressions based on segment size
    const estimatedImpressions = segment.estimatedReach * 0.3 * variants.length;

    return Math.round(
      (variants.length * baseCostPerVariant) +
      (estimatedImpressions / 1000) * costPerThousand
    );
  }

  /**
   * Estimate experiment duration
   */
  private estimateDuration(goal: GrowthGoal, pattern: GrowthPattern): number {
    // Base duration in days
    const baseDuration: Record<GoalType, number> = {
      [GoalType.REVENUE]: 21,
      [GoalType.CUSTOMERS]: 28,
      [GoalType.ENGAGEMENT]: 14,
      [GoalType.RETENTION]: 30,
      [GoalType.ACQUISITION]: 21,
      [GoalType.CONVERSION]: 14
    };

    // Adjust based on pattern confidence (higher confidence = shorter duration)
    const adjustment = 1 - (pattern.confidence - 0.5) * 0.4;

    return Math.round((baseDuration[goal.type] || 21) * adjustment);
  }

  /**
   * Calculate potential impact
   */
  private calculateImpact(goalProgress: number, patternConfidence: number): 'high' | 'medium' | 'low' {
    // Higher impact when goal is far from target (goalProgress < 0.5)
    // and pattern has high confidence
    const score = (1 - goalProgress) * patternConfidence;

    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Map goal type to metric type
   */
  private mapGoalToMetric(goal: GrowthGoal): MetricType {
    const mapping: Record<GoalType, MetricType> = {
      [GoalType.REVENUE]: MetricType.REVENUE,
      [GoalType.CUSTOMERS]: MetricType.ACTIVE_USERS,
      [GoalType.ENGAGEMENT]: MetricType.SESSIONS,
      [GoalType.RETENTION]: MetricType.RETENTION_RATE,
      [GoalType.ACQUISITION]: MetricType.CAC,
      [GoalType.CONVERSION]: MetricType.CONVERSION_RATE
    };
    return mapping[goal.type] || MetricType.ENGAGEMENT;
  }

  /**
   * Generate reasoning for the suggestion
   */
  private generateReasoning(pattern: GrowthPattern, goal: GrowthGoal, context: GenerationContext): string {
    const reasoning = `Generated ${pattern.pattern.replace(/_/g, ' ')} experiment targeting ${goal.type} improvement. `;
    const confidenceNote = `Pattern confidence: ${Math.round(pattern.confidence * 100)}%. `;
    const budgetNote = context.currentBudget > 0 ?
      `Allocated budget: ₹${context.currentBudget.toLocaleString()}. ` :
      'No specific budget constraint. ';
    const existingNote = context.activeExperiments > 0 ?
      `Note: ${context.activeExperiments} active experiment(s) running. ` :
      '';

    return reasoning + confidenceNote + budgetNote + existingNote;
  }

  /**
   * Generate experiments from historical data
   */
  private generateFromHistorical(context: GenerationContext): ExperimentSuggestion[] {
    if (!this.historicalData) return [];

    const suggestions: ExperimentSuggestion[] = [];

    // Analyze best performing campaigns
    const topPerformer = this.historicalData.campaignPerformance
      .sort((a, b) => b.avgRoas - a.avgRoas)[0];

    if (topPerformer && topPerformer.avgRoas > 2) {
      suggestions.push({
        experiment: {
          id: uuidv4(),
          name: `Scale ${topPerformer.channel} Campaigns`,
          description: `Scale proven ${topPerformer.channel} campaigns that achieved ${topPerformer.avgRoas}x ROAS`,
          goalType: GoalType.REVENUE,
          targetMetric: MetricType.ROAS,
          hypothesis: {
            id: uuidv4(),
            statement: `Scaling ${topPerformer.channel} will maintain ROAS above 2x`,
            expectedOutcome: `${topPerformer.avgRoas}x ROAS`,
            confidenceLevel: ConfidenceLevel.HIGH,
            risks: ['May hit saturation', 'Increased spend may reduce efficiency']
          },
          variants: [
            {
              id: uuidv4(),
              name: 'Current',
              description: 'Current budget allocation',
              trafficAllocation: 50,
              changes: {},
              successCriteria: {
                primary: { metric: MetricType.ROAS, improvement: 0.1, minimumSampleSize: 500 }
              }
            },
            {
              id: uuidv4(),
              name: '50% Increase',
              description: '50% budget increase',
              trafficAllocation: 50,
              changes: { custom: { budgetIncrease: 0.5 } },
              successCriteria: {
                primary: { metric: MetricType.ROAS, improvement: 0, minimumSampleSize: 500 }
              }
            }
          ],
          targetSegment: {
            id: uuidv4(),
            name: 'Similar Users',
            criteria: { userTypes: ['existing'] },
            size: 50000,
            estimatedReach: 40000
          },
          budget: {
            totalBudget: 25000,
            spent: 0,
            currency: 'INR'
          },
          status: ExperimentStatus.DRAFT,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          owner: 'system',
          tags: ['scaling', topPerformer.channel]
        },
        reasoning: `Historical data shows ${topPerformer.channel} campaigns achieving ${topPerformer.avgRoas}x ROAS. Testing scale potential.`,
        potentialImpact: 'high',
        estimatedCost: 25000,
        suggestedDuration: 14,
        risks: ['May hit audience saturation', 'CPC may increase at scale']
      });
    }

    // Analyze past experiments for learnings
    const completedExperiments = this.historicalData.pastExperiments
      .filter(e => e.status === ExperimentStatus.COMPLETED);

    if (completedExperiments.length > 0) {
      // Find winning patterns
      const winners = completedExperiments.filter(e => {
        // Simplified winner detection
        return e.tags && e.tags.some(t => ['personalization', 'checkout_optimization'].includes(t));
      });

      if (winners.length > 0) {
        suggestions.push({
          experiment: {
            id: uuidv4(),
            name: 'Iterate on Previous Winner',
            description: `Building on learnings from ${winners.length} successful past experiments`,
            goalType: GoalType.CONVERSION,
            targetMetric: MetricType.CONVERSION_RATE,
            hypothesis: {
              id: uuidv4(),
              statement: 'Combining successful elements will further improve conversion',
              expectedOutcome: '10% conversion improvement',
              confidenceLevel: ConfidenceLevel.MEDIUM,
              risks: ['Diminishing returns', 'Complexity creep']
            },
            variants: [
              {
                id: uuidv4(),
                name: 'Baseline',
                description: 'Current best implementation',
                trafficAllocation: 50,
                changes: {},
                successCriteria: {
                  primary: { metric: MetricType.CONVERSION_RATE, improvement: 0.05, minimumSampleSize: 1000 }
                }
              },
              {
                id: uuidv4(),
                name: 'Enhanced',
                description: 'Combined improvements',
                trafficAllocation: 50,
                changes: { custom: { iteration: true } },
                successCriteria: {
                  primary: { metric: MetricType.CONVERSION_RATE, improvement: 0.15, minimumSampleSize: 1000 }
                }
              }
            ],
            targetSegment: {
              id: uuidv4(),
              name: 'Converters',
              criteria: { activities: ['high_intent'] },
              size: 20000,
              estimatedReach: 15000
            },
            budget: {
              totalBudget: 15000,
              spent: 0,
              currency: 'INR'
            },
            status: ExperimentStatus.DRAFT,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            owner: 'system',
            tags: ['iteration', 'learning']
          },
          reasoning: `${winners.length} past experiments showed positive results. Iterating to compound gains.`,
          potentialImpact: 'medium',
          estimatedCost: 15000,
          suggestedDuration: 14,
          risks: ['Diminishing returns', 'May not generalize to new users']
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze experiment results and generate learnings
   */
  analyzeResults(experiment: Experiment, results: ExperimentResults): {
    learnings: string[];
    recommendations: string[];
  } {
    const learnings: string[] = [];
    const recommendations: string[] = [];

    // Find winning variant
    const winningVariant = results.variantResults.find(v => v.isWinner);

    if (winningVariant) {
      learnings.push(`${winningVariant.variantName} outperformed control by ${winningVariant.primaryMetricImprovement?.toFixed(1) || 0}%`);

      if (winningVariant.statisticalSignificance >= 0.95) {
        learnings.push('Results are statistically significant (p < 0.05)');
        recommendations.push(`Consider scaling ${winningVariant.variantName} to 100% of traffic`);
      } else {
        learnings.push('Results show promise but need more data for statistical significance');
        recommendations.push('Run experiment for additional duration to confirm results');
      }
    }

    // Analyze losing variants
    const losingVariants = results.variantResults.filter(v => !v.isWinner && v.sampleSize > 0);
    for (const variant of losingVariants) {
      learnings.push(`${variant.variantName} underperformed - consider dropping or iterating`);
    }

    // Cost efficiency analysis
    const avgCostPerConversion = results.overallResults.totalRevenue > 0
      ? results.budget.spent / results.overallResults.totalConversions
      : Infinity;

    if (avgCostPerConversion < 100) {
      learnings.push(`Cost per conversion: ₹${avgCostPerConversion.toFixed(2)} - highly efficient`);
    } else if (avgCostPerConversion > 500) {
      learnings.push(`Cost per conversion: ₹${avgCostPerConversion.toFixed(2)} - may need optimization`);
      recommendations.push('Review targeting to improve efficiency');
    }

    // Budget analysis
    const budgetUsed = results.budget.spent / results.budget.totalBudget;
    learnings.push(`Budget utilization: ${(budgetUsed * 100).toFixed(1)}%`);

    if (budgetUsed < 0.5 && results.overallResults.duration > 7) {
      learnings.push('Experiment consumed less budget than expected - may need larger audience');
    }

    // Segment analysis
    const segmentEfficiency = results.overallResults.totalConversions / results.overallResults.totalSampleSize;
    learnings.push(`Segment conversion rate: ${(segmentEfficiency * 100).toFixed(2)}%`);

    return { learnings, recommendations };
  }

  /**
   * Create full experiment from suggestion
   */
  async createExperimentFromSuggestion(
    suggestion: ExperimentSuggestion,
    owner: string
  ): Promise<Experiment> {
    const experiment: Experiment = {
      ...suggestion.experiment,
      id: suggestion.experiment.id || uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner,
      status: ExperimentStatus.DRAFT
    } as Experiment;

    this.logger.info('Created experiment from suggestion', {
      experimentId: experiment.id,
      name: experiment.name,
      owner
    });

    return experiment;
  }

  /**
   * Validate experiment configuration
   */
  validateExperiment(experiment: Partial<Experiment>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!experiment.name || experiment.name.length < 3) {
      errors.push('Experiment name must be at least 3 characters');
    }

    if (!experiment.variants || experiment.variants.length < 2) {
      errors.push('At least 2 variants are required');
    } else {
      const totalAllocation = experiment.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
      if (totalAllocation !== 100) {
        errors.push(`Variant allocation must sum to 100% (currently ${totalAllocation}%)`);
      }

      const hasControl = experiment.variants.some(v =>
        v.name.toLowerCase().includes('control') || v.trafficAllocation === 50
      );
      if (!hasControl) {
        warnings.push('No clear control variant detected - consider adding one');
      }
    }

    if (!experiment.targetSegment) {
      errors.push('Target segment is required');
    } else {
      if (!experiment.targetSegment.size || experiment.targetSegment.size < 100) {
        warnings.push('Small target segment may result in slow data collection');
      }
    }

    if (!experiment.budget || experiment.budget.totalBudget <= 0) {
      errors.push('Budget must be greater than 0');
    }

    if (!experiment.hypothesis) {
      errors.push('Hypothesis is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default ExperimentGeneratorService;
