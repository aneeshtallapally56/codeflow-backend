import express from 'express';
import { createProject, getProjectTree } from '../../controllers/project-controller'; 
import auth from '../../middlewares/auth';

const router = express.Router();

router.post('/create-project',auth, createProject); 
router.get('/:projectId/tree',getProjectTree)

export default router;