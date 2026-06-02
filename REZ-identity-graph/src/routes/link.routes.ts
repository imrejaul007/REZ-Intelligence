import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { linkService, LinkType, LinkRequest } from '../link.service';
import { ClusterConfidence } from '../models/cluster.model';
import { logger } from '../utils/logger';

const router = Router();

const linkIdentitiesSchema = Joi.object({
  sourceIdentityId: Joi.string().required(),
  targetIdentityId: Joi.string().required(),
  linkType: Joi.string()
    .valid(...Object.values(LinkType))
    .default(LinkType.IMPLICIT),
  confidence: Joi.string()
    .valid(...Object.values(ClusterConfidence))
    .default(ClusterConfidence.MEDIUM),
  reason: Joi.string(),
  verified: Joi.boolean().default(false),
  metadata: Joi.object()
});

const linkByIdentifierSchema = Joi.object({
  identityId: Joi.string().required(),
  value: Joi.string().required(),
  type: Joi.string().valid('email', 'phone').required(),
  confidence: Joi.string()
    .valid(...Object.values(ClusterConfidence))
    .default(ClusterConfidence.MEDIUM)
});

const unlinkSchema = Joi.object({
  identityId: Joi.string().required(),
  reason: Joi.string(),
  cascade: Joi.boolean().default(false)
});

interface UnlinkRequest {
  identityId: string;
  reason?: string;
  cascade?: boolean;
}

const mergeClustersSchema = Joi.object({
  sourceClusterId: Joi.string().required(),
  targetClusterId: Joi.string().required(),
  reason: Joi.string().required()
});

interface MergeClustersRequest {
  sourceClusterId: string;
  targetClusterId: string;
  reason: string;
}

interface LinkByIdentifierRequest {
  identityId: string;
  value: string;
  type: string;
  confidence?: ClusterConfidence;
}

async function validateRequest<T>(schema: Joi.Schema, data: unknown): Promise<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((d) => d.message).join(', ')}`);
  }
  return value as T;
}

router.post('/identities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<LinkRequest>(linkIdentitiesSchema, req.body);
    const result = await linkService.linkIdentities(validated);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Identities linked via API', {
      sourceIdentityId: validated.sourceIdentityId,
      targetIdentityId: validated.targetIdentityId,
      clusterId: result.clusterId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<LinkByIdentifierRequest>(linkByIdentifierSchema, req.body);
    const result = await linkService.linkByEmail(
      validated.identityId,
      validated.value,
      validated.confidence as ClusterConfidence
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Email identity linked via API', {
      identityId: validated.identityId,
      email: validated.value
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<LinkByIdentifierRequest>(linkByIdentifierSchema, req.body);
    const result = await linkService.linkByPhone(
      validated.identityId,
      validated.value,
      validated.confidence as ClusterConfidence
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Phone identity linked via API', {
      identityId: validated.identityId,
      phone: validated.value
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/device', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId, deviceId, confidence } = req.body;

    if (!identityId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'identityId and deviceId are required'
      });
    }

    const result = await linkService.linkByDevice(
      identityId,
      deviceId,
      (confidence as ClusterConfidence) || ClusterConfidence.MEDIUM
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Device linked via API', {
      identityId,
      deviceId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unlink', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<UnlinkRequest>(unlinkSchema, req.body);
    const result = await linkService.unlinkIdentity(validated);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Identity unlinked via API', {
      identityId: validated.identityId,
      cascade: validated.cascade
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/cluster/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;
    const cluster = await linkService.getClusterDetails(clusterId);

    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found'
      });
    }

    res.json({
      success: true,
      data: cluster
    });
  } catch (error) {
    next(error);
  }
});

router.get('/identity/:identityId/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const links = await linkService.getIdentityLinks(identityId);

    if (!links) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    next(error);
  }
});

router.post('/clusters/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = await validateRequest<MergeClustersRequest>(mergeClustersSchema, req.body);
    const result = await linkService.linkIdentities({
      sourceIdentityId: validated.sourceClusterId,
      targetIdentityId: validated.targetClusterId,
      linkType: LinkType.MERGE,
      confidence: ClusterConfidence.HIGH,
      reason: validated.reason
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Clusters merged via API', {
      sourceClusterId: validated.sourceClusterId,
      targetClusterId: validated.targetClusterId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
