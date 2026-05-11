/**
 * Booking Agent - Autonomous agent for handling voice bookings
 * Supports: Tables, Appointments, Classes
 */

const axios = require('axios');

const REZ_BOOKING_SERVICE_URL = process.env.REZ_BOOKING_SERVICE_URL || 'http://localhost:4013';

class BookingAgent {
  constructor() {
    this.name = 'BookingAgent';
    this.bookingTypes = ['table', 'appointment', 'class'];
  }

  /**
   * Handle booking intent from voice
   */
  async handle(intent, entities, context) {
    console.log(`[${this.name}] Handling booking intent:`, intent);

    const bookingType = this.detectBookingType(intent, entities, context);

    switch (intent) {
      case 'restaurant_reserve':
      case 'book_slot':
        return await this.createBooking(bookingType, entities, context);
      case 'reschedule':
        return await this.rescheduleBooking(bookingType, entities, context);
      default:
        return this.unknownBookingAction();
    }
  }

  /**
   * Detect booking type from context
   */
  detectBookingType(intent, entities, context) {
    // Check entities first
    if (entities.bookingType) {
      return entities.bookingType;
    }

    // Check intent
    if (intent.includes('restaurant') || intent.includes('table')) {
      return 'table';
    }

    if (intent.includes('class')) {
      return 'class';
    }

    // Check context
    if (context.vertical === 'salon') {
      return 'appointment';
    }

    if (context.vertical === 'fitness') {
      return 'class';
    }

    if (context.vertical === 'restaurant') {
      return 'table';
    }

    return 'appointment';
  }

  /**
   * Create a booking
   */
  async createBooking(type, entities, context) {
    try {
      const bookingData = this.buildBookingData(type, entities, context);

      const response = await axios.post(
        `${REZ_BOOKING_SERVICE_URL}/api/bookings`,
        bookingData
      );

      const confirmation = response.data;
      const confirmationMessage = this.getConfirmationMessage(type, confirmation);

      return {
        action: 'CREATE_BOOKING',
        success: true,
        bookingId: confirmation.bookingId,
        bookingType: type,
        message: confirmationMessage,
        data: confirmation
      };
    } catch (error) {
      console.error(`[${this.name}] Booking failed:`, error.message);
      return {
        action: 'CREATE_BOOKING',
        success: false,
        message: "I couldn't complete your booking. Let me connect you to our team."
      };
    }
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(type, entities, context) {
    try {
      const bookingId = entities.bookingId || context.lastBookingId;

      if (!bookingId) {
        return {
          action: 'RESCHEDULE_BOOKING',
          success: false,
          message: "I need your booking reference. Could you provide it?"
        };
      }

      const response = await axios.put(
        `${REZ_BOOKING_SERVICE_URL}/api/bookings/${bookingId}`,
        {
          date: entities.date,
          time: entities.time,
          source: 'voice'
        }
      );

      return {
        action: 'RESCHEDULE_BOOKING',
        success: true,
        bookingId,
        message: `Your ${type} has been rescheduled to ${entities.date || 'the new time'}.`,
        data: response.data
      };
    } catch (error) {
      console.error(`[${this.name}] Reschedule failed:`, error.message);
      return {
        action: 'RESCHEDULE_BOOKING',
        success: false,
        message: "I couldn't reschedule your booking. Let me connect you to support."
      };
    }
  }

  /**
   * Build booking data from entities
   */
  buildBookingData(type, entities, context) {
    const baseData = {
      userId: context.userId,
      storeId: context.storeId,
      source: 'voice',
      metadata: {
        channel: 'voice',
        confidence: context.confidence
      }
    };

    switch (type) {
      case 'table':
        return {
          ...baseData,
          type: 'table',
          guestCount: entities.number || 2,
          date: entities.date || new Date(),
          time: entities.time || '19:00',
          name: context.customerName,
          phone: context.phone
        };

      case 'appointment':
        return {
          ...baseData,
          type: 'appointment',
          serviceId: entities.serviceId,
          staffId: entities.stylistId,
          date: entities.date || new Date(),
          time: entities.time || '10:00',
          customerId: context.customerId,
          customerName: context.customerName,
          customerPhone: context.phone
        };

      case 'class':
        return {
          ...baseData,
          type: 'class',
          classId: entities.classId,
          date: entities.date || new Date(),
          memberId: context.memberId
        };

      default:
        return baseData;
    }
  }

  /**
   * Get confirmation message
   */
  getConfirmationMessage(type, booking) {
    const messages = {
      'table': `Your table is booked for ${booking.guestCount} guests on ${booking.date} at ${booking.time}. Booking ID: ${booking.bookingId}.`,
      'appointment': `Your appointment is scheduled for ${booking.date} at ${booking.time}. We'll send you a reminder.`,
      'class': `You're booked for the class on ${booking.date}. See you there!`
    };

    return messages[type] || `Booking confirmed! ID: ${booking.bookingId}`;
  }

  /**
   * Unknown booking action
   */
  unknownBookingAction() {
    return {
      action: 'UNKNOWN_BOOKING',
      success: false,
      message: "I'm not sure what you'd like to book. Could you please specify?"
    };
  }
}

module.exports = new BookingAgent();
