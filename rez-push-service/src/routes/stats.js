const express = require('express');
const router = express.Router();
const { statsController } = require('../controllers');
const { validateQuery, statsQuerySchema } = require('../utils/validators');

router.get('/stats',
  validateQuery(statsQuerySchema),
  statsController.getStats.bind(statsController)
);

router.get('/stats/queue',
  statsController.getQueueStats.bind(statsController)
);

router.get('/stats/providers',
  statsController.getProviderStats.bind(statsController)
);

router.get('/stats/rate-limit',
  statsController.getRateLimitStats.bind(statsController)
);

router.get('/stats/deduplication',
  statsController.getDeduplicationStats.bind(statsController)
);

router.get('/health',
  statsController.getHealth.bind(statsController)
);

module.exports = router;
