import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { resolveService, ResolveOptions } from '../resolve.service';
import { IdentityType } from '../models/identity.model';
import { logger } from '../utils/logger';

const router = Router();

const resolveByIdentitySchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(IdentityType))
    .required(),
  identifier: Joi.string().required(),
  options: Joi.object({
    includeActivity: Joi.boolean(),
    includeDevices: Joi.boolean(),
    activityDays: Joi.number().min(1).max(365),
    privacyFilter: Joi.boolean()
  })
});

const resolveByClusterSchema = Joi.object({
  clusterId: Joi.string().required(),
  options: Joi.object({
    includeActivity: Joi.boolean(),
    includeDevices: Joi.boolean(),
    activityDays: Joi.number().min(1).max(365),
    privacyFilter: Joi.boolean()
  })
});

const resolveByDeviceSchema = Joi.object({
  deviceId: Joi.string(),
  deviceFingerprint: Joi.string(),
  options: Joi.object({
    includeActivity: Joi.boolean(),
    includeDevices: Joi.boolean(),
    activityDays: Joi.number().min(1).max(365),
    privacyFilter: Joi.boolean()
  })
});

async function validateRequest<T>(schema: Joi.Schema, data: unknown): Promise<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
  }
  return value as T;
}

interface ResolveByIdentityRequest {
  type: IdentityType;
  identifier: string;
  options?: ResolveOptions;
}

interface ResolveByClusterRequest {
  clusterId: string;
  options?: ResolveOptions;
}

interface ResolveByDeviceRequest {
  deviceId?: string;
  deviceFingerprint?: string;
  options?: ResolveOptions;
}

router.post('/by-identity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<ResolveByIdentityRequest>(resolveByIdentitySchema, req.body);
    const profile = await resolveService.resolve(
      {
        type: validated.type,
        identifier: validated.identifier
      },
      validated.options
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    logger.info('Profile resolved via API', {
      type: validated.type,
      clusterId: profile.clusterId
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.post('/by-cluster', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<ResolveByClusterRequest>(resolveByClusterSchema, req.body);
    const profile = await resolveService.resolve(
      { clusterId: validated.clusterId },
      validated.options
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found'
      });
    }

    logger.info('Profile resolved via API', {
      clusterId: validated.clusterId
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.post('/by-device', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<ResolveByDeviceRequest>(resolveByDeviceSchema, req.body);
    const profile = await resolveService.resolve(
      {
        deviceId: validated.deviceId,
        deviceFingerprint: validated.deviceFingerprint
      },
      validated.options
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    logger.info('Profile resolved via API', {
      deviceId: validated.deviceId
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.post('/by-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, options } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    const profile = await resolveService.resolve(
      { sessionId },
      options as ResolveOptions
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    logger.info('Profile resolved via API', {
      sessionId
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.post('/anonymous', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceFingerprint, userAgent, ipAddress } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({
        success: false,
        error: 'deviceFingerprint is required'
      });
    }

    const profile = await resolveService.resolve(
      { deviceFingerprint },
      { includeActivity: true, includeDevices: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Anonymous profile not found'
      });
    }

    logger.info('Anonymous profile resolved via API', {
      deviceFingerprint: deviceFingerprint.substring(0, 20) + '...'
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.get('/cluster/:clusterId/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;
    const profile = await resolveService.buildUnifiedProfile(clusterId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.post('/predict/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;
    const { traits } = req.body;

    const prediction = await resolveService.predictUser(clusterId, traits || {});

    logger.info('User prediction generated', {
      clusterId,
      confidence: prediction.confidence
    });

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/clusters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await resolveService.getClusterStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
