/**
 * Import Routes
 * مسارات استيراد البيانات
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as importController from '../controllers/importController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validate import data - view permission
router.post('/validate', authorize('data_import', 'view'), importController.validateImport);

// Import journal entries - create permission
router.post('/journal', authorize('data_import', 'create'), importController.importJournal);

// Import invoices - create permission
router.post('/invoices', authorize('data_import', 'create'), importController.importInvoices);

// Import expenses - create permission
router.post('/expenses', authorize('data_import', 'create'), importController.importExpenses);

export default router;
