/**
 * REZ Care Service - CSAT (Customer Satisfaction) Service
 *
 * Tracks and measures customer satisfaction across all support interactions.
 * Sends surveys, collects feedback, and generates insights.
 */

import mongoose from 'mongoose';
import axios from 'axios';
import { CSATSurvey, CSATMetrics } from '../types';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'https://rez-notifications-service.onrender.com';

// CSAT Survey Schema
const CSATSurveySchema = new mongoose.Schema({
  ticketId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  channel: { type: String, enum: ['whatsapp', 'sms', 'email', 'inapp'], required: true },
  status: { type: String, enum: ['pending', 'sent', 'completed', 'expired'], default: 'pending' },
  sentAt: Date,
  completedAt: Date,
  expiresAt: { type: Date, required: true, index: true },

  // Ratings
  overallRating: { type: Number, min: 1, max: 5 },
  npsScore: { type: Number, min: 0, max: 10 },
  cesScore: { type: Number, min: 1, max: 7 },
  feedback: String,

  // Metadata
  agentId: String,
  resolutionTime: Number,
  language: { type: String, enum: ['en', 'hi', 'hinglish'], default: 'en' }
}, { timestamps: true });

const CSATSurveyModel = mongoose.model('CSATSurvey', CSATSurveySchema);

// CSAT Response Schema (for historical tracking)
const CSATResponseSchema = new mongoose.Schema({
  surveyId: { type: String, required: true },
  ticketId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  channel: String,
  overallRating: { type: Number, min: 1, max: 5 },
  npsScore: { type: Number, min: 0, max: 10 },
  cesScore: { type: Number, min: 1, max: 7 },
  feedback: String,
  agentId: String,
  resolutionTime: Number,
  language: String,
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const CSATResponseModel = mongoose.model('CSATResponse', CSATResponseSchema);

export class CSATService {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('CSAT Service connected to MongoDB');
    }
  }

  /**
   * Send CSAT survey after ticket resolution
   */
  async sendSurvey(params: {
    ticketId: string;
    customerId: string;
    channel?: 'whatsapp' | 'sms' | 'email' | 'inapp';
    language?: 'en' | 'hi' | 'hinglish';
  }): Promise<CSATSurvey> {
    await this.connect();

    const { ticketId, customerId, channel = 'whatsapp', language = 'en' } = params;

    // Check if survey already exists
    const existing = await CSATSurveyModel.findOne({ ticketId, status: { $ne: 'expired' } });
    if (existing) {
      return existing.toObject() as any;
    }

    // Get customer preference
    let customerChannel = channel;
    let customerPhone = '';
    let customerEmail = '';

    try {
      const customerRes = await axios.post(
        `${process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com'}/api/profile/lookup`,
        { customerId },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      customerPhone = customerRes.data?.phone || '';
      customerEmail = customerRes.data?.email || '';
      customerChannel = customerRes.data?.preferredChannel || channel;
    } catch {
      logger.warn('Could not fetch customer preference, using default channel');
    }

    // Create survey
    const survey = new CSATSurveyModel({
      ticketId,
      customerId,
      channel: customerChannel,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      language
    });

    await survey.save();

    // Send survey notification
    await this.sendSurveyNotification(survey, { phone: customerPhone, email: customerEmail });

    // Update status to sent
    survey.status = 'sent';
    survey.sentAt = new Date();
    await survey.save();

    logger.info('CSAT survey sent', { ticketId, customerId, channel: customerChannel });

    return survey.toObject() as any;
  }

  /**
   * Submit CSAT response
   */
  async submitResponse(params: {
    ticketId: string;
    overallRating?: number;
    npsScore?: number;
    cesScore?: number;
    feedback?: string;
  }): Promise<{ success: boolean; sentiment: string }> {
    await this.connect();

    const { ticketId, overallRating, npsScore, cesScore, feedback } = params;

    // Find and update survey
    const survey = await CSATSurveyModel.findOne({ ticketId, status: 'sent' });
    if (!survey) {
      throw new Error('Survey not found or already completed');
    }

    // Calculate sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (overallRating && overallRating >= 4) sentiment = 'positive';
    else if (overallRating && overallRating <= 2) sentiment = 'negative';

    // Update survey
    survey.overallRating = overallRating;
    survey.npsScore = npsScore;
    survey.cesScore = cesScore;
    survey.feedback = feedback;
    survey.completedAt = new Date();
    survey.status = 'completed';
    await survey.save();

    // Save response for analytics
    const response = new CSATResponseModel({
      surveyId: survey._id,
      ticketId,
      customerId: survey.customerId,
      channel: survey.channel,
      overallRating,
      npsScore,
      cesScore,
      feedback,
      agentId: survey.agentId,
      resolutionTime: survey.resolutionTime,
      language: survey.language,
      sentiment
    });
    await response.save();

    // Update customer sentiment score
    await this.updateCustomerSentiment(survey.customerId, sentiment);

    // Send thank you notification for high ratings
    if (overallRating && overallRating >= 5) {
      await this.sendThankYouNotification(survey.customerId, 'whatsapp');
    }

    // Trigger follow-up for low ratings
    if (overallRating && overallRating <= 2) {
      await this.triggerLowRatingAlert(ticketId, survey.customerId, overallRating, feedback);
    }

    logger.info('CSAT response submitted', { ticketId, overallRating, sentiment });

    return { success: true, sentiment };
  }

  /**
   * Get CSAT metrics for a time period
   */
  async getMetrics(params: {
    start: Date;
    end: Date;
  }): Promise<CSATMetrics> {
    await this.connect();

    const { start, end } = params;

    // Get all responses in period
    const responses = await CSATResponseModel.find({
      createdAt: { $gte: start, $lte: end }
    });

    const totalResponses = responses.length;

    // Calculate metrics
    const responsesWithRating = responses.filter(r => r.overallRating);
    const overallCSAT = responsesWithRating.length > 0
      ? responsesWithRating.reduce((sum, r) => sum + (r.overallRating || 0), 0) / responsesWithRating.length
      : 0;

    // NPS calculation
    const promoters = responses.filter(r => r.npsScore && r.npsScore >= 9).length;
    const detractors = responses.filter(r => r.npsScore && r.npsScore <= 6).length;
    const nps = totalResponses > 0
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0;

    // CES calculation
    const responsesWithCES = responses.filter(r => r.cesScore);
    const ces = responsesWithCES.length > 0
      ? responsesWithCES.reduce((sum, r) => sum + (r.cesScore || 0), 0) / responsesWithCES.length
      : 0;

    // By channel
    const byChannel: Record<string, number> = {};
    responses.forEach(r => {
      if (r.channel) {
        if (!byChannel[r.channel]) byChannel[r.channel] = 0;
        byChannel[r.channel]++;
      }
    });

    // By agent
    const byAgent: Record<string, number> = {};
    responses.forEach(r => {
      if (r.agentId) {
        if (!byAgent[r.agentId]) byAgent[r.agentId] = 0;
        byAgent[r.agentId]++;
      }
    });

    // Calculate trend (compare first half vs second half)
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);
    const firstHalf = responses.filter(r => r.createdAt && r.createdAt < midpoint);
    const secondHalf = responses.filter(r => r.createdAt && r.createdAt >= midpoint);

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, r) => sum + (r.overallRating || 0), 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, r) => sum + (r.overallRating || 0), 0) / secondHalf.length
      : 0;

    const trend = secondHalfAvg > firstHalfAvg + 0.2 ? 'improving'
      : secondHalfAvg < firstHalfAvg - 0.2 ? 'declining'
      : 'stable';

    // Calculate response rate
    const sentSurveys = await CSATSurveyModel.countDocuments({
      sentAt: { $gte: start, $lte: end }
    });
    const responseRate = sentSurveys > 0 ? (totalResponses / sentSurveys) * 100 : 0;

    return {
      period: { start, end },
      totalResponses,
      responseRate: Math.round(responseRate),
      overallCSAT: Math.round(overallCSAT * 10) / 10,
      nps,
      ces: Math.round(ces * 10) / 10,
      byChannel,
      byAgent,
      byCategory: {},
      trend,
      lowScoreCount: responses.filter(r => r.overallRating && r.overallRating <= 2).length,
      averageResolutionTime: 0 // Would need to join with ticket data
    };
  }

  /**
   * Process pending surveys (called by cron)
   */
  async processPendingSurveys(): Promise<void> {
    await this.connect();

    // Find expired surveys
    const expiredSurveys = await CSATSurveyModel.find({
      status: 'sent',
      expiresAt: { $lt: new Date() }
    });

    for (const survey of expiredSurveys) {
      survey.status = 'expired';
      await survey.save();
      logger.info('Survey expired', { ticketId: survey.ticketId });
    }

    // Re-send failed surveys (3 days since sent, still pending response)
    const staleSurveys = await CSATSurveyModel.find({
      status: 'sent',
      sentAt: { $lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
    });

    for (const survey of staleSurveys) {
      await this.sendSurveyNotification(survey, {});
      logger.info('Re-sent stale survey', { ticketId: survey.ticketId });
    }
  }

  /**
   * Trigger survey when ticket is resolved
   */
  async triggerSurvey(params: {
    ticketId: string;
    customerId: string;
    agentId?: string;
    resolutionTime?: number;
    channel?: 'whatsapp' | 'sms' | 'email' | 'inapp';
  }): Promise<void> {
    const survey = await this.sendSurvey({
      ticketId: params.ticketId,
      customerId: params.customerId,
      channel: params.channel
    });

    // Update metadata using updateOne
    await CSATSurveyModel.updateOne(
      { ticketId: params.ticketId },
      {
        $set: {
          agentId: params.agentId,
          resolutionTime: params.resolutionTime
        }
      }
    );
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async sendSurveyNotification(
    survey: any,
    customer: { phone?: string; email?: string }
  ): Promise<void> {
    const messages: Record<string, { title: string; body: string }> = {
      whatsapp: {
        title: 'Rate Your Experience',
        body: `Hi! How was your experience with our support? Please take a moment to rate us: https://rezapp.com/csat/${survey.ticketId}`
      },
      sms: {
        title: 'Rate Your Experience',
        body: `Hi! How was your support experience? Rate us: https://rezapp.com/csat/${survey.ticketId}`
      },
      email: {
        title: 'How was your support experience?',
        body: `Please take a moment to rate your recent support interaction. Your feedback helps us serve you better.`
      },
      inapp: {
        title: 'Rate Your Experience',
        body: 'How was your support experience?'
      }
    };

    const message = messages[survey.channel] || messages.whatsapp;

    try {
      await axios.post(
        `${NOTIFICATIONS_URL}/api/notifications/send`,
        {
          userId: survey.customerId,
          type: 'csat_survey',
          channel: survey.channel,
          title: message.title,
          body: message.body,
          data: { ticketId: survey.ticketId }
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to send survey notification', error);
    }
  }

  private async sendThankYouNotification(customerId: string, channel: string): Promise<void> {
    try {
      await axios.post(
        `${NOTIFICATIONS_URL}/api/notifications/send`,
        {
          userId: customerId,
          type: 'csat_thankyou',
          channel,
          title: 'Thank You! 🎉',
          body: 'Thank you for your positive feedback! As a token of appreciation, we\'ve credited 5 NC to your wallet.'
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );

      // Credit wallet
      await axios.post(
        `${process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com'}/api/wallet/credit`,
        {
          userId: customerId,
          amount: 5,
          reason: 'csat_thankyou',
          type: 'credit'
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to send thank you', error);
    }
  }

  private async triggerLowRatingAlert(
    ticketId: string,
    customerId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    // Create high-priority ticket for follow-up
    try {
      await axios.post(
        `${process.env.SUPPORT_SERVICE_URL || 'https://rez-support-dashboard.onrender.com'}/api/tickets`,
        {
          type: 'csat_followup',
          customerId,
          subject: `Low CSAT Rating: ${rating}/5`,
          description: `Customer gave ${rating}/5 rating. Feedback: ${feedback || 'No feedback provided'}`,
          priority: 'high',
          ticketId: `followup_${ticketId}`
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to create low rating alert', error);
    }
  }

  private async updateCustomerSentiment(customerId: string, sentiment: string): Promise<void> {
    try {
      await axios.post(
        `${process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com'}/api/profile/update-sentiment`,
        { customerId, sentiment },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to update customer sentiment', error);
    }
  }
}
