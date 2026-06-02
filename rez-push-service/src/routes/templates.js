const express = require('express');
const router = express.Router();
const { templateController } = require('../controllers');
const { validate, templateSchema } = require('../utils/validators');

router.post('/',
  validate(templateSchema),
  templateController.create.bind(templateController)
);

router.get('/',
  templateController.list.bind(templateController)
);

router.get('/:templateId',
  templateController.get.bind(templateController)
);

router.put('/:templateId',
  validate(templateSchema),
  templateController.update.bind(templateController)
);

router.delete('/:templateId',
  templateController.delete.bind(templateController)
);

router.post('/:templateId/preview',
  templateController.preview.bind(templateController)
);

router.get('/:templateId/ab-test-results',
  templateController.getABTestResults.bind(templateController)
);

module.exports = router;
