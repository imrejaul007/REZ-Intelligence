/**
 * REZ Connector for Hotel-OTA
 *
 * Drop-in replacement for existing Hotel-OTA integration.
 * Add to: /services/REZConnector.js
 */

const { REZIntegration } = require('@rez/integration-sdk');

class REZHotelConnector extends REZIntegration {
  constructor(config = {}) {
    super({
      appId: 'Hotel-OTA',
      ...config
    });
  }

  /**
   * Track booking started
   */
  async trackBookingStarted(booking) {
    return this.events.track('booking_started', {
      bookingId: booking.id,
      hotelId: booking.hotelId,
      checkin: booking.checkin,
      checkout: booking.checkout,
      guests: booking.guests,
      amount: booking.total
    });
  }

  /**
   * Track booking confirmed
   */
  async trackBookingConfirmed(booking) {
    return this.events.track('booking_confirmed', {
      bookingId: booking.id,
      hotelId: booking.hotelId,
      paymentMethod: booking.paymentMethod,
      amount: booking.total
    });
  }

  /**
   * Track checkin
   */
  async trackCheckin(booking) {
    return this.events.track('checkin', {
      bookingId: booking.id,
      hotelId: booking.hotelId,
      roomId: booking.roomId
    });
  }

  /**
   * Track checkout
   */
  async trackCheckout(booking) {
    return this.events.track('checkout', {
      bookingId: booking.id,
      hotelId: booking.hotelId,
      roomService: booking.roomServiceTotal,
      extras: booking.extrasTotal
    });
  }

  /**
   * Track room service order
   */
  async trackRoomServiceOrder(order) {
    return this.events.track('order_completed', {
      orderId: order.id,
      bookingId: order.bookingId,
      items: order.items,
      amount: order.total
    });
  }

  /**
   * Track search
   */
  async trackSearch(search) {
    return this.events.search({
      query: search.query,
      results: search.resultCount,
      location: search.location,
      dates: search.dates
    });
  }

  /**
   * Track hotel view
   */
  async trackHotelView(hotel) {
    return this.events.pageView({
      page: `/hotel/${hotel.id}`,
      category: 'hotel',
      merchantId: hotel.id,
      metadata: {
        name: hotel.name,
        rating: hotel.rating,
        price: hotel.priceFrom
      }
    });
  }

  /**
   * Get hotel recommendations for user
   */
  async getHotelRecommendations(userId, options = {}) {
    return this.recommendations.get(userId, {
      types: ['personalized', 'nearby', 'trending'],
      context: 'hotel_booking',
      ...options
    });
  }

  /**
   * Get room service recommendations
   */
  async getRoomServiceRecommendations(userId, options = {}) {
    return this.recommendations.get(userId, {
      types: ['cross_sell', 'personalized'],
      context: 'room_service',
      ...options
    });
  }
}

// Express middleware for Hotel-OTA
function rezMiddleware(req, res, next) {
  // Attach connector to request
  req.rez = new REZHotelConnector({
    baseUrl: process.env.REZ_API_URL,
    apiKey: process.env.REZ_API_KEY
  });

  // Initialize with user if authenticated
  if (req.user) {
    req.rez.init({
      userId: req.user.id,
      phone: req.user.phone,
      email: req.user.email
    });
  }

  next();
}

module.exports = { REZHotelConnector, rezMiddleware };
