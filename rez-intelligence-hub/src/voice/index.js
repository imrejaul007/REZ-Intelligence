/**
 * Voice Module Index
 * Exports all voice services and routes
 */

const twilioWebhook = require('./webhooks/twilioWebhook');
const dailyWebhook = require('./webhooks/dailyWebhook');
const sttService = require('./services/stt');
const ttsService = require('./services/tts');
const voiceClassifier = require('./services/voiceRouter');
const swarmOrchestrator = require('./agents/swarmOrchestrator');

module.exports = {
  // Webhooks
  twilioWebhook,
  dailyWebhook,

  // Services
  stt: sttService,
  tts: ttsService,
  voiceClassifier,

  // Agents
  orchestrator: swarmOrchestrator,

  // Individual agents
  orderAgent: require('./agents/orderAgent'),
  bookingAgent: require('./agents/bookingAgent'),
  supportAgent: require('./agents/supportAgent'),
  nluAgent: require('./agents/nluAgent')
};
