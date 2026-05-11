/**
 * REZ Connector for Rendez
 *
 * Drop-in replacement for existing Rendez integration.
 * Add to: /services/REZConnector.js
 */

const { REZIntegration } = require('@rez/integration-sdk');

class REZRendezConnector extends REZIntegration {
  constructor(config = {}) {
    super({
      appId: 'Rendez',
      ...config
    });
  }

  /**
   * Track profile view
   */
  async trackProfileView(profile) {
    return this.events.track('profile_view', {
      viewedUserId: profile.id,
      matched: profile.isMatched
    });
  }

  /**
   * Track match made
   */
  async trackMatch(match) {
    return this.events.track('match_made', {
      matchId: match.id,
      matchedUserId: match.userId,
      matchType: match.type, // 'super_like', 'like', 'boost'
      mutual: match.mutual
    });
  }

  /**
   * Track message sent
   */
  async trackMessage(message) {
    return this.events.track('message_sent', {
      matchId: message.matchId,
      recipientId: message.recipientId,
      messageType: message.type // 'text', 'voice', 'gift'
    });
  }

  /**
   * Track meetup scheduled
   */
  async trackMeetupScheduled(meetup) {
    return this.events.track('meetup_scheduled', {
      meetupId: meetup.id,
      placeId: meetup.placeId,
      placeName: meetup.placeName,
      time: meetup.time
    });
  }

  /**
   * Track meetup completed
   */
  async trackMeetupCompleted(meetup) {
    return this.events.track('meetup_completed', {
      meetupId: meetup.id,
      rating: meetup.rating,
      feedback: meetup.feedback
    });
  }

  /**
   * Track gift sent
   */
  async trackGiftSent(gift) {
    return this.events.track('gift_sent', {
      giftId: gift.id,
      recipientId: gift.recipientId,
      giftType: gift.type,
      amount: gift.amount
    });
  }

  /**
   * Track subscription upgrade
   */
  async trackSubscription(sub) {
    return this.events.track('subscription_upgrade', {
      plan: sub.plan,
      duration: sub.duration,
      amount: sub.amount
    });
  }

  /**
   * Track search
   */
  async trackSearch(search) {
    return this.events.search({
      query: search.query,
      results: search.resultCount,
      filters: search.filters
    });
  }

  /**
   * Get matchmaking recommendations
   */
  async getMatchRecommendations(userId, options = {}) {
    return this.recommendations.get(userId, {
      types: ['personalized', 'for_you'],
      context: 'dating',
      ...options
    });
  }

  /**
   * Get place recommendations for meetup
   */
  async getPlaceRecommendations(userId, options = {}) {
    return this.recommendations.get(userId, {
      types: ['nearby', 'personalized'],
      context: 'meetup',
      ...options
    });
  }
}

// Express middleware
function rezMiddleware(req, res, next) {
  req.rez = new REZRendezConnector({
    baseUrl: process.env.REZ_API_URL,
    apiKey: process.env.REZ_API_KEY
  });

  if (req.user) {
    req.rez.init({
      userId: req.user.id,
      phone: req.user.phone
    });
  }

  next();
}

module.exports = { REZRendezConnector, rezMiddleware };
