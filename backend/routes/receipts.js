/**
 * Receipts Routes
 * مسارات الإيصالات المطبوعة
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as receiptController from '../controllers/receiptController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get receipt statistics
router.get('/stats', authorize('sales', 'view'), receiptController.stats);

// List all printed receipts
router.get('/', authorize('sales', 'view'), receiptController.list);

// Get single receipt
router.get('/:id', authorize('sales', 'view'), receiptController.get);

// Mark order as printed
router.post('/:id/mark-printed', authorize('sales', 'edit'), receiptController.markPrinted);

export default router;
