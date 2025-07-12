import express from 'express';
import { ping } from '../../controllers';
import projectRoutes from './project-routes'; // Add this import
import { test } from '../../controllers/db-controller';
import authRoutes from './auth-routes'; // Import auth routes
import  fileRoutes from './file-routes'; // Import file routes
import aiRoutes from './ai-routes'


const router = express.Router();

router.use('/ping', ping);
router.use('/projects', projectRoutes);
router.use('/project', projectRoutes); 
router.get('/test', test); // Fixed: Use as route handler, not middleware
router.use('/auth',authRoutes)
router.use('/files',fileRoutes)
router.use('/ai',aiRoutes)

export default router;