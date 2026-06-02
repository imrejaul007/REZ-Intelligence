import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import {
  validateRequest,
  ValidationSchema,
  sanitizeInput,
  RequestSizeLimit,
  validateApiKey,
  createEndpointRateLimiter
} from '../services/schemaService';

export const validationRouter = Router();

// Default rate limiter for all validation routes
const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

validationRouter.use(globalRateLimiter);

// Schema definitions for different endpoints
const schemas: Record<string, ValidationSchema> = {
  // User registration schema
  register: {
    body: {
      email: {
        type: 'email',
        required: true,
        sanitize: true
      },
      username: {
        type: 'string',
        required: true,
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/,
        sanitize: true
      },
      password: {
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128
      },
      firstName: {
        type: 'string',
        required: false,
        maxLength: 50,
        sanitize: true
      },
      lastName: {
        type: 'string',
        required: false,
        maxLength: 50,
        sanitize: true
      }
    }
  },

  // Login schema
  login: {
    body: {
      email: {
        type: 'email',
        required: true
      },
      password: {
        type: 'string',
        required: true
      }
    }
  },

  // Generic text input schema
  textInput: {
    body: {
      content: {
        type: 'string',
        required: true,
        maxLength: 10000,
        sanitize: true
      },
      title: {
        type: 'string',
        required: false,
        maxLength: 200,
        sanitize: true
      }
    }
  },

  // Search query schema
  search: {
    query: {
      q: {
        type: 'string',
        required: true,
        maxLength: 200,
        sanitize: true
      },
      page: {
        type: 'number',
        required: false,
        min: 1,
        max: 1000
      },
      limit: {
        type: 'number',
        required: false,
        min: 1,
        max: 100
      }
    }
  },

  // ID parameter schema
  idParam: {
    params: {
      id: {
        type: 'string',
        required: true,
        pattern: /^[0-9]+$/
      }
    }
  },

  // Comment schema
  comment: {
    body: {
      text: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 5000,
        sanitize: true
      },
      parentId: {
        type: 'string',
        required: false,
        pattern: /^[0-9]*$/
      }
    }
  },

  // Profile update schema
  profileUpdate: {
    body: {
      displayName: {
        type: 'string',
        required: false,
        maxLength: 100,
        sanitize: true
      },
      bio: {
        type: 'string',
        required: false,
        maxLength: 500,
        sanitize: true
      },
      website: {
        type: 'string',
        required: false,
        pattern: /^https?:\/\/.+/
      }
    }
  },

  // JSON data schema
  jsonData: {
    body: {
      data: {
        type: 'object',
        required: true
      },
      metadata: {
        type: 'object',
        required: false
      }
    }
  }
};

// Validation endpoint examples
validationRouter.post('/validate/register', validateApiKey, createEndpointRateLimiter(10, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.register);
});

validationRouter.post('/validate/login', createEndpointRateLimiter(20, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.login);
});

validationRouter.post('/validate/text', createEndpointRateLimiter(50, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.textInput);
});

validationRouter.get('/validate/search', createEndpointRateLimiter(100, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.search);
});

validationRouter.get('/validate/resource/:id', createEndpointRateLimiter(200, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.idParam);
});

validationRouter.post('/validate/comment', createEndpointRateLimiter(30, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.comment);
});

validationRouter.patch('/validate/profile', validateApiKey, createEndpointRateLimiter(20, '1m'), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.profileUpdate);
});

validationRouter.post('/validate/json', createEndpointRateLimiter(50, '1m'), RequestSizeLimit(50000), (req: Request, res: Response, next: NextFunction) => {
  validateRequest(req, res, next, schemas.jsonData);
});

// Batch validation endpoint
validationRouter.post('/validate/batch', validateApiKey, createEndpointRateLimiter(5, '1m'), (req: Request, res: Response) => {
  const { items, schemaName } = req.body as { items: unknown[]; schemaName: keyof typeof schemas };

  if (!Array.isArray(items)) {
    res.status(400).json({
      success: false,
      error: 'Items must be an array'
    });
    return;
  }

  if (!schemaName || !schemas[schemaName]) {
    res.status(400).json({
      success: false,
      error: 'Invalid schema name'
    });
    return;
  }

  const schema = schemas[schemaName];
  const results = items.map((item, index) => {
    try {
      const sanitized = sanitizeInput(item, schema);
      return { index, success: true, data: sanitized };
    } catch (error) {
      return {
        index,
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  });

  const allSuccessful = results.every(r => r.success);

  res.status(allSuccessful ? 200 : 207).json({
    success: allSuccessful,
    results,
    summary: {
      total: items.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  });
});

// Sanitization only endpoint (for already-validated data)
validationRouter.post('/sanitize', (req: Request, res: Response) => {
  const { data, schemaName } = req.body as { data: unknown; schemaName: keyof typeof schemas };

  if (!schemaName || !schemas[schemaName]) {
    res.status(400).json({
      success: false,
      error: 'Invalid schema name'
    });
    return;
  }

  try {
    const sanitized = sanitizeInput(data, schemas[schemaName]);
    res.json({
      success: true,
      sanitized
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sanitization failed'
    });
  }
});

// Schema info endpoint
validationRouter.get('/schemas', (_req: Request, res: Response) => {
  const schemaInfo = Object.keys(schemas).map(name => ({
    name,
    fields: Object.keys(schemas[name as keyof typeof schemas]?.body || {}).concat(
      Object.keys(schemas[name as keyof typeof schemas]?.query || {})
    )
  }));

  res.json({
    success: true,
    schemas: schemaInfo
  });
});
