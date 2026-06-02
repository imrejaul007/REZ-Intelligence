const express = require('express');
const router = express.Router();
const { Notification } = require('../models');
const logger = require('../utils/logger');

router.post('/sms/status', async (req, res) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.info('SMS status callback received', {
      messageSid: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode,
    });

    const notification = await Notification.findOne({
      'channelStatuses.sms.providerMessageId': MessageSid,
    });

    if (notification) {
      switch (MessageStatus) {
        case 'delivered':
          notification.markChannelDelivered('sms', {
            providerMessageId: MessageSid,
          });
          break;
        case 'failed':
          notification.markChannelFailed('sms', ErrorCode, ErrorMessage);
          break;
        case 'undelivered':
          notification.markChannelFailed('sms', 'UNDELIVERED', 'Message was not delivered');
          break;
        default:
          notification.setChannelStatus('sms', MessageStatus.toLowerCase());
      }
      await notification.save();
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling SMS status callback:', error);
    res.sendStatus(500);
  }
});

router.post('/email/status', async (req, res) => {
  try {
    const sgMessageId = req.headers['x-message-id'] ||
                        req.body?.sg_message_id?.[0];

    if (!sgMessageId) {
      return res.sendStatus(200);
    }

    const event = req.body[0];

    if (event) {
      const notification = await Notification.findOne({
        'metadata.sgMessageId': sgMessageId,
      });

      if (notification) {
        switch (event.event) {
          case 'delivered':
            notification.markChannelDelivered('email', {
              providerMessageId: sgMessageId,
            });
            break;
          case 'bounce':
            notification.markChannelFailed('email', 'BOUNCE', event.bounce_classification);
            break;
          case 'dropped':
            notification.markChannelFailed('email', 'DROPPED', event.reason);
            break;
          case 'spamreport':
            notification.markChannelFailed('email', 'SPAM_REPORT', 'User marked as spam');
            break;
          case 'unsubscribe':
            notification.setChannelStatus('email', 'unsubscribed');
            break;
          default:
            logger.debug(`Unhandled email event: ${event.event}`);
        }
        await notification.save();
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling email status callback:', error);
    res.sendStatus(500);
  }
});

router.post('/whatsapp/status', async (req, res) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      To,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.info('WhatsApp status callback received', {
      messageSid: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode,
    });

    const notification = await Notification.findOne({
      'channelStatuses.whatsapp.providerMessageId': MessageSid,
    });

    if (notification) {
      switch (MessageStatus) {
        case 'delivered':
          notification.markChannelDelivered('whatsapp', {
            providerMessageId: MessageSid,
          });
          break;
        case 'read':
          notification.setChannelStatus('whatsapp', 'read');
          notification.readAt = new Date();
          break;
        case 'failed':
          notification.markChannelFailed('whatsapp', ErrorCode, ErrorMessage);
          break;
        case 'undelivered':
          notification.markChannelFailed('whatsapp', 'UNDELIVERED', 'Message was not delivered');
          break;
        default:
          notification.setChannelStatus('whatsapp', MessageStatus.toLowerCase());
      }
      await notification.save();
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling WhatsApp status callback:', error);
    res.sendStatus(500);
  }
});

module.exports = router;
