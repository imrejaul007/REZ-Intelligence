/**
 * HotelModule - Hotel/Stay Experience Tracking
 * Manages hotel bookings, preferences, and experiences
 */

import crypto from 'crypto';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';

export interface HotelBooking {
  booking_id: string;
  user_id: string;
  hotel_id: string;
  hotel_name: string;
  room_type: string;
  check_in: string;
  check_out: string;
  guests: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_amount: number;
  points_earned?: number;
  created_at: string;
}

export interface HotelPreference {
  preference_id: string;
  user_id: string;
  preference_type: 'room' | 'amenity' | 'dietary' | 'general';
  preference_key: string;
  preference_value: string;
  importance: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface StaySummary {
  total_stays: number;
  total_nights: number;
  total_spent: number;
  avg_rating: number;
  favorite_hotels: string[];
  last_stay: string;
}

export interface HotelReview {
  review_id: string;
  booking_id: string;
  hotel_id: string;
  rating: number;
  categories: Record<string, number>;
  comment?: string;
  created_at: string;
}

export class HotelModule {
  private consumerGraph: ConsumerGraph;
  private logger: winston.Logger;

  // Local storage
  private bookings: Map<string, HotelBooking[]>;
  private preferences: Map<string, HotelPreference[]>;
  private reviews: Map<string, HotelReview[]>;

  constructor(consumerGraph: ConsumerGraph) {
    this.consumerGraph = consumerGraph;
    this.bookings = new Map();
    this.preferences = new Map();
    this.reviews = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('HotelModule initialized');
  }

  // ============================================
  // BOOKINGS
  // ============================================

  /**
   * Create hotel booking
   */
  async createBooking(
    userId: string,
    booking: Omit<HotelBooking, 'booking_id' | 'user_id' | 'created_at' | 'status'>
  ): Promise<HotelBooking> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    const newBooking: HotelBooking = {
      ...booking,
      booking_id: `${crypto.randomUUID()}`,
      user_id: userId,
      status: 'confirmed',
      created_at: new Date().toISOString(),
    };

    if (!this.bookings.has(userId)) {
      this.bookings.set(userId, []);
    }
    this.bookings.get(userId)!.push(newBooking);

    // Calculate and add loyalty points
    const nights = this.calculateNights(booking.check_in, booking.check_out);
    const pointsEarned = Math.floor(booking.total_amount / 10); // 1 point per $10 spent
    newBooking.points_earned = pointsEarned;

    const loyaltyModule = this.consumerGraph.getLoyaltyModule();
    await loyaltyModule.earnPoints(
      userId,
      'hotel_booking',
      booking.total_amount,
      `Hotel booking at ${booking.hotel_name}`,
      { booking_id: newBooking.booking_id, nights }
    );

    this.logger.info('Hotel booking created', {
      userId,
      bookingId: newBooking.booking_id,
      hotelId: booking.hotel_id,
    });

    return newBooking;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    userId: string,
    bookingId: string,
    status: HotelBooking['status']
  ): Promise<boolean> {
    const userBookings = this.bookings.get(userId);
    if (!userBookings) return false;

    const booking = userBookings.find((b) => b.booking_id === bookingId);
    if (!booking) return false;

    booking.status = status;
    this.logger.info('Booking status updated', { userId, bookingId, status });
    return true;
  }

  /**
   * Get user bookings
   */
  async getBookings(
    userId: string,
    status?: HotelBooking['status'],
    limit: number = 20
  ): Promise<HotelBooking[]> {
    const userBookings = this.bookings.get(userId) || [];

    let filtered = userBookings;
    if (status) {
      filtered = userBookings.filter((b) => b.status === status);
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Get upcoming bookings
   */
  async getUpcomingBookings(userId: string): Promise<HotelBooking[]> {
    const now = new Date();
    const userBookings = this.bookings.get(userId) || [];

    return userBookings
      .filter(
        (b) =>
          new Date(b.check_in) >= now &&
          (b.status === 'confirmed' || b.status === 'checked_in')
      )
      .sort(
        (a, b) =>
          new Date(a.check_in).getTime() - new Date(b.check_in).getTime()
      );
  }

  /**
   * Get past bookings
   */
  async getPastBookings(userId: string, limit: number = 20): Promise<HotelBooking[]> {
    const now = new Date();
    const userBookings = this.bookings.get(userId) || [];

    return userBookings
      .filter((b) => new Date(b.check_out) < now || b.status === 'checked_out')
      .sort(
        (a, b) =>
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
      )
      .slice(0, limit);
  }

  // ============================================
  // PREFERENCES
  // ============================================

  /**
   * Set hotel preference
   */
  async setPreference(
    userId: string,
    preference: Omit<HotelPreference, 'preference_id' | 'user_id' | 'created_at'>
  ): Promise<HotelPreference> {
    const userPrefs = this.getPreferencesInternal(userId);

    // Check if preference exists
    const existingIndex = userPrefs.findIndex(
      (p) =>
        p.preference_type === preference.preference_type &&
        p.preference_key === preference.preference_key
    );

    if (existingIndex >= 0) {
      // Update existing
      userPrefs[existingIndex] = {
        ...preference,
        preference_id: userPrefs[existingIndex].preference_id,
        user_id: userId,
        created_at: userPrefs[existingIndex].created_at,
      };
      return userPrefs[existingIndex];
    }

    // Create new
    const newPref: HotelPreference = {
      ...preference,
      preference_id: `${crypto.randomUUID()}`,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    userPrefs.push(newPref);
    return newPref;
  }

  /**
   * Get user preferences
   */
  async getPreferences(
    userId: string,
    type?: HotelPreference['preference_type']
  ): Promise<HotelPreference[]> {
    const userPrefs = this.getPreferencesInternal(userId);

    if (type) {
      return userPrefs.filter((p) => p.preference_type === type);
    }

    return userPrefs;
  }

  private getPreferencesInternal(userId: string): HotelPreference[] {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, []);
    }
    return this.preferences.get(userId)!;
  }

  /**
   * Remove preference
   */
  async removePreference(userId: string, preferenceId: string): Promise<boolean> {
    const userPrefs = this.getPreferencesInternal(userId);
    const index = userPrefs.findIndex((p) => p.preference_id === preferenceId);

    if (index >= 0) {
      userPrefs.splice(index, 1);
      return true;
    }
    return false;
  }

  // ============================================
  // REVIEWS
  // ============================================

  /**
   * Add hotel review
   */
  async addReview(
    userId: string,
    bookingId: string,
    hotelId: string,
    rating: number,
    categories?: Record<string, number>,
    comment?: string
  ): Promise<HotelReview> {
    const review: HotelReview = {
      review_id: `${crypto.randomUUID()}`,
      booking_id: bookingId,
      hotel_id: hotelId,
      rating,
      categories: categories || {},
      comment,
      created_at: new Date().toISOString(),
    };

    if (!this.reviews.has(userId)) {
      this.reviews.set(userId, []);
    }
    this.reviews.get(userId)!.push(review);

    // Award bonus points for review
    const loyaltyModule = this.consumerGraph.getLoyaltyModule();
    await loyaltyModule.earnPoints(
      userId,
      'hotel_review',
      0,
      `Review for hotel`,
      { review_id: review.review_id, hotel_id: hotelId, rating }
    );

    this.logger.info('Hotel review added', { userId, bookingId, rating });
    return review;
  }

  /**
   * Get user reviews
   */
  async getReviews(userId: string): Promise<HotelReview[]> {
    return this.reviews.get(userId) || [];
  }

  // ============================================
  // SUMMARIES
  // ============================================

  /**
   * Get stay summary
   */
  async getStaySummary(userId: string): Promise<StaySummary> {
    const userBookings = this.bookings.get(userId) || [];
    const completedBookings = userBookings.filter(
      (b) => b.status === 'checked_out'
    );

    let totalNights = 0;
    let totalSpent = 0;
    const hotelCounts: Record<string, number> = {};
    const ratings: number[] = [];

    for (const booking of completedBookings) {
      totalNights += this.calculateNights(booking.check_in, booking.check_out);
      totalSpent += booking.total_amount;
      hotelCounts[booking.hotel_name] = (hotelCounts[booking.hotel_name] || 0) + 1;
    }

    // Get ratings
    const userReviews = this.reviews.get(userId) || [];
    for (const review of userReviews) {
      ratings.push(review.rating);
    }

    // Sort hotels by frequency
    const favoriteHotels = Object.entries(hotelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const lastStay =
      completedBookings.length > 0
        ? completedBookings.sort(
            (a, b) =>
              new Date(b.check_out).getTime() - new Date(a.check_out).getTime()
          )[0].check_out
        : '';

    return {
      total_stays: completedBookings.length,
      total_nights: totalNights,
      total_spent: totalSpent,
      avg_rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      favorite_hotels: favoriteHotels,
      last_stay: lastStay,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private calculateNights(checkIn: string, checkOut: string): number {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diff = checkOutDate.getTime() - checkInDate.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get stay frequency
   */
  async getStayFrequency(userId: string): Promise<'occasional' | 'regular' | 'frequent'> {
    const summary = await this.getStaySummary(userId);

    if (summary.total_stays === 0) return 'occasional';
    if (summary.total_stays >= 12) return 'frequent';
    return 'regular';
  }
}
