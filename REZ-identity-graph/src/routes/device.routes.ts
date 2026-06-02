import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { deviceService, DeviceFingerprintOptions, CreateDeviceOptions } from '../device.service';
import { logger } from '../utils/logger';

const router = Router();

const fingerprintSchema = Joi.object({
  userAgent: Joi.string().required(),
  screenResolution: Joi.string(),
  timezone: Joi.string(),
  language: Joi.string(),
  platform: Joi.string(),
  colorDepth: Joi.number(),
  deviceMemory: Joi.number(),
  hardwareConcurrency: Joi.number(),
  touchPoints: Joi.number(),
  webGLVendor: Joi.string(),
  webGLRenderer: Joi.string()
});

const createDeviceSchema = Joi.object({
  fingerprint: fingerprintSchema.required(),
  ipAddress: Joi.string(),
  clusterId: Joi.string(),
  metadata: Joi.object({
    osVersion: Joi.string(),
    appVersion: Joi.string(),
    manufacturer: Joi.string(),
    model: Joi.string()
  })
});

const linkIdentitySchema = Joi.object({
  identityId: Joi.string().required(),
  linkType: Joi.string().default('user_action')
});

interface LinkIdentityRequest {
  identityId: string;
  linkType: string;
}

async function validateRequest<T>(schema: Joi.Schema, data: unknown): Promise<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
  }
  return value as T;
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<CreateDeviceOptions>(createDeviceSchema, req.body);
    const device = await deviceService.createOrUpdateDevice(validated);

    logger.info('Device created/updated via API', {
      deviceId: device.deviceId,
      type: device.type
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const device = await deviceService.getDevice(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
});

router.post('/fingerprint/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest(fingerprintSchema, req.body);
    const device = await deviceService.getDeviceByFingerprint(validated as DeviceFingerprintOptions);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const validated = await validateRequest<LinkIdentityRequest>(linkIdentitySchema, req.body);

    const success = await deviceService.linkIdentityToDevice(
      deviceId,
      validated.identityId,
      validated.linkType
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    logger.info('Identity linked to device via API', {
      deviceId,
      identityId: validated.identityId
    });

    res.json({
      success: true,
      message: 'Identity linked successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/unlink', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const { identityId } = req.body;

    if (!identityId) {
      return res.status(400).json({
        success: false,
        error: 'identityId is required'
      });
    }

    const success = await deviceService.unlinkIdentityFromDevice(deviceId, identityId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    logger.info('Identity unlinked from device via API', {
      deviceId,
      identityId
    });

    res.json({
      success: true,
      message: 'Identity unlinked successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:deviceId/risk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const assessment = await deviceService.assessDeviceRisk(deviceId);

    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    next(error);
  }
});

router.get('/cluster/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;
    const devices = await deviceService.getDevicesByCluster(clusterId);

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/identity/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const devices = await deviceService.getDevicesByIdentity(identityId);

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/block', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const success = await deviceService.blockDevice(deviceId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    logger.warn('Device blocked via API', { deviceId });

    res.json({
      success: true,
      message: 'Device blocked successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/unblock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const success = await deviceService.unblockDevice(deviceId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    logger.info('Device unblocked via API', { deviceId });

    res.json({
      success: true,
      message: 'Device unblocked successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceDeviceId, targetDeviceId } = req.body;

    if (!sourceDeviceId || !targetDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'sourceDeviceId and targetDeviceId are required'
      });
    }

    const success = await deviceService.mergeDevices(sourceDeviceId, targetDeviceId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'One or both devices not found'
      });
    }

    logger.info('Devices merged via API', {
      sourceDeviceId,
      targetDeviceId
    });

    res.json({
      success: true,
      message: 'Devices merged successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await deviceService.getDeviceAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
});

export default router;
