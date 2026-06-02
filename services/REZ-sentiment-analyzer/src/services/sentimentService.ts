import { SocialPost, SentimentScore, TrendAnalysis, Alert, CompetitorComparison, AlertThreshold } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class SentimentAnalyzerService {
  private modelVersion = '1.0.0';
  private alerts: Alert[] = [];
  private alertThresholds: AlertThreshold[] = [
    { metric: 'averageSentiment', condition: 'below', threshold: 0.3, severity: 'warning', enabled: true },
    { metric: 'negativePercentage', condition: 'above', threshold: 0.4, severity: 'critical', enabled: true },
    { metric: 'volumeSpike', condition: 'above', threshold: 3, severity: 'warning', enabled: true },
  ];

  analyzeSentiment(post: SocialPost): SentimentScore {
    logger.info(`Analyzing sentiment for post: ${post.postId}`);

    const content = post.content.toLowerCase();
    const positiveWords = ['love', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'best', 'awesome', 'happy', 'good', 'nice', 'perfect'];
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'disappointed', 'angry', 'frustrated', 'poor', 'useless', 'broken'];
    const joyWords = ['love', 'happy', 'excited', 'delighted', 'pleased', 'grateful', 'thankful'];
    const angerWords = ['angry', 'furious', 'outraged', 'livid', 'frustrated', 'annoyed', 'irritated'];
    const sadnessWords = ['sad', 'disappointed', 'unhappy', 'upset', 'depressed', 'miserable', 'heartbroken'];
    const fearWords = ['scared', 'worried', 'afraid', 'concerned', 'anxious', 'nervous', 'terrified'];
    const surpriseWords = ['surprised', 'amazed', 'shocked', 'astonished', 'incredible', 'unbelievable'];
    const disgustWords = ['disgusting', 'gross', 'repulsive', 'sickening', 'revolting', 'nauseating'];

    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      if (content.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
      if (content.includes(word)) negativeCount++;
    });

    const joyCount = joyWords.filter(word => content.includes(word)).length;
    const angerCount = angerWords.filter(word => content.includes(word)).length;
    const sadnessCount = sadnessWords.filter(word => content.includes(word)).length;
    const fearCount = fearWords.filter(word => content.includes(word)).length;
    const surpriseCount = surpriseWords.filter(word => content.includes(word)).length;
    const disgustCount = disgustWords.filter(word => content.includes(word)).length;

    const totalEmotion = joyCount + angerCount + sadnessCount + fearCount + surpriseCount + disgustCount || 1;

    const sentimentScore = (positiveCount - negativeCount) / (positiveCount + negativeCount + 1);
    const normalizedScore = (sentimentScore + 1) / 2;

    let overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    if (positiveCount > negativeCount * 1.5) {
      overallSentiment = 'positive';
    } else if (negativeCount > positiveCount * 1.5) {
      overallSentiment = 'negative';
    } else if (positiveCount > 0 && negativeCount > 0) {
      overallSentiment = 'mixed';
    }

    const confidence = Math.min(0.5 + (positiveCount + negativeCount) * 0.1, 0.95);

    const keyPhrases = this.extractKeyPhrases(content);
    const topics = this.extractTopics(content, post.hashtags || []);

    return {
      postId: post.postId,
      overallSentiment,
      sentimentScore: Math.round(normalizedScore * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100,
      emotionBreakdown: {
        joy: Math.round((joyCount / totalEmotion) * 100) / 100,
        anger: Math.round((angerCount / totalEmotion) * 100) / 100,
        sadness: Math.round((sadnessCount / totalEmotion) * 100) / 100,
        fear: Math.round((fearCount / totalEmotion) * 100) / 100,
        surprise: Math.round((surpriseCount / totalEmotion) * 100) / 100,
        disgust: Math.round((disgustCount / totalEmotion) * 100) / 100,
      },
      keyPhrases,
      topics,
      modelVersion: this.modelVersion,
      analyzedAt: new Date().toISOString(),
    };
  }

  analyzeBatch(posts: SocialPost[]): SentimentScore[] {
    return posts.map(post => this.analyzeSentiment(post));
  }

  analyzeTrends(scores: SentimentScore[], startDate: string, endDate: string): TrendAnalysis {
    logger.info('Analyzing sentiment trends');

    const sentimentTrend = this.calculateTrend(scores);
    const averageSentiment = scores.reduce((sum, s) => sum + s.sentimentScore, 0) / scores.length;

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.sentimentScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.sentimentScore, 0) / secondHalf.length;
    const sentimentChange = secondAvg - firstAvg;

    const volumeChange = scores.length > 0 ? 0.1 : 0;

    const allTopics = scores.flatMap(s => s.topics);
    const topicCounts = allTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const keyTopics = Object.entries(topicCounts)
      .map(([topic, volume]) => ({
        topic,
        sentiment: this.getTopicSentiment(scores, topic),
        volume,
        trend: 'stable' as const,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    const peakMoments = this.findPeakMoments(scores);

    return {
      period: `${startDate} to ${endDate}`,
      startDate,
      endDate,
      sentimentTrend,
      averageSentiment: Math.round(averageSentiment * 1000) / 1000,
      sentimentChange: Math.round(sentimentChange * 1000) / 1000,
      volumeChange: Math.round(volumeChange * 100) / 100,
      keyTopics,
      peakMoments,
    };
  }

  checkAlerts(scores: SentimentScore[]): Alert[] {
    const newAlerts: Alert[] = [];

    if (scores.length === 0) return newAlerts;

    const avgSentiment = scores.reduce((sum, s) => sum + s.sentimentScore, 0) / scores.length;
    const negativePercentage = scores.filter(s => s.overallSentiment === 'negative').length / scores.length;

    for (const threshold of this.alertThresholds) {
      if (!threshold.enabled) continue;

      let triggered = false;
      let currentValue = 0;

      if (threshold.metric === 'averageSentiment') {
        currentValue = avgSentiment;
        triggered = threshold.condition === 'below' ? avgSentiment < threshold.threshold : avgSentiment > threshold.threshold;
      } else if (threshold.metric === 'negativePercentage') {
        currentValue = negativePercentage;
        triggered = threshold.condition === 'above' ? negativePercentage > threshold.threshold : negativePercentage < threshold.threshold;
      }

      if (triggered) {
        newAlerts.push({
          alertId: uuidv4(),
          metric: threshold.metric,
          severity: threshold.severity,
          message: `${threshold.metric} is ${threshold.condition} threshold: ${currentValue.toFixed(2)} ${threshold.condition} ${threshold.threshold}`,
          currentValue: Math.round(currentValue * 1000) / 1000,
          threshold: threshold.threshold,
          triggeredAt: new Date().toISOString(),
          acknowledged: false,
        });
      }
    }

    this.alerts = [...this.alerts, ...newAlerts];
    return newAlerts;
  }

  getUnacknowledgedAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  compareCompetitors(brandScores: Record<string, SentimentScore[]>): CompetitorComparison[] {
    const comparisons: CompetitorComparison[] = [];
    const totalVolume = Object.values(brandScores).reduce((sum, scores) => sum + scores.length, 0);

    for (const [brand, scores] of Object.entries(brandScores)) {
      const avgSentiment = scores.length > 0
        ? scores.reduce((sum, s) => sum + s.sentimentScore, 0) / scores.length
        : 0.5;

      const trend = this.calculateTrend(scores);

      comparisons.push({
        brand,
        averageSentiment: Math.round(avgSentiment * 1000) / 1000,
        volume: scores.length,
        trend,
        shareOfVoice: totalVolume > 0 ? Math.round((scores.length / totalVolume) * 100) : 0,
        comparedToOwn: 0,
      });
    }

    const ownBrand = comparisons.find(c => c.brand === 'own');
    if (ownBrand) {
      comparisons.forEach(c => {
        if (c.brand !== 'own') {
          c.comparedToOwn = Math.round((c.averageSentiment - ownBrand.averageSentiment) * 1000) / 1000;
        }
      });
    }

    return comparisons.sort((a, b) => b.shareOfVoice - a.shareOfVoice);
  }

  private extractKeyPhrases(content: string): string[] {
    const phrases: string[] = [];
    const commonPhrases = [
      'customer service', 'delivery time', 'product quality', 'price', 'value',
      'user experience', 'mobile app', 'website', 'support team', 'shipping',
      'return policy', 'discount', 'promotion', 'brand', 'recommend'
    ];

    commonPhrases.forEach(phrase => {
      if (content.includes(phrase)) {
        phrases.push(phrase);
      }
    });

    return phrases.slice(0, 5);
  }

  private extractTopics(content: string, hashtags: string[]): string[] {
    const topics: string[] = [];

    if (content.includes('delivery') || content.includes('shipping') || content.includes('arrived')) {
      topics.push('Delivery');
    }
    if (content.includes('price') || content.includes('cost') || content.includes('expensive') || content.includes('cheap')) {
      topics.push('Pricing');
    }
    if (content.includes('quality') || content.includes('broken') || content.includes('defective')) {
      topics.push('Product Quality');
    }
    if (content.includes('service') || content.includes('support') || content.includes('help')) {
      topics.push('Customer Service');
    }
    if (content.includes('app') || content.includes('website') || content.includes('ui') || content.includes('interface')) {
      topics.push('Digital Experience');
    }

    hashtags.forEach(tag => {
      const cleanTag = tag.replace('#', '').toLowerCase();
      if (['product', 'shopping', 'deals', 'brand', 'review'].some(t => cleanTag.includes(t))) {
        topics.push(`#${cleanTag}`);
      }
    });

    return [...new Set(topics)].slice(0, 5);
  }

  private calculateTrend(scores: SentimentScore[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 2) return 'stable';

    const sorted = [...scores].sort((a, b) =>
      new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime()
    );

    const firstThird = sorted.slice(0, Math.floor(sorted.length / 3));
    const lastThird = sorted.slice(-Math.floor(sorted.length / 3));

    const firstAvg = firstThird.reduce((sum, s) => sum + s.sentimentScore, 0) / firstThird.length;
    const lastAvg = lastThird.reduce((sum, s) => sum + s.sentimentScore, 0) / lastThird.length;

    const change = lastAvg - firstAvg;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  private getTopicSentiment(scores: SentimentScore[], topic: string): number {
    const topicScores = scores.filter(s => s.topics.includes(topic));
    if (topicScores.length === 0) return 0.5;
    return topicScores.reduce((sum, s) => sum + s.sentimentScore, 0) / topicScores.length;
  }

  private findPeakMoments(scores: SentimentScore[]): { timestamp: string; event: string; sentiment: number; volume: number }[] {
    if (scores.length === 0) return [];

    return [{
      timestamp: scores[Math.floor(scores.length / 2)].analyzedAt,
      event: 'Peak engagement period',
      sentiment: scores[Math.floor(scores.length / 2)].sentimentScore,
      volume: scores.length,
    }];
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}

export const sentimentAnalyzerService = new SentimentAnalyzerService();
