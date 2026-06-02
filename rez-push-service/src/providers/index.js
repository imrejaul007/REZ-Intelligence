const fcmProvider = require('./fcm');
const apnsProvider = require('./apns');
const smsProvider = require('./sms');
const emailProvider = require('./email');
const inAppProvider = require('./inapp');
const whatsappProvider = require('./whatsapp');

const providers = {
  fcm: fcmProvider,
  apns: apnsProvider,
  sms: smsProvider,
  email: emailProvider,
  inapp: inAppProvider,
  whatsapp: whatsappProvider,
};

async function initializeAllProviders() {
  const results = {};

  for (const [name, provider] of Object.entries(providers)) {
    try {
      await provider.initialize();
      const isValid = await provider.validateConfig();
      results[name] = {
        initialized: provider.isInitialized,
        configured: isValid,
        status: isValid ? 'active' : 'misconfigured',
      };
    } catch (error) {
      results[name] = {
        initialized: false,
        configured: false,
        status: 'error',
        error: error.message,
      };
    }
  }

  return results;
}

async function shutdownAllProviders() {
  const results = {};

  for (const [name, provider] of Object.entries(providers)) {
    try {
      await provider.shutdown();
      results[name] = { shutdown: true };
    } catch (error) {
      results[name] = { shutdown: false, error: error.message };
    }
  }

  return results;
}

function getProvider(channel) {
  return providers[channel.toLowerCase()];
}

function getAllProviders() {
  return { ...providers };
}

module.exports = {
  providers,
  initializeAllProviders,
  shutdownAllProviders,
  getProvider,
  getAllProviders,
};
