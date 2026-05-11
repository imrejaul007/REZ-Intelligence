/**
 * REZ Connector for AdBazaar
 *
 * Drop-in replacement for existing AdBazaar integration.
 * Add to: /services/REZConnector.js
 */

const { REZIntegration, EVENT_TYPES } = require('@rez/integration-sdk');

class REZAdBazaarConnector extends REZIntegration {
  constructor(config = {}) {
    super({
      appId: 'adBazaar',
      ...config
    });
  }

  /**
   * Track campaign created
   */
  async trackCampaignCreated(campaign) {
    return this.events.track(EVENT_TYPES.CUSTOM, {
      campaignId: campaign.id,
      merchantId: campaign.merchantId,
      type: 'campaign_created',
      budget: campaign.budget,
      targeting: campaign.targeting
    });
  }

  /**
   * Track ad impression
   */
  async trackAdImpression(impression) {
    return this.events.track(EVENT_TYPES.AD_IMPRESSION, {
      adId: impression.adId,
      campaignId: impression.campaignId,
      placement: impression.placement,
      userId: impression.userId,
      creativeType: impression.creativeType
    });
  }

  /**
   * Track ad click
   */
  async trackAdClick(click) {
    return this.events.track(EVENT_TYPES.AD_CLICK, {
      adId: click.adId,
      campaignId: click.campaignId,
      userId: click.userId,
      placement: click.placement
    });
  }

  /**
   * Track ad conversion
   */
  async trackAdConversion(conversion) {
    return this.events.track(EVENT_TYPES.AD_CONVERSION, {
      adId: conversion.adId,
      campaignId: conversion.campaignId,
      orderId: conversion.orderId,
      amount: conversion.amount,
      attribution: conversion.attribution
    });
  }

  /**
   * Track creator signup
   */
  async trackCreatorSignup(creator) {
    return this.events.track(EVENT_TYPES.SIGNUP, {
      creatorId: creator.id,
      platform: creator.platform,
      followers: creator.followers
    });
  }

  /**
   * Track creator content posted
   */
  async trackContentPosted(content) {
    return this.events.track(EVENT_TYPES.CUSTOM, {
      contentId: content.id,
      creatorId: content.creatorId,
      platform: content.platform,
      type: 'content_posted',
      engagement: content.engagement
    });
  }

  /**
   * Track creator earnings
   */
  async trackCreatorEarnings(earnings) {
    return this.events.track(EVENT_TYPES.CUSTOM, {
      creatorId: earnings.creatorId,
      campaignId: earnings.campaignId,
      type: 'creator_earnings',
      amount: earnings.amount
    });
  }

  /**
   * Get ad targeting recommendations
   */
  async getAdTargetingRecommendations(merchantId, options = {}) {
    // Get recommendations for ad targeting
    const recs = await this.recommendations.get(merchantId, {
      types: ['personalized'],
      context: 'ad_targeting',
      limit: 20
    });
    return recs;
  }

  /**
   * Get creator recommendations for campaign
   */
  async getCreatorRecommendations(campaignId, options = {}) {
    // This would call REZ-creator-network
    return this._request('GET', `/api/creators/recommend?campaignId=${campaignId}`);
  }

  /**
   * Send conversion feedback to attribution system
   */
  async sendConversionFeedback(attributionData) {
    return this.feedback.conversion(attributionData.campaignId, {
      converted: true,
      orderId: attributionData.orderId,
      amount: attributionData.amount,
      metadata: {
        adId: attributionData.adId,
        creatorId: attributionData.creatorId
      }
    });
  }
}

// Express middleware
function rezMiddleware(req, res, next) {
  req.rez = new REZAdBazaarConnector({
    baseUrl: process.env.REZ_API_URL,
    apiKey: process.env.REZ_API_KEY
  });

  if (req.merchant) {
    req.rez.init({
      userId: req.merchant.id,
      metadata: { type: 'merchant' }
    });
  }

  next();
}

module.exports = { REZAdBazaarConnector, rezMiddleware };
