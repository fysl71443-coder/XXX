import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { checkAccountingPeriod } from '../middleware/checkAccountingPeriod.js';
import * as expenseController from '../controllers/expenseController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// List expenses
router.get('/', expenseController.list);

// Get single expense
router.get('/:id', expenseController.get);

// Create expense
router.post('/', 
  authorize('expenses', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  checkAccountingPeriod(),
  expenseController.create
);

// Update expense
router.put('/:id', 
  authorize('expenses', 'edit', { branchFrom: req => (req.body?.branch || null) }), 
  checkAccountingPeriod(),
  expenseController.update
);

// Post expense (create journal entry)
router.post('/:id/post', 
  authorize('expenses', 'edit'), 
  checkAccountingPeriod(),
  expenseController.post
);

export default router;
