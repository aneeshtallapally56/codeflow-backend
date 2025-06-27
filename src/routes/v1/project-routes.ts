import express from 'express';
import { createProject, getProjectTree , getUserProjects} from '../../controllers/project-controller'; 
import auth from '../../middlewares/auth';
import { get } from 'node:http';

const router = express.Router();

router.post('/create-project',auth, createProject); 
router.get('/:projectId/tree',getProjectTree)
router.get('/',auth,getUserProjects);

export default router;