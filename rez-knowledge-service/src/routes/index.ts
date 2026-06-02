// REZ Knowledge Service - Routes Index

import { Router } from 'express';
import profileRoutes from './profileRoutes';
import preferencesRoutes from './preferencesRoutes';
import signalRoutes from './signalRoutes';
import personalizationRoutes from './personalizationRoutes';
import historyRoutes from './historyRoutes';
import healthRoutes from './healthRoutes';

const router = Router();

// Health check routes (no auth required)
router.use('/', healthRoutes);

// Profile routes - unified user profile across ALL apps
router.use('/profile', profileRoutes);

// Preferences routes - preferences for ALL apps
router.use('/preferences', preferencesRoutes);

// Signal routes - signal collection from ALL apps
router.use('/signal', signalRoutes);

// Personalization routes - unified personalization
router.use('/personalization', personalizationRoutes);

// History routes - user history across ALL apps
router.use('/history', historyRoutes);

export default router;
