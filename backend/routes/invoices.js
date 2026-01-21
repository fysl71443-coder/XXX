import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { checkAccountingPeriod } from '../middleware/checkAccountingPeriod.js';
import * as invoiceController from '../controllers/invoiceController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// DEBUG: Test route without middleware to isolate the issue
router.get('/next-number', (req, res, next) => {
  console.log('🟢 HIT next-number route ONLY');
  console.log('[DEBUG PATH]', {
    path: req.path,
    url: req.url,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: {
      'x-branch': req.headers['x-branch'],
      'x-branch-id': req.headers['x-branch-id'],
      'authorization': req.headers['authorization'] ? 'present' : 'missing'
    },
    user: req.user ? {
      id: req.user.id,
      branch_id: req.user.branch_id,
      default_branch: req.user.default_branch
    } : null
  });
  next();
}, authorize('sales', 'create'), invoiceController.nextNumber);

// List invoices
router.get('/', 
  authorize('sales', 'view', { branchFrom: req => (req.query.branch || null) }), 
  invoiceController.list
);

// Get single invoice - ONLY numeric IDs (regex prevents /next-number from matching)
router.get('/:id(\\d+)', 
  authorize('sales', 'view'), 
  invoiceController.get
);

// Create invoice
router.post('/', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  checkAccountingPeriod(),
  invoiceController.create
);

// Update invoice - ONLY numeric IDs
router.put('/:id(\\d+)', 
  authorize('sales', 'edit', { branchFrom: req => (req.body?.branch || null) }), 
  invoiceController.update
);

// Delete invoice - ONLY numeric IDs
router.delete('/:id(\\d+)', 
  authorize('sales', 'delete'), 
  invoiceController.remove
);

export default router;
