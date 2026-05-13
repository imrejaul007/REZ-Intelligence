/**
 * DO App Integration with Agent OS
 *
 * Usage:
 * 1. npm install @rez/agent-os-sdk
 * 2. Import and use
 */

import { DOAppClient } from '@rez/agent-os-sdk';

const doApp = new DOAppClient({
  userId: 'user123',
  baseUrl: 'http://localhost:4100'
});

// Track booking
await doApp.trackBooking({
  bookingId: 'BK123',
  serviceType: 'salon',
  provider: 'provider_456',
  amount: 500
});

// Get recommendations
const recs = await doApp.getDORecommendations({
  location: { lat: 12.97, lng: 77.59 }
});

// Chat
const response = await doApp.chat('Book a massage near me');
