import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import { ProfileManager } from './profiles/profile-manager';
import { SegmentationEngine } from './segments/segmentation';
import { IdentityResolver } from './identity/identity-resolution';
import { ActivityTracker } from './activity/activity-tracker';
import { ProfileUnification } from './unification/profile-unification';

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize services
const profileManager = new ProfileManager(logger);
const identityResolver = new IdentityResolver(logger);
const activityTracker = new ActivityTracker(logger);
const segmentationEngine = new SegmentationEngine(logger, profileManager);
const profileUnification = new ProfileUnification(logger, profileManager, identityResolver);

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.headers['x-request-id']);
  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: req.headers['x-request-id'],
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start
    });
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-cdp-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// Profile Management Routes
// ============================================
app.post('/profiles', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.createProfile(req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error creating profile', { error, body: req.body });
    res.status(500).json({ success: false, error: 'Failed to create profile' });
  }
});

app.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error fetching profile', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

app.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.updateProfile(req.params.id, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error updating profile', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.delete('/profiles/:id', async (req: Request, res: Response) => {
  try {
    await profileManager.deleteProfile(req.params.id);
    res.json({ success: true, message: 'Profile deleted' });
  } catch (error) {
    logger.error('Error deleting profile', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
});

app.post('/profiles/:id/attributes', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.updateAttributes(req.params.id, req.body.attributes);
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error updating attributes', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to update attributes' });
  }
});

app.get('/profiles/search', async (req: Request, res: Response) => {
  try {
    const { email, phone, deviceId } = req.query;
    const profiles = await profileManager.searchProfiles({
      email: email as string,
      phone: phone as string,
      deviceId: deviceId as string
    });
    res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error('Error searching profiles', { error });
    res.status(500).json({ success: false, error: 'Failed to search profiles' });
  }
});

// ============================================
// Identity Resolution Routes
// ============================================
app.post('/identity/resolve', async (req: Request, res: Response) => {
  try {
    const result = await identityResolver.resolveIdentity(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error resolving identity', { error });
    res.status(500).json({ success: false, error: 'Failed to resolve identity' });
  }
});

app.post('/identity/link', async (req: Request, res: Response) => {
  try {
    const result = await identityResolver.linkIdentities(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error linking identities', { error });
    res.status(500).json({ success: false, error: 'Failed to link identities' });
  }
});

app.post('/identity/unmerge', async (req: Request, res: Response) => {
  try {
    const result = await identityResolver.unmergeIdentities(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error unmerging identities', { error });
    res.status(500).json({ success: false, error: 'Failed to unmerge identities' });
  }
});

app.get('/identity/:id/graph', async (req: Request, res: Response) => {
  try {
    const graph = await identityResolver.getIdentityGraph(req.params.id);
    res.json({ success: true, data: graph });
  } catch (error) {
    logger.error('Error fetching identity graph', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch identity graph' });
  }
});

// ============================================
// Activity Tracking Routes
// ============================================
app.post('/activities', async (req: Request, res: Response) => {
  try {
    const activity = await activityTracker.track(req.body);
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    logger.error('Error tracking activity', { error });
    res.status(500).json({ success: false, error: 'Failed to track activity' });
  }
});

app.post('/activities/batch', async (req: Request, res: Response) => {
  try {
    const results = await activityTracker.trackBatch(req.body.activities);
    res.status(201).json({ success: true, data: results });
  } catch (error) {
    logger.error('Error tracking batch activities', { error });
    res.status(500).json({ success: false, error: 'Failed to track batch activities' });
  }
});

app.get('/activities/:profileId', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type, limit = '50' } = req.query;
    const activities = await activityTracker.getActivities(
      req.params.profileId,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        type: type as string,
        limit: parseInt(limit as string, 10)
      }
    );
    res.json({ success: true, data: activities });
  } catch (error) {
    logger.error('Error fetching activities', { error, profileId: req.params.profileId });
    res.status(500).json({ success: false, error: 'Failed to fetch activities' });
  }
});

app.get('/activities/:profileId/timeline', async (req: Request, res: Response) => {
  try {
    const timeline = await activityTracker.getTimeline(req.params.profileId);
    res.json({ success: true, data: timeline });
  } catch (error) {
    logger.error('Error fetching timeline', { error, profileId: req.params.profileId });
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

// ============================================
// Segmentation Routes
// ============================================
app.post('/segments', async (req: Request, res: Response) => {
  try {
    const segment = await segmentationEngine.createSegment(req.body);
    res.status(201).json({ success: true, data: segment });
  } catch (error) {
    logger.error('Error creating segment', { error });
    res.status(500).json({ success: false, error: 'Failed to create segment' });
  }
});

app.get('/segments', async (req: Request, res: Response) => {
  try {
    const segments = await segmentationEngine.listSegments();
    res.json({ success: true, data: segments });
  } catch (error) {
    logger.error('Error listing segments', { error });
    res.status(500).json({ success: false, error: 'Failed to list segments' });
  }
});

app.get('/segments/:id', async (req: Request, res: Response) => {
  try {
    const segment = await segmentationEngine.getSegment(req.params.id);
    res.json({ success: true, data: segment });
  } catch (error) {
    logger.error('Error fetching segment', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch segment' });
  }
});

app.post('/segments/:id/evaluate', async (req: Request, res: Response) => {
  try {
    const result = await segmentationEngine.evaluateSegment(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error evaluating segment', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to evaluate segment' });
  }
});

app.get('/segments/:id/members', async (req: Request, res: Response) => {
  try {
    const members = await segmentationEngine.getSegmentMembers(req.params.id);
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error('Error fetching segment members', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch segment members' });
  }
});

app.delete('/segments/:id', async (req: Request, res: Response) => {
  try {
    await segmentationEngine.deleteSegment(req.params.id);
    res.json({ success: true, message: 'Segment deleted' });
  } catch (error) {
    logger.error('Error deleting segment', { error, id: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to delete segment' });
  }
});

// ============================================
// Profile Unification Routes
// ============================================
app.post('/unify', async (req: Request, res: Response) => {
  try {
    const result = await profileUnification.unifyProfiles(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error unifying profiles', { error });
    res.status(500).json({ success: false, error: 'Failed to unify profiles' });
  }
});

app.post('/unify/preview', async (req: Request, res: Response) => {
  try {
    const preview = await profileUnification.previewMerge(req.body);
    res.json({ success: true, data: preview });
  } catch (error) {
    logger.error('Error previewing merge', { error });
    res.status(500).json({ success: false, error: 'Failed to preview merge' });
  }
});

app.post('/unify/revert/:mergeId', async (req: Request, res: Response) => {
  try {
    const result = await profileUnification.revertMerge(req.params.mergeId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error reverting merge', { error, mergeId: req.params.mergeId });
    res.status(500).json({ success: false, error: 'Failed to revert merge' });
  }
});

app.get('/unify/history/:profileId', async (req: Request, res: Response) => {
  try {
    const history = await profileUnification.getMergeHistory(req.params.profileId);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Error fetching merge history', { error, profileId: req.params.profileId });
    res.status(500).json({ success: false, error: 'Failed to fetch merge history' });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.headers['x-request-id']
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.headers['x-request-id']
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path
  });
});

// Start server
const PORT = process.env.PORT || 3005;
const server = app.listen(PORT, () => {
  logger.info(`REZ CDP Service started on port ${PORT}`);
  logger.info('Available routes:', {
    profiles: '/profiles, /profiles/:id, /profiles/search',
    identity: '/identity/resolve, /identity/link, /identity/graph',
    activities: '/activities, /activities/:profileId',
    segments: '/segments, /segments/:id, /segments/:id/evaluate',
    unification: '/unify, /unify/preview, /unify/history/:profileId'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, profileManager, identityResolver, activityTracker, segmentationEngine, profileUnification };
