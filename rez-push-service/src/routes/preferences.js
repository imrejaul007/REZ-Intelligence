const express = require('express');
const router = express.Router();
const { preferencesController } = require('../controllers');
const { validate, preferencesUpdateSchema } = require('../utils/validators');

router.get('/user/:userId/preferences',
  preferencesController.getPreferences.bind(preferencesController)
);

router.put('/user/:userId/preferences',
  validate(preferencesUpdateSchema),
  preferencesController.updatePreferences.bind(preferencesController)
);

router.patch('/user/:userId/preferences/channel',
  preferencesController.setChannelEnabled.bind(preferencesController)
);

router.patch('/user/:userId/preferences/category',
  preferencesController.setCategoryEnabled.bind(preferencesController)
);

router.patch('/user/:userId/preferences/quiet-hours',
  preferencesController.setQuietHours.bind(preferencesController)
);

router.patch('/user/:userId/preferences/frequency-cap',
  preferencesController.setFrequencyCap.bind(preferencesController)
);

router.post('/user/:userId/opt-out',
  preferencesController.optOut.bind(preferencesController)
);

router.post('/user/:userId/opt-in',
  preferencesController.optIn.bind(preferencesController)
);

router.patch('/user/:userId/global-opt-out',
  preferencesController.setGlobalOptOut.bind(preferencesController)
);

router.get('/user/:userId/frequency-cap',
  preferencesController.getFrequencyCap.bind(preferencesController)
);

module.exports = router;
