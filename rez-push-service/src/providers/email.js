const sgMail = require('@sendgrid/mail');
const BaseProvider = require('./base');
const logger = require('../utils/logger');

class EmailProvider extends BaseProvider {
  constructor(config) {
    super('email', config);
    this.isInitialized = false;
  }

  async _init() {
    if (!this.config.apiKey) {
      logger.warn('Email: Missing SendGrid API key, provider will be disabled');
      return;
    }

    try {
      sgMail.setApiKey(this.config.apiKey);
      this.isInitialized = true;
      logger.info('Email provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Email provider:', error);
      throw error;
    }
  }

  async send(notification, user, content) {
    if (!this.isInitialized) {
      return this.formatResult(false, null, { message: 'Email provider not initialized' });
    }

    if (!user.email) {
      return this.formatResult(false, null, { message: 'User has no email address' });
    }

    const { subject, htmlBody, textBody, fromName } = content;

    const msg = {
      to: user.email,
      from: {
        email: this.config.fromEmail,
        name: fromName || this.config.fromName,
      },
      subject: subject || 'Message from ReZ App',
      text: textBody || this.stripHtml(htmlBody),
      html: htmlBody || textBody,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
      customArgs: {
        notificationId: notification.notificationId,
        userId: notification.userId,
        category: notification.category,
      },
    };

    try {
      const [response] = await sgMail.send(msg);

      logger.info(`Email: Message sent successfully to user ${user.userId}`, {
        messageId: response.headers['x-message-id'],
        notificationId: notification.notificationId,
      });

      return this.formatResult(true, response.headers['x-message-id']);
    } catch (error) {
      logger.error(`Email: Failed to send message to user ${user.userId}:`, error);

      const retryable = error.code === 429 ||
                        (error.response && error.response.body &&
                         error.response.body.errors?.some(e => e.code === 'try_from_later'));

      return this.formatResult(false, null, {
        code: error.code,
        message: error.message,
        details: error.response?.body,
        retryable,
      });
    }
  }

  async sendMultiple(notification, users, content) {
    if (!this.isInitialized) {
      return this.formatResult(false, null, { message: 'Email provider not initialized' });
    }

    const usersWithEmail = users.filter(u => u.email);
    if (usersWithEmail.length === 0) {
      return this.formatResult(false, null, { message: 'No users with email addresses found' });
    }

    const { subject, htmlBody, textBody, fromName } = content;

    const messages = usersWithEmail.map(user => ({
      to: user.email,
      from: {
        email: this.config.fromEmail,
        name: fromName || this.config.fromName,
      },
      subject: subject || 'Message from ReZ App',
      text: textBody || this.stripHtml(htmlBody),
      html: htmlBody || textBody,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
      customArgs: {
        notificationId: notification.notificationId,
        userId: user.userId,
        category: notification.category,
      },
    }));

    try {
      const response = await sgMail.send(messages);

      const messageIds = response.map(r => r[0]?.headers?.['x-message-id']).filter(Boolean);

      logger.info(`Email: Bulk send completed to ${usersWithEmail.length} users`, {
        successCount: messages.length,
        notificationId: notification.notificationId,
      });

      return this.formatResult(true, messageIds);
    } catch (error) {
      logger.error('Email: Failed to send bulk emails:', error);
      return this.formatResult(false, null, {
        code: error.code,
        message: error.message,
        details: error.response?.body,
      });
    }
  }

  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  async validateConfig() {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  async shutdown() {
    this.isInitialized = false;
  }
}

const emailProvider = new EmailProvider(require('../config').sendgrid);

module.exports = emailProvider;
