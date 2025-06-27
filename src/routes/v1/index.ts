import express from 'express';
import { ping } from '../../controllers';
import projectRoutes from './project-routes'; // Add this import
import { test } from '../../controllers/db-controller';
import authRoutes from './auth-routes'; // Import auth routes
import  fileRoutes from './file-routes'; // Import file routes

const router = express.Router();

router.use('/ping', ping);
router.use('/projects', projectRoutes);
router.use('/test',test) // Use the imported router
router.use('/auth',authRoutes)
router.use('/files',fileRoutes)

export default router;