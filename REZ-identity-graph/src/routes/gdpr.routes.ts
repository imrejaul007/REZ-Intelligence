import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { Identity, IdentityStatus } from '../models/identity.model';
import { Cluster, ClusterStatus } from '../models/cluster.model';
import { Device, DeviceStatus } from '../models/device.model';
import { Activity } from '../models/activity.model';
import { logger } from '../utils/logger';

const router = Router();

async function getIdentityById(identityId: string) {
  return Identity.findOne({ identityId });
}

async function getClusterByIdentity(identityId: string) {
  const identity = await Identity.findOne({ identityId });
  if (!identity) return null;
  return Cluster.findOne({ clusterId: identity.clusterId });
}

router.post('/consent/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;
    const { marketingConsent, analyticsConsent, thirdPartySharing } = req.body;

    const identity = await getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    if (marketingConsent !== undefined) {
      identity.privacySettings.marketingConsent = marketingConsent;
    }
    if (analyticsConsent !== undefined) {
      identity.privacySettings.analyticsConsent = analyticsConsent;
    }
    if (thirdPartySharing !== undefined) {
      identity.privacySettings.thirdPartySharing = thirdPartySharing;
    }

    identity.gdpr.consentGivenAt = new Date();
    identity.gdpr.consentWithdrawnAt = undefined;
    await identity.save();

    logger.info('Consent updated via API', {
      identityId,
      marketingConsent,
      analyticsConsent,
      thirdPartySharing
    });

    res.json({
      success: true,
      message: 'Consent updated successfully',
      data: {
        marketingConsent: identity.privacySettings.marketingConsent,
        analyticsConsent: identity.privacySettings.analyticsConsent,
        thirdPartySharing: identity.privacySettings.thirdPartySharing,
        consentGivenAt: identity.gdpr.consentGivenAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/withdraw-consent/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    const identity = await getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    identity.privacySettings.marketingConsent = false;
    identity.privacySettings.analyticsConsent = false;
    identity.privacySettings.thirdPartySharing = false;
    identity.gdpr.consentWithdrawnAt = new Date();
    await identity.save();

    logger.info('Consent withdrawn via API', { identityId });

    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
      data: {
        consentWithdrawnAt: identity.gdpr.consentWithdrawnAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/erasure/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    const identity = await getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    identity.gdpr.erasureRequestedAt = new Date();
    await identity.save();

    const cluster = await Cluster.findOne({ clusterId: identity.clusterId });
    if (cluster && cluster.identityCount <= 1) {
      identity.status = IdentityStatus.DELETED;
      identity.identifier = '';
      identity.hashIdentifier = '';
      identity.metadata = {} as any;
      await identity.save();

      cluster.status = ClusterStatus.ARCHIVED;
      await cluster.save();

      await Activity.deleteMany({ identityId });
      await Device.deleteMany({ clusterId: identity.clusterId });

      identity.gdpr.erasureCompletedAt = new Date();
      await identity.save();
    } else {
      identity.status = IdentityStatus.DELETED;
      identity.identifier = '';
      identity.hashIdentifier = '';
      identity.metadata = {} as any;
      await identity.save();

      if (cluster) {
        cluster.identityCount = Math.max(0, cluster.identityCount - 1);
        cluster.identityLinks = cluster.identityLinks.filter(
          (link) => link.identityId !== identityId
        );
        await cluster.save();
      }

      await Activity.deleteMany({ identityId });

      identity.gdpr.erasureCompletedAt = new Date();
      await identity.save();
    }

    logger.info('GDPR erasure completed', {
      identityId,
      completedAt: identity.gdpr.erasureCompletedAt
    });

    res.json({
      success: true,
      message: 'Data erasure request processed',
      data: {
        erasureRequestedAt: identity.gdpr.erasureRequestedAt,
        erasureCompletedAt: identity.gdpr.erasureCompletedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/erasure/cluster/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clusterId } = req.params;

    const cluster = await Cluster.findOne({ clusterId });
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found'
      });
    }

    const identities = await Identity.find({ clusterId });
    const erasureResults = [];

    for (const identity of identities) {
      identity.gdpr.erasureRequestedAt = new Date();
      identity.status = IdentityStatus.DELETED;
      identity.identifier = '';
      identity.hashIdentifier = '';
      identity.metadata = {} as any;
      identity.gdpr.erasureCompletedAt = new Date();
      await identity.save();

      await Activity.deleteMany({ identityId: identity.identityId });

      erasureResults.push({
        identityId: identity.identityId,
        erasureCompletedAt: identity.gdpr.erasureCompletedAt
      });
    }

    await Device.deleteMany({ clusterId });
    await Activity.deleteMany({ clusterId });

    cluster.status = ClusterStatus.ARCHIVED;
    await cluster.save();

    logger.info('GDPR cluster erasure completed', {
      clusterId,
      identitiesErased: erasureResults.length
    });

    res.json({
      success: true,
      message: 'Cluster data erasure completed',
      data: {
        clusterId,
        identitiesErased: erasureResults.length,
        results: erasureResults
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    const identity = await getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    identity.gdpr.dataExportRequestedAt = new Date();
    await identity.save();

    const cluster = await Cluster.findOne({ clusterId: identity.clusterId });
    const linkedIdentities = await Identity.find({
      clusterId: identity.clusterId,
      identityId: { $ne: identityId },
      status: { $ne: IdentityStatus.DELETED }
    });
    const devices = await Device.find({
      clusterId: identity.clusterId,
      'linkedIdentities.identityId': identityId
    });
    const activities = await Activity.find({
      identityId,
      'privacy.personallyIdentifiable': false
    }).limit(100);

    const exportData = {
      exportedAt: new Date().toISOString(),
      identity: {
        id: identity.identityId,
        type: identity.type,
        status: identity.status,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
        metadata: identity.metadata,
        privacySettings: identity.privacySettings
      },
      cluster: cluster ? {
        id: cluster.clusterId,
        identityCount: cluster.identityCount,
        confidence: cluster.confidence,
        createdAt: cluster.createdAt
      } : null,
      linkedIdentities: linkedIdentities.map((i) => ({
        id: i.identityId,
        type: i.type,
        status: i.status
      })),
      devices: devices.map((d) => ({
        id: d.deviceId,
        type: d.type,
        createdAt: d.createdAt
      })),
      recentActivity: activities.map((a) => ({
        type: a.type,
        channel: a.channel,
        timestamp: a.timestamp,
        metadata: a.metadata
      })),
      gdpr: {
        consentGivenAt: identity.gdpr.consentGivenAt,
        consentWithdrawnAt: identity.gdpr.consentWithdrawnAt,
        dataExportRequestedAt: identity.gdpr.dataExportRequestedAt,
        erasureRequestedAt: identity.gdpr.erasureRequestedAt
      }
    };

    identity.gdpr.dataExportCompletedAt = new Date();
    identity.gdpr.exportedDataUrl = `data:application/json;base64,${Buffer.from(
      JSON.stringify(exportData)
    ).toString('base64')}`;
    await identity.save();

    logger.info('GDPR data export completed', {
      identityId,
      exportSize: JSON.stringify(exportData).length
    });

    res.json({
      success: true,
      message: 'Data export completed',
      data: exportData
    });
  } catch (error) {
    next(error);
  }
});

router.get('/consent-status/:identityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identityId } = req.params;

    const identity = await getIdentityById(identityId);
    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found'
      });
    }

    res.json({
      success: true,
      data: {
        identityId: identity.identityId,
        privacySettings: identity.privacySettings,
        gdpr: {
          consentGivenAt: identity.gdpr.consentGivenAt,
          consentWithdrawnAt: identity.gdpr.consentWithdrawnAt,
          erasureRequestedAt: identity.gdpr.erasureRequestedAt,
          erasureCompletedAt: identity.gdpr.erasureCompletedAt,
          dataExportRequestedAt: identity.gdpr.dataExportRequestedAt,
          dataExportCompletedAt: identity.gdpr.dataExportCompletedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-erasure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingErasures = await Identity.find({
      'gdpr.erasureRequestedAt': { $exists: true },
      'gdpr.erasureCompletedAt': { $exists: false },
      status: { $ne: IdentityStatus.DELETED }
    }).select('identityId type erasureRequestedAt clusterId');

    res.json({
      success: true,
      data: pendingErasures,
      count: pendingErasures.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingExports = await Identity.find({
      'gdpr.dataExportRequestedAt': { $exists: true },
      'gdpr.dataExportCompletedAt': { $exists: false }
    }).select('identityId type dataExportRequestedAt clusterId');

    res.json({
      success: true,
      data: pendingExports,
      count: pendingExports.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
