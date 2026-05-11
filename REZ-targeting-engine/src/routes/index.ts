import { Router } from 'express';
import campaignRoutes from './campaigns';
import templateRoutes from './templates';
import segmentRoutes from './segments';
import healthRoutes from './health';

const router = Router();

router.use('/campaigns', campaignRoutes);
router.use('/templates', templateRoutes);
router.use('/segments', segmentRoutes);
router.use('/health', healthRoutes);

export default router;
