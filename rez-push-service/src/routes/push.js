const express = require('express');
const router = express.Router();
const { pushController } = require('../controllers');
const { validate, sendNotificationSchema, broadcastSchema, segmentSchema } = require('../utils/validators');

router.post('/send',
  validate(sendNotificationSchema),
  pushController.send.bind(pushController)
);

router.post('/broadcast',
  validate(broadcastSchema),
  pushController.broadcast.bind(pushController)
);

router.post('/segment',
  validate(segmentSchema),
  pushController.sendToSegment.bind(pushController)
);

router.get('/notification/:notificationId',
  pushController.getNotificationStatus.bind(pushController)
);

router.get('/user/:userId/notifications',
  pushController.getUserNotifications.bind(pushController)
);

router.put('/notification/:notificationId/read',
  pushController.markAsRead.bind(pushController)
);

module.exports = router;
