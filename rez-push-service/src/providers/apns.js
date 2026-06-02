const apn = require('apn');
const fs = require('fs/promises');
const BaseProvider = require('./base');
const logger = require('../utils/logger');

class APNsProvider extends BaseProvider {
  constructor(config) {
    super('apns', config);
    this.provider = null;
  }

  async _init() {
    if (!this.config.keyId || !this.config.teamId || !this.config.bundleId) {
      logger.warn('APNs: Missing configuration, provider will be disabled');
      return;
    }

    try {
      let key = undefined;
      if (this.config.keyPath) {
        key = await fs.readFile(this.config.keyPath);
      }

      const options = {
        token: {
          key,
          keyId: this.config.keyId,
          teamId: this.config.teamId,
        },
        production: !this.config.useSandbox,
        bundleId: this.config.bundleId,
      };

      this.provider = new apn.Provider(options);
      logger.info('APNs provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize APNs provider:', error);
      throw error;
    }
  }

  async send(notification, user, content) {
    if (!this.provider) {
      return this.formatResult(false, null, { message: 'APNs provider not initialized' });
    }

    const activeDevice = user.devices.find(d => d.isActive && d.apnsToken);
    if (!activeDevice) {
      return this.formatResult(false, null, { message: 'No active APNs token found' });
    }

    const { title, body, image, sound, badge, category, data } = content;

    const note = new apn.Notification();
    note.alert = {
      title: title || 'ReZ App',
      body: body,
    };
    note.topic = this.config.bundleId;
    note.pushType = 'alert';

    if (sound) {
      note.sound = sound;
    } else {
      note.sound = 'default';
    }

    if (badge !== undefined && badge !== null) {
      note.badge = badge;
    }

    if (category) {
      note.category = category;
    }

    if (image) {
      note.attachments = [{
        url: image,
        options: {
          thumbnail: {
            width: 150,
            height: 150,
          },
        },
      }];
    }

    note.payload = {
      notificationId: notification.notificationId,
      category: notification.category,
      ...(data || {}),
    };

    note.device = activeDevice.apnsToken;

    try {
      const result = await this.provider.send(note);
      if (result.sent && result.sent.length > 0) {
        logger.info(`APNs: Message sent successfully to user ${user.userId}`, {
          messageId: result.sent[0],
          notificationId: notification.notificationId,
        });
        return this.formatResult(true, result.sent[0]);
      } else if (result.failed && result.failed.length > 0) {
        const failure = result.failed[0];
        logger.error(`APNs: Failed to send message to user ${user.userId}:`, failure);

        if (failure.response?.reason === 'Unregistered') {
          activeDevice.isActive = false;
          activeDevice.apnsToken = null;
          await user.save();
        }

        return this.formatResult(false, null, { message: failure.response?.reason || 'Send failed' });
      }
      return this.formatResult(false, null, { message: 'No response from APNs' });
    } catch (error) {
      logger.error(`APNs: Exception sending message to user ${user.userId}:`, error);
      return this.formatResult(false, null, error);
    }
  }

  async sendMultiple(notification, users, content) {
    if (!this.provider) {
      return this.formatResult(false, null, { message: 'APNs provider not initialized' });
    }

    const tokens = users
      .flatMap(user => user.devices)
      .filter(d => d.isActive && d.apnsToken);

    if (tokens.length === 0) {
      return this.formatResult(false, null, { message: 'No valid APNs tokens found' });
    }

    const { title, body, sound, badge, data } = content;

    const notes = tokens.map(device => {
      const note = new apn.Notification();
      note.alert = {
        title: title || 'ReZ App',
        body: body,
      };
      note.topic = this.config.bundleId;
      note.sound = sound || 'default';
      note.badge = badge;
      note.payload = {
        notificationId: notification.notificationId,
        category: notification.category,
        ...(data || {}),
      };
      note.device = device.apnsToken;
      return note;
    });

    try {
      const result = await this.provider.send(notes);
      logger.info(`APNs: Multicast sent to ${tokens.length} devices`, {
        successCount: result.sent?.length || 0,
        failureCount: result.failed?.length || 0,
        notificationId: notification.notificationId,
      });
      return this.formatResult(true, result);
    } catch (error) {
      logger.error('APNs: Failed to send multicast:', error);
      return this.formatResult(false, null, error);
    }
  }

  async validateConfig() {
    return !!(this.config.keyId && this.config.teamId && this.config.bundleId);
  }

  async shutdown() {
    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
      this.isInitialized = false;
    }
  }
}

const apnsProvider = new APNsProvider(require('../config').apns);

module.exports = apnsProvider;
