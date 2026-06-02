import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { identityService, CreateIdentityOptions, UpdateIdentityOptions } from '../identity.service';
import { IdentityType } from '../models/identity.model';
import { logger } from '../utils/logger';

const router = Router();

const createIdentitySchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(IdentityType))
    .required(),
  identifier: Joi.string().required(),
  metadata: Joi.object({
    source: Joi.string(),
    userAgent: Joi.string(),
    ipAddress: Joi.string(),
    platform: Joi.string(),
    appVersion: Joi.string(),
    traits: Joi.object()
  }),
  privacySettings: Joi.object({
    trackingEnabled: Joi.boolean(),
    dataRetentionDays: Joi.number().min(1).max(3650),
    marketingConsent: Joi.boolean(),
    analyticsConsent: Joi.boolean(),
    thirdPartySharing: Joi.boolean()
  })
});

const updateIdentitySchema = Joi.object({
  metadata: Joi.object({
    userAgent: Joi.string(),
    ipAddress: Joi.string(),
    platform: Joi.string(),
    appVersion: Joi.string(),
    traits: Joi.object()
  }),
  privacySettings: Joi.object({
    trackingEnabled: Joi.boolean(),
    dataRetentionDays: Joi.number().min(1).max(3650),
    marketingConsent: Joi.boolean(),
    analyticsConsent: Joi.boolean(),
    thirdPartySharing: Joi.boolean()
  })
});

async function validateRequest<T>(
  schema: Joi.Schema,
  data: unknown
): Promise<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
  }
  return value as T;
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<CreateIdentityOptions>(createIdentitySchema, req.body);
    const identity = await identityService.createIdentity(validated);

    logger.info('Identity created via API', {
      identityId: identity.identityId,
      type: identity.type
    });

    res.status(201).json({
      success: true,
      data: identity
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const result = await identityService.getIdentity(identityId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/type/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.params.type as IdentityType;
    if (!Object.values(IdentityType).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid identity type'
      });
    }

    const identities = await identityService.getIdentitiesByType(type);

    res.json({
      success: true,
      data: identities,
      count: identities.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/cluster/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;
    const identities = await identityService.getIdentitiesByCluster(clusterId);

    res.json({
      success: true,
      data: identities,
      count: identities.length
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const validated = await validateRequest<UpdateIdentityOptions>(updateIdentitySchema, req.body);
    const identity = await identityService.updateIdentity(identityId, validated);

    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    logger.info('Identity updated via API', { identityId });

    res.json({
      success: true,
      data: identity
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const success = await identityService.softDeleteIdentity(identityId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    logger.info('Identity deleted via API', { identityId });

    res.json({
      success: true,
      message: 'Identity deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit = 50 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const identities = await identityService.searchIdentities(query, limit);

    res.json({
      success: true,
      data: identities,
      count: identities.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/anonymous/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceFingerprint } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({
        success: false,
        error: 'Device fingerprint is required'
      });
    }

    const existing = await identityService.getAnonymousIdentity(deviceFingerprint);

    if (existing) {
      await identityService.updateIdentity(existing.identity.identityId, {});
      return res.json({
        success: true,
        data: existing,
        isNew: false
      });
    }

    const identity = await identityService.createIdentity({
      type: IdentityType.ANONYMOUS,
      identifier: deviceFingerprint,
      metadata: {
        source: 'device_fingerprint',
        userAgent: req.headers['user-agent']
      }
    });

    res.status(201).json({
      success: true,
      data: identity,
      isNew: true
    });
  } catch (error) {
    next(error);
  }
});

router.post('/anonymous/promote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anonymousIdentityId, newType, newIdentifier } = req.body;

    if (!anonymousIdentityId || !newType || !newIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'anonymousIdentityId, newType, and newIdentifier are required'
      });
    }

    const identity = await identityService.promoteAnonymousToIdentified(
      anonymousIdentityId,
      newType as IdentityType,
      newIdentifier
    );

    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Anonymous identity not found'
      });
    }

    logger.info('Identity promoted from anonymous', {
      anonymousIdentityId,
      newIdentityId: identity.identityId
    });

    res.json({
      success: true,
      data: identity
    });
  } catch (error) {
    next(error);
  }
});

export default router;
