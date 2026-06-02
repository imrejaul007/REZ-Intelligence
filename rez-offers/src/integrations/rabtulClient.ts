/**
 * RABTUL Service Client
 * Auto-generated integration client
 */

import axios from 'axios';

// RABTUL Service URLs from environment
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:4004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4016';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';

// Internal token for service-to-service calls
const getInternalHeaders = () => ({
  'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
  'Content-Type': 'application/json'
});

/**
 * Verify JWT token with RABTUL Auth
 */
export async function verifyToken(token) {
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`,
      { token },
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    throw error;
  }
}

/**
 * Process payment via RABTUL Payment
 */
export async function processPayment(paymentData) {
  try {
    const response = await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/create`,
      paymentData,
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Payment failed:', error.message);
    throw error;
  }
}

/**
 * Add coins to wallet via RABTUL Wallet
 */
export async function addCoins(userId, amount, reason) {
  try {
    const response = await axios.post(`${WALLET_SERVICE_URL}/api/coins/credit`,
      { userId, amount, reason },
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Wallet credit failed:', error.message);
    throw error;
  }
}

/**
 * Send notification via RABTUL Notifications
 */
export async function sendNotification(userId, notification) {
  try {
    const response = await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications/send`,
      { userId, ...notification },
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Notification failed:', error.message);
    throw error;
  }
}

/**
 * Track event via REZ Event Bus
 */
export async function trackEvent(eventType, eventData) {
  try {
    const response = await axios.post(`${EVENT_BUS_URL}/api/events`,
      { type: eventType, data: eventData },
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Event tracking failed:', error.message);
    throw error;
  }
}

/**
 * Get predictions from REZ Intelligence
 */
export async function getPredictions(userId, features) {
  try {
    const response = await axios.post(
      process.env.INTENT_SERVICE_URL || 'http://localhost:4018' + '/api/predict',
      { userId, features },
      { headers: getInternalHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Prediction failed:', error.message);
    throw error;
  }
}

export default {
  verifyToken,
  processPayment,
  addCoins,
  sendNotification,
  trackEvent,
  getPredictions
};
