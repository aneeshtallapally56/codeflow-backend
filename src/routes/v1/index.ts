import express from 'express';
import { ping } from '../../controllers';
import projectRoutes from './project-routes'; // Add this import

const router = express.Router();

router.use('/ping', ping);
router.use('/projects', projectRoutes); // Use the imported router

export default router;