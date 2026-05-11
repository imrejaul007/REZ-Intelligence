/**
 * REZ Connector for do-app
 *
 * Drop-in replacement for existing do-app integration.
 * Add to: /services/REZConnector.js
 */

const { REZIntegration } = require('@rez/integration-sdk');

class REZDoAppConnector extends REZIntegration {
  constructor(config = {}) {
    super({
      appId: 'do-app',
      ...config
    });
  }

  /**
   * Track activity viewed
   */
  async trackActivityView(activity) {
    return this.events.track('activity_view', {
      activityId: activity.id,
      category: activity.category,
      providerId: activity.providerId
    });
  }

  /**
   * Track booking started
   */
  async trackBookingStarted(booking) {
    return this.events.track('booking_started', {
      bookingId: booking.id,
      activityId: booking.activityId,
      date: booking.date,
      participants: booking.participants,
      amount: booking.total
    });
  }

  /**
   * Track booking confirmed
   */
  async trackBookingConfirmed(booking) {
    return this.events.track('booking_confirmed', {
      bookingId: booking.id,
      paymentMethod: booking.paymentMethod,
      amount: booking.total
    });
  }

  /**
   * Track experience completed
   */
  async trackExperienceCompleted(experience) {
    return this.events.track('experience_completed', {
      bookingId: experience.bookingId,
      rating: experience.rating,
      feedback: experience.feedback
    });
  }

  /**
   * Track provider signup
   */
  async trackProviderSignup(provider) {
    return this.events.track('signup', {
      type: 'provider',
      providerId: provider.id,
      category: provider.category
    });
  }

  /**
   * Track search
   */
  async trackSearch(search) {
    return this.events.search({
      query: search.query,
      category: search.category,
      location: search.location,
      results: search.resultCount
    });
  }

  /**
   * Get activity recommendations
   */
  async getActivityRecommendations(userId, options = {}) {
    return this.recommendations.get(userId, {
      types: ['personalized', 'trending', 'nearby'],
      context: 'do_activity',
      ...options
    });
  }

  /**
   * Get repeat booking suggestions
   */
  async getRepeatSuggestions(userId, options = {}) {
    return this.recommendations.getReorders(userId, {
      context: 'do_activity',
      ...options
    });
  }
}

// Express middleware
function rezMiddleware(req, res, next) {
  req.rez = new REZDoAppConnector({
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

module.exports = { REZDoAppConnector, rezMiddleware };
