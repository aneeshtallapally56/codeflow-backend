import express from 'express';
import { createProject, getProjectTree } from '../../controllers/project-controller'; 

const router = express.Router();

router.post('/create-project', createProject); 
router.get('/:projectId/tree',getProjectTree)

export default router;