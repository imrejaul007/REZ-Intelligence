const twilio = require('twilio');
const BaseProvider = require('./base');
const logger = require('../utils/logger');

class WhatsAppProvider extends BaseProvider {
  constructor(config) {
    super('whatsapp', config);
    this.client = null;
    this.templates = new Map();
  }

  async _init() {
    if (!this.config.accountSid || !this.config.authToken) {
      logger.warn('WhatsApp: Missing Twilio configuration, provider will be disabled');
      return;
    }

    try {
      this.client = twilio(this.config.accountSid, this.config.authToken);

      this.templates = new Map([
        ['order_confirmation', 'rez_order_confirmation'],
        ['delivery_update', 'rez_delivery_update'],
        ['promotional', 'rez_promotional'],
        ['custom', 'rez_custom'],
      ]);

      logger.info('WhatsApp provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp provider:', error);
      throw error;
    }
  }

  async send(notification, user, content) {
    if (!this.client) {
      return this.formatResult(false, null, { message: 'WhatsApp provider not initialized' });
    }

    if (!user.whatsappNumber) {
      return this.formatResult(false, null, { message: 'User has no WhatsApp number' });
    }

    const {
      body,
      templateName,
      headerType,
      headerContent,
      footerText,
      buttons,
    } = content;

    try {
      let messageContent;

      if (templateName && this.isTemplateMessage(templateName)) {
        messageContent = await this.buildTemplateMessage(
          templateName,
          body,
          headerType,
          headerContent,
          footerText,
          buttons
        );
      } else {
        messageContent = {
          contentSid: this.templates.get('custom'),
          variables: {
            '1': body,
          },
        };
      }

      const message = await this.client.messages.create({
        from: this.config.from,
        to: `whatsapp:${user.whatsappNumber}`,
        ...messageContent,
      });

      logger.info(`WhatsApp: Message sent successfully to user ${user.userId}`, {
        messageId: message.sid,
        notificationId: notification.notificationId,
      });

      return this.formatResult(true, message.sid);
    } catch (error) {
      logger.error(`WhatsApp: Failed to send message to user ${user.userId}:`, error);

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

  isTemplateMessage(templateName) {
    return this.templates.has(templateName);
  }

  async buildTemplateMessage(templateName, body, headerType, headerContent, footerText, buttons) {
    const templateSid = this.templates.get(templateName) || this.templates.get('custom');

    const message = {
      contentSid: templateSid,
      variables: {},
    };

    let varIndex = 1;

    if (headerType === 'text' && headerContent) {
      message.variables[varIndex.toString()] = headerContent;
      varIndex++;
    }

    message.variables[varIndex.toString()] = body;
    varIndex++;

    if (footerText) {
      message.variables[varIndex.toString()] = footerText;
      varIndex++;
    }

    if (buttons && buttons.length > 0) {
      const formattedButtons = buttons.map(btn => ({
        type: btn.type || 'quick_reply',
        copy: {
          text: btn.text.substring(0, 25),
        },
      }));

      message.ctavariables = {};
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        if (btn.type === 'url' && btn.url) {
          message.ctavariables[(varIndex + i).toString()] = {
            '0': {
              type: 'url',
              url: btn.url,
            },
          };
        } else if (btn.type === 'phone' && btn.phone) {
          message.ctavariables[(varIndex + i).toString()] = {
            '0': {
              type: 'phone_number',
              phone_number: btn.phone,
            },
          };
        }
      }
    }

    return message;
  }

  async sendMultiple(notification, users, content) {
    if (!this.client) {
      return this.formatResult(false, null, { message: 'WhatsApp provider not initialized' });
    }

    const usersWithWhatsApp = users.filter(u => u.whatsappNumber);
    if (usersWithWhatsApp.length === 0) {
      return this.formatResult(false, null, { message: 'No users with WhatsApp numbers found' });
    }

    const results = [];
    for (const user of usersWithWhatsApp) {
      const result = await this.send(notification, user, content);
      results.push({
        success: result.success,
        userId: user.userId,
        messageId: result.messageId,
        error: result.error,
      });
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`WhatsApp: Bulk send completed to ${usersWithWhatsApp.length} users`, {
      successCount,
      failureCount: usersWithWhatsApp.length - successCount,
      notificationId: notification.notificationId,
    });

    return this.formatResult(true, results);
  }

  registerTemplate(name, templateId) {
    this.templates.set(name, templateId);
    logger.info(`WhatsApp: Registered template '${name}' with SID: ${templateId}`);
  }

  async validateConfig() {
    return !!(this.config.accountSid && this.config.authToken && this.config.from);
  }

  async shutdown() {
    this.client = null;
    this.subscribers.clear();
    this.isInitialized = false;
  }
}

const whatsappProvider = new WhatsAppProvider({
  ...require('../config').twilio,
  from: require('../config').whatsapp.from,
});

module.exports = whatsappProvider;
