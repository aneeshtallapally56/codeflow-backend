import express from 'express';
import { createProject, deleteProject, getProjectById, getProjectTree , getUserProjects,joinProject, leaveProject } from '../../controllers/project-controller'; 
import auth from '../../middlewares/auth';

import { checkProjectAccess } from '../../middlewares/projectAccess';

const router = express.Router();

router.post('/create-project',auth, createProject); 
router.get('/:projectId/tree',auth , checkProjectAccess,getProjectTree)
router.get('/',auth,getUserProjects);
router.delete('/:projectId',auth,deleteProject)
router.get('/:projectId', auth, checkProjectAccess, getProjectById);


router.post('/join', auth, joinProject);
router.post('/leave',auth,leaveProject)
export default router;