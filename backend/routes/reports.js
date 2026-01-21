import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as reportController from '../controllers/reportController.js';

const router = express.Router();

// Apply authentication and authorization to all routes
router.use(authenticateToken);
router.use(authorize('reports', 'view'));

// Trial balance report
router.get('/trial-balance', reportController.trialBalance);

// Sales vs expenses report
router.get('/sales-vs-expenses', reportController.salesVsExpenses);

// Sales by branch report
router.get('/sales-by-branch', reportController.salesByBranch);

// Expenses by branch report
router.get('/expenses-by-branch', reportController.expensesByBranch);

export default router;
