import express from 'express';
import { registerUser , loginUser , getCurrentUser , logoutUser } from '../../controllers/auth-controller';  
import auth from '../../middlewares/auth'
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', auth, getCurrentUser);
router.post('/logout', auth, logoutUser);

export default router;