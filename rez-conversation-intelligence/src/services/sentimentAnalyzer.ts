import { SentimentAnalyzer } from 'sentiment';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

// Sentiment lexicon for commerce-specific terms
const COMMERCE_SENTIMENT_LEXICON: Record<string, number> = {
  // Positive commerce terms
  'excellent': 3,
  'amazing': 3,
  'wonderful': 3,
  'fantastic': 3,
  'outstanding': 3,
  'superb': 3,
  'great': 2,
  'good': 1,
  'helpful': 2,
  'friendly': 2,
  'professional': 2,
  'efficient': 2,
  'fast': 2,
  'quick': 2,
  'easy': 2,
  'smooth': 2,
  'seamless': 2,
  'perfect': 3,
  'love': 3,
  'loved': 3,
  'satisfied': 2,
  'recommend': 2,
  'recommended': 2,
  'happy': 2,
  'pleased': 2,
  'delighted': 3,
  'impressed': 2,
  'appreciate': 2,
  'appreciated': 2,
  'thank': 2,
  'thanks': 2,
  'grateful': 2,
  'resolved': 2,
  'fixed': 2,
  'solved': 2,

  // Negative commerce terms
  'terrible': -3,
  'awful': -3,
  'horrible': -3,
  'disgusting': -3,
  'appalling': -3,
  'dreadful': -3,
  'bad': -2,
  'poor': -2,
  'worst': -3,
  'hate': -3,
  'hated': -3,
  'disappointed': -2,
  'disappointing': -2,
  'frustrated': -2,
  'frustrating': -2,
  'annoyed': -2,
  'annoying': -2,
  'angry': -3,
  'upset': -2,
  'furious': -3,
  'useless': -3,
  'worthless': -3,
  'broken': -2,
  'damaged': -2,
  'defective': -2,
  'late': -1,
  'slow': -1,
  'delayed': -2,
  'cancelled': -2,
  'canceled': -2,
  'refund': -1,
  'complaint': -2,
  'complain': -2,
  'problem': -2,
  'issue': -1,
  'trouble': -2,
  'scam': -3,
  'fraud': -3,
  'ripoff': -3,
  'overcharged': -2,
  'expensive': -1,
  'overpriced': -2,
  'ridiculous': -2,
  'unacceptable': -2,
  'incompetent': -2,
  'rude': -2,
  'unprofessional': -2,

  // Neutral with context
  'okay': 0,
  'ok': 0,
  'fine': 1,
  'average': 0,
  'normal': 0,
  'usual': 0,
};

// Intensifiers and negators
const INTENSIFIERS: Record<string, number> = {
  'very': 1.5,
  'really': 1.4,
  'extremely': 1.8,
  'absolutely': 1.7,
  'completely': 1.6,
  'totally': 1.5,
  'so': 1.3,
  'quite': 1.2,
  'pretty': 1.1,
  'incredibly': 1.8,
  'utterly': 1.9,
};

const NEGATORS = [
  'not', "n't", 'no', 'never', 'neither', 'nobody', 'nothing',
  'nowhere', 'hardly', 'barely', 'scarcely', "don't", "doesn't",
  "didn't", "won't", "wouldn't", "shouldn't", "couldn't",
];

export interface SentimentResult {
  score: number;
  comparative: number;
  confidence: number;
  label: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  modifiers: string[];
}

export class SentimentAnalyzerService {
  private sentiment: SentimentAnalyzer;
  private confidenceThreshold: number;
  private commerceMode: boolean;

  constructor() {
    this.sentiment = new SentimentAnalyzer({ type: config.SENTIMENT_MODEL as 'afinn' || 'afinn' });
    this.confidenceThreshold = config.SENTIMENT_CONFIDENCE_THRESHOLD;
    this.commerceMode = true;
  }

  async analyze(text: string): Promise<SentimentResult> {
    try {
      // Get base sentiment from AFINN
      const baseResult = this.sentiment.analyze(text);

      // Enhance with commerce-specific lexicon
      const commerceResult = this.analyzeWithCommerceLexicon(text);

      // Combine scores
      const combinedScore = this.combineScores(baseResult.score, commerceResult.score);

      // Calculate comparative (score normalized by text length)
      const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
      const comparative = combinedScore / Math.max(words.length, 1);

      // Calculate confidence
      const confidence = this.calculateConfidence(baseResult, commerceResult, words.length);

      // Determine label
      let label: 'positive' | 'neutral' | 'negative';
      if (combinedScore > 0.05) label = 'positive';
      else if (combinedScore < -0.05) label = 'negative';
      else label = 'neutral';

      return {
        score: combinedScore,
        comparative: Math.round(comparative * 1000) / 1000,
        confidence,
        label,
        keywords: commerceResult.keywords,
        modifiers: commerceResult.modifiers,
      };
    } catch (error) {
      logger.error('Sentiment analysis failed', { error: (error as Error).message, text: text.slice(0, 100) });
      return {
        score: 0,
        comparative: 0,
        confidence: 0,
        label: 'neutral',
        keywords: [],
        modifiers: [],
      };
    }
  }

  private analyzeWithCommerceLexicon(text: string): {
    score: number;
    keywords: string[];
    modifiers: string[];
  } {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    let score = 0;
    const keywords: string[] = [];
    const modifiers: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z']/g, '');

      // Check for commerce lexicon match
      if (COMMERCE_SENTIMENT_LEXICON[word] !== undefined) {
        let wordScore = COMMERCE_SENTIMENT_LEXICON[word];

        // Check for intensifiers (preceding word)
        if (i > 0) {
          const prevWord = words[i - 1].replace(/[^a-z]/g, '');
          if (INTENSIFIERS[prevWord]) {
            wordScore *= INTENSIFIERS[prevWord];
            modifiers.push(prevWord);
          }
        }

        // Check for negators
        const hasNegator = NEGATORS.some((neg) => {
          if (i > 0) {
            return words[i - 1].includes(neg) || words.slice(Math.max(0, i - 2), i).some((w) => w.includes(neg));
          }
          return false;
        });

        if (hasNegator) {
          wordScore = -wordScore * 0.5; // Negation reduces magnitude
        }

        score += wordScore;
        keywords.push(word);
      }
    }

    return { score, keywords, modifiers };
  }

  private combineScores(afinnScore: number, commerceScore: number): number {
    // Weight commerce score higher for commerce-related text
    const commerceWeight = 0.6;
    const afinnWeight = 0.4;

    // Normalize AFINN score (typically ranges from -5 to +5 per word)
    const normalizedAfinn = afinnScore / 10;

    return (normalizedAfinn * afinnWeight) + (commerceScore * commerceWeight);
  }

  private calculateConfidence(
    afinnResult: { comparative: number; positive: string[]; negative: string[] },
    commerceResult: { keywords: string[] },
    wordCount: number
  ): number {
    // Confidence increases with more sentiment-bearing words
    const sentimentWordCount = afinnResult.positive.length + afinnResult.negative.length + commerceResult.keywords.length;

    // Higher word count generally means more reliable sentiment
    const lengthFactor = Math.min(wordCount / 20, 1);

    // More sentiment words = higher confidence
    const coverageFactor = Math.min(sentimentWordCount / Math.max(wordCount, 1) * 5, 1);

    // Combine factors
    const confidence = (lengthFactor * 0.3) + (coverageFactor * 0.7);

    return Math.round(confidence * 100) / 100;
  }

  async analyzeBatch(texts: string[]): Promise<SentimentResult[]> {
    return Promise.all(texts.map((text) => this.analyze(text)));
  }

  getTrend(
    results: SentimentResult[]
  ): 'improving' | 'declining' | 'stable' {
    if (results.length < 2) return 'stable';

    const halfPoint = Math.floor(results.length / 2);
    const firstHalf = results.slice(0, halfPoint);
    const secondHalf = results.slice(halfPoint);

    const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;

    const threshold = 0.3;
    if (secondAvg - firstAvg > threshold) return 'improving';
    if (firstAvg - secondAvg > threshold) return 'declining';
    return 'stable';
  }

  getStatistics(results: SentimentResult[]): {
    avgScore: number;
    avgComparative: number;
    distribution: Record<string, number>;
    totalAnalyzed: number;
  } {
    if (results.length === 0) {
      return {
        avgScore: 0,
        avgComparative: 0,
        distribution: { positive: 0, neutral: 0, negative: 0 },
        totalAnalyzed: 0,
      };
    }

    const distribution = {
      positive: results.filter((r) => r.label === 'positive').length,
      neutral: results.filter((r) => r.label === 'neutral').length,
      negative: results.filter((r) => r.label === 'negative').length,
    };

    return {
      avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      avgComparative: results.reduce((sum, r) => sum + r.comparative, 0) / results.length,
      distribution,
      totalAnalyzed: results.length,
    };
  }
}

export const sentimentAnalyzer = new SentimentAnalyzerService();
