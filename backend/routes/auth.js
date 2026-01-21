import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Login endpoint (no auth required)
router.post('/login', authController.login);

// Get current user
router.get('/me', authenticateToken, authController.me);

export default router;
