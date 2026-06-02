const twilio = require('twilio');
const BaseProvider = require('./base');
const logger = require('../utils/logger');

class SMSProvider extends BaseProvider {
  constructor(config) {
    super('sms', config);
    this.client = null;
  }

  async _init() {
    if (!this.config.accountSid || !this.config.authToken) {
      logger.warn('SMS: Missing Twilio configuration, provider will be disabled');
      return;
    }

    try {
      this.client = twilio(this.config.accountSid, this.config.authToken);
      logger.info('SMS provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SMS provider:', error);
      throw error;
    }
  }

  async send(notification, user, content) {
    if (!this.client) {
      return this.formatResult(false, null, { message: 'SMS provider not initialized' });
    }

    if (!user.phone) {
      return this.formatResult(false, null, { message: 'User has no phone number' });
    }

    const { body, maxLength } = content;
    let messageBody = body;

    if (maxLength && body.length > maxLength) {
      messageBody = body.substring(0, maxLength - 3) + '...';
    }

    try {
      const message = await this.client.messages.create({
        body: messageBody,
        from: this.config.phoneNumber,
        to: user.phone,
        statusCallback: `${process.env.API_BASE_URL || 'http://localhost:4013'}/webhooks/sms/status`,
      });

      logger.info(`SMS: Message sent successfully to user ${user.userId}`, {
        messageId: message.sid,
        notificationId: notification.notificationId,
      });

      return this.formatResult(true, message.sid);
    } catch (error) {
      logger.error(`SMS: Failed to send message to user ${user.userId}:`, error);

      const retryable = error.code === 21610 ||
                        error.code === 21408 ||
                        error.code === 20429;

      return this.formatResult(false, null, {
        code: error.code,
        message: error.message,
        retryable,
      });
    }
  }

  async sendMultiple(notification, users, content) {
    if (!this.client) {
      return this.formatResult(false, null, { message: 'SMS provider not initialized' });
    }

    const usersWithPhone = users.filter(u => u.phone);
    if (usersWithPhone.length === 0) {
      return this.formatResult(false, null, { message: 'No users with phone numbers found' });
    }

    const { body, maxLength } = content;
    let messageBody = body;

    if (maxLength && body.length > maxLength) {
      messageBody = body.substring(0, maxLength - 3) + '...';
    }

    const results = [];
    for (const user of usersWithPhone) {
      try {
        const message = await this.client.messages.create({
          body: messageBody,
          from: this.config.phoneNumber,
          to: user.phone,
        });
        results.push({ success: true, userId: user.userId, messageId: message.sid });
      } catch (error) {
        results.push({ success: false, userId: user.userId, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`SMS: Bulk send completed to ${usersWithPhone.length} users`, {
      successCount,
      failureCount: usersWithPhone.length - successCount,
      notificationId: notification.notificationId,
    });

    return this.formatResult(true, results);
  }

  async validateConfig() {
    return !!(this.config.accountSid && this.config.authToken && this.config.phoneNumber);
  }

  async shutdown() {
    this.client = null;
    this.isInitialized = false;
  }
}

const smsProvider = new SMSProvider(require('../config').twilio);

module.exports = smsProvider;
