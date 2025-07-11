import express from 'express';

import { fixCode, generateResponse } from '../../controllers/ai-controller';
const router = express.Router();

router.post('/generate',generateResponse);
router.post('/fix', fixCode); 

export default router;