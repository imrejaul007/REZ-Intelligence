/**
 * REZ Review Response Engine
 * AI-powered review response generator with sentiment analysis and escalation
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

const reviewSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  platform: { type: String, enum: ['google', 'facebook', 'rez', 'tripadvisor', 'zomato', 'swiggy'], required: true },
  platformReviewId: String,
  customerId: String,
  customerName: String,
  rating: { type: Number, min: 1, max: 5, required: true },
  title: String,
  text: { type: String, required: true },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  aspects: [{
    name: String,
    sentiment: String,
    mentions: Number
  }],
  response: {
    text: String,
    generatedAt: Date,
    approvedAt: Date,
    approvedBy: String,
    postedAt: Date,
    status: { type: String, enum: ['pending', 'approved', 'posted', 'custom'] }
  },
  escalated: { type: Boolean, default: false },
  escalationReason: String,
  createdAt: { type: Date, default: Date.now }
});

const responseTemplateSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative', 'all'] },
  platform: String,
  template: { type: String, required: true },
  variables: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);
const ResponseTemplate = mongoose.model('ResponseTemplate', responseTemplateSchema);

// ============== TYPES ==============

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  aspects: Array<{ name: string; sentiment: string; mentions: number }>;
}

interface GeneratedResponse {
  text: string;
  confidence: number;
  alternatives: string[];
  templateUsed?: string;
}

// ============== SERVICE ==============

class ReviewResponseEngineService {
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
    // Health
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', service: 'review-response-engine' });
    });

    // ========== REVIEWS ==========

    // Ingest review
    this.app.post('/api/reviews/ingest', async (req: Request, res: Response) => {
      try {
        const review = new Review(req.body);

        // Analyze sentiment
        const sentiment = this.analyzeSentiment(review.text);
        review.sentiment = sentiment.sentiment;
        review.aspects = sentiment.aspects;

        // Check for escalation
        if (this.shouldEscalate(review)) {
          review.escalated = true;
          review.escalationReason = this.getEscalationReason(review);
        }

        await review.save();
        res.json(review);
      } catch (error) {
        res.status(500).json({ error: 'Failed to ingest review' });
      }
    });

    // Batch ingest reviews
    this.app.post('/api/reviews/ingest/batch', async (req: Request, res: Response) => {
      try {
        const reviews = req.body.reviews as any[];
        const results = [];

        for (const reviewData of reviews) {
          const review = new Review(reviewData);
          const sentiment = this.analyzeSentiment(review.text);
          review.sentiment = sentiment.sentiment;
          review.aspects = sentiment.aspects;

          if (this.shouldEscalate(review)) {
            review.escalated = true;
            review.escalationReason = this.getEscalationReason(review);
          }

          await review.save();
          results.push(review);
        }

        res.json({ ingested: results.length, reviews: results });
      } catch (error) {
        res.status(500).json({ error: 'Failed to batch ingest reviews' });
      }
    });

    // Get reviews
    this.app.get('/api/reviews/:merchantId', async (req: Request, res: Response) => {
      try {
        const { platform, sentiment, status, startDate, endDate, limit } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (platform) query.platform = platform;
        if (sentiment) query.sentiment = sentiment;
        if (status) query['response.status'] = status;

        const reviews = await Review.find(query)
          .sort({ createdAt: -1 })
          .limit(Number(limit) || 50)
          .lean();

        res.json(reviews);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
      }
    });

    // ========== SENTIMENT ==========

    // Analyze sentiment
    this.app.post('/api/reviews/:id/analyze', async (req: Request, res: Response) => {
      try {
        const review = await Review.findById(req.params.id);
        if (!review) {
          return res.status(404).json({ error: 'Review not found' });
        }

        const sentiment = this.analyzeSentiment(review.text);
        review.sentiment = sentiment.sentiment;
        review.aspects = sentiment.aspects;
        await review.save();

        res.json(sentiment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze sentiment' });
      }
    });

    // Get sentiment stats
    this.app.get('/api/reviews/:merchantId/sentiment-stats', async (req: Request, res: Response) => {
      try {
        const reviews = await Review.find({ merchantId: req.params.merchantId }).lean();

        const stats = {
          total: reviews.length,
          positive: reviews.filter(r => r.sentiment === 'positive').length,
          neutral: reviews.filter(r => r.sentiment === 'neutral').length,
          negative: reviews.filter(r => r.sentiment === 'negative').length,
          avgRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
          escalated: reviews.filter(r => r.escalated).length,
          pendingResponses: reviews.filter(r => !r.response || r.response.status === 'pending').length
        };

        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get sentiment stats' });
      }
    });

    // ========== RESPONSES ==========

    // Generate AI response
    this.app.post('/api/reviews/:id/respond', async (req: Request, res: Response) => {
      try {
        const review = await Review.findById(req.params.id);
        if (!review) {
          return res.status(404).json({ error: 'Review not found' });
        }

        const response = await this.generateResponse(review);
        review.response = {
          text: response.text,
          generatedAt: new Date(),
          status: 'pending'
        };
        await review.save();

        res.json({ review, response });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate response' });
      }
    });

    // Approve and post response
    this.app.post('/api/reviews/:id/approve', async (req: Request, res: Response) => {
      try {
        const { responseText, approvedBy } = req.body;

        const review = await Review.findById(req.params.id);
        if (!review) {
          return res.status(404).json({ error: 'Review not found' });
        }

        // Update response
        review.response = {
          text: responseText || review.response?.text,
          generatedAt: review.response?.generatedAt || new Date(),
          approvedAt: new Date(),
          approvedBy,
          postedAt: new Date(),
          status: 'posted'
        };

        await review.save();

        // In production, post to platform here
        res.json(review);
      } catch (error) {
        res.status(500).json({ error: 'Failed to approve response' });
      }
    });

    // Custom response (bypass AI)
    this.app.post('/api/reviews/:id/custom-response', async (req: Request, res: Response) => {
      try {
        const { text, approvedBy } = req.body;

        const review = await Review.findById(req.params.id);
        if (!review) {
          return res.status(404).json({ error: 'Review not found' });
        }

        review.response = {
          text,
          generatedAt: new Date(),
          approvedAt: new Date(),
          approvedBy,
          postedAt: new Date(),
          status: 'custom'
        };

        await review.save();
        res.json(review);
      } catch (error) {
        res.status(500).json({ error: 'Failed to save custom response' });
      }
    });

    // ========== ESCALATIONS ==========

    // Get escalated reviews
    this.app.get('/api/reviews/:merchantId/escalations', async (req: Request, res: Response) => {
      try {
        const reviews = await Review.find({
          merchantId: req.params.merchantId,
          escalated: true
        }).sort({ createdAt: -1 }).lean();

        res.json(reviews);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch escalations' });
      }
    });

    // Resolve escalation
    this.app.patch('/api/reviews/:id/resolve-escalation', async (req: Request, res: Response) => {
      try {
        const { resolution } = req.body;

        const review = await Review.findByIdAndUpdate(
          req.params.id,
          {
            escalated: false,
            escalationReason: resolution
          },
          { new: true }
        );

        res.json(review);
      } catch (error) {
        res.status(500).json({ error: 'Failed to resolve escalation' });
      }
    });

    // ========== TEMPLATES ==========

    // Create template
    this.app.post('/api/templates', async (req: Request, res: Response) => {
      try {
        const template = new ResponseTemplate(req.body);
        await template.save();
        res.json(template);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create template' });
      }
    });

    // Get templates
    this.app.get('/api/templates/:merchantId', async (req: Request, res: Response) => {
      try {
        const { sentiment, platform } = req.query;
        const query: any = { merchantId: req.params.merchantId, isActive: true };

        if (sentiment) query.sentiment = { $in: [sentiment, 'all'] };
        if (platform) query.platform = platform;

        const templates = await ResponseTemplate.find(query).lean();
        res.json(templates);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
      }
    });
  }

  /**
   * Analyze sentiment of review text
   */
  private analyzeSentiment(text: string): SentimentResult {
    const lowerText = text.toLowerCase();

    // Simple keyword-based sentiment (in production, use ML model)
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'delicious', 'awesome', 'perfect', 'friendly', 'recommend', 'thank'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disappointed', 'rude', 'slow', 'cold', 'overpriced', 'never', 'avoid', 'poor', 'dirty'];
    const neutralWords = ['ok', 'okay', 'average', 'decent', 'fine'];

    let score = 0;
    const words = lowerText.split(/\s+/);

    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) score += 0.2;
      if (negativeWords.some(nw => word.includes(nw))) score -= 0.3;
      if (neutralWords.some(nw => word.includes(nw))) score += 0;
    }

    score = Math.max(-1, Math.min(1, score));

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (score > 0.2) sentiment = 'positive';
    else if (score < -0.2) sentiment = 'negative';

    // Extract aspects (simplified)
    const aspects: Array<{ name: string; sentiment: string; mentions: number }> = [];
    const aspectKeywords = {
      'food': ['food', 'meal', 'dish', 'taste', 'curry', 'biryani', 'pizza', 'burger'],
      'service': ['service', 'staff', 'waiter', 'server', 'help'],
      'ambiance': ['ambiance', 'ambience', 'atmosphere', 'environment', 'music'],
      'cleanliness': ['clean', 'hygiene', 'dirty', 'tidy', 'maintain'],
      'value': ['price', 'value', 'money', 'expensive', 'cheap', 'worth'],
      'timing': ['time', 'wait', 'slow', 'fast', 'quick', 'delayed']
    };

    for (const [aspect, keywords] of Object.entries(aspectKeywords)) {
      const mentions = keywords.filter(kw => lowerText.includes(kw)).length;
      if (mentions > 0) {
        // Check sentiment for this aspect
        const aspectSentiment = keywords.some(kw => negativeWords.some(nw => lowerText.includes(nw))) ? 'negative' :
          keywords.some(kw => positiveWords.some(pw => lowerText.includes(pw))) ? 'positive' : 'neutral';
        aspects.push({ name: aspect, sentiment: aspectSentiment, mentions });
      }
    }

    return { sentiment, score, aspects };
  }

  /**
   * Check if review should be escalated
   */
  private shouldEscalate(review: any): boolean {
    // Very negative reviews (1-2 stars)
    if (review.rating <= 2) return true;

    // Extremely negative sentiment
    if (review.sentiment === 'negative' && review.text.length > 100) return true;

    // Contains escalation keywords
    const escalateKeywords = ['lawyer', 'legal', 'sue', 'food poisoning', 'hospital', 'allergic', 'police', 'complaint'];
    const text = review.text.toLowerCase();
    if (escalateKeywords.some(kw => text.includes(kw))) return true;

    // Viral risk (very long negative reviews)
    if (review.rating === 1 && review.text.length > 300) return true;

    return false;
  }

  /**
   * Get escalation reason
   */
  private getEscalationReason(review: any): string {
    if (review.rating === 1) return '1-star rating - Critical';
    if (review.rating === 2) return '2-star rating - High priority';
    if (review.sentiment === 'negative' && review.text.length > 100) return 'Detailed negative review';
    return 'Escalation keyword detected';
  }

  /**
   * Generate AI response for review
   */
  private async generateResponse(review: any): Promise<GeneratedResponse> {
    // Get templates
    const templates = await ResponseTemplate.find({
      merchantId: review.merchantId,
      sentiment: review.sentiment,
      isActive: true
    }).lean();

    // Find matching template
    let template = templates.find(t => !t.platform || t.platform === review.platform);

    if (!template) {
      // Fall back to default templates
      template = this.getDefaultTemplate(review.sentiment);
    }

    if (template) {
      // Replace variables
      let responseText = template.template;
      responseText = responseText.replace(/\{\{customerName\}\}/g, review.customerName || 'Customer');
      responseText = responseText.replace(/\{\{rating\}\}/g, review.rating.toString());
      responseText = responseText.replace(/\{\{date\}\}/g, new Date(review.createdAt).toLocaleDateString());

      return {
        text: responseText,
        confidence: 0.9,
        alternatives: [],
        templateUsed: template.name
      };
    }

    // Generate response using template logic
    const responses = this.generateTemplateResponse(review);
    return responses[0];
  }

  /**
   * Get default template
   */
  private getDefaultTemplate(sentiment: string) {
    const templates: Record<string, { name: string; template: string }> = {
      positive: {
        name: 'Thank You',
        template: 'Thank you so much {{customerName}}! We\'re thrilled to hear you enjoyed your experience. Looking forward to welcoming you again soon!'
      },
      neutral: {
        name: 'Neutral Response',
        template: 'Thank you for your feedback {{customerName}}. We appreciate you taking the time to share your experience. We\'ll work on improving. Hope to see you again!'
      },
      negative: {
        name: 'Apologize & Resolve',
        template: 'Dear {{customerName}}, we\'re sorry to hear about your experience. Your feedback has been shared with our team. Please contact us directly so we can make this right. We value your business.'
      }
    };

    return templates[sentiment] || templates.neutral;
  }

  /**
   * Generate template-based response
   */
  private generateTemplateResponse(review: any): GeneratedResponse[] {
    const sentiment = review.sentiment || 'neutral';
    const customerName = review.customerName || 'Valued Customer';

    const responses: Record<string, GeneratedResponse> = {
      positive: {
        text: `Hi ${customerName}, thank you so much for your wonderful review! We're thrilled to hear you had a great experience. Our team will be delighted to serve you again. See you soon!`,
        confidence: 0.95,
        alternatives: [
          `Thank you ${customerName}! We really appreciate your kind words. It was our pleasure serving you. Looking forward to your next visit!`,
          `${customerName}, we're so happy you enjoyed your experience! Thank you for the 5-star rating. Our entire team sends their warmest regards!`
        ]
      },
      neutral: {
        text: `Hi ${customerName}, thanks for your feedback. We appreciate you sharing your experience with us. We'll definitely take your comments into consideration. Hope to improve your next visit!`,
        confidence: 0.85,
        alternatives: [
          `Thank you ${customerName} for taking the time to review us. We value all feedback and will use it to get better. Hope to see you again soon!`,
          `Hi ${customerName}, thank you for your review. We're committed to providing the best experience and your feedback helps us improve.`
        ]
      },
      negative: {
        text: `Dear ${customerName}, we're truly sorry your experience didn't meet expectations. This isn't the standard we aim for. We've noted your concerns and will address them immediately. Please DM us so we can personally make this right.`,
        confidence: 0.80,
        alternatives: [
          `Hi ${customerName}, we're sorry to hear about your experience. That's not the service we strive to provide. Please give us another chance - contact us directly so we can ensure a better experience next time.`,
          `Dear ${customerName}, thank you for bringing this to our attention. We sincerely apologize for falling short. Your feedback is invaluable to us. Please reach out so we can make this right.`
        ]
      }
    };

    return [responses[sentiment] || responses.neutral];
  }

  async start(port: number = 4296): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_review_engine'
      );
      console.log('[ReviewResponseEngine] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[ReviewResponseEngine] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[ReviewResponseEngine] Failed to start:', error);
      throw error;
    }
  }
}

const service = new ReviewResponseEngineService();
service.start(4296);

export default service;
