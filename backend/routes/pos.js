import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { checkAccountingPeriod } from '../middleware/checkAccountingPeriod.js';
import * as posController from '../controllers/posController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get tables layout
router.get('/tables-layout', posController.getTablesLayout);

// Save tables layout
router.put('/tables-layout', 
  authorize('sales', 'edit'), 
  posController.putTablesLayout
);

// Get table state (busy tables)
router.get('/table-state', posController.getTableState);

// Verify cancel password
router.post('/verify-cancel', posController.verifyCancel);

// Save draft order
router.post('/save-draft', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  posController.saveDraft
);

// Legacy endpoint
router.post('/saveDraft', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  posController.saveDraft
);

// Issue invoice from order
router.post('/issue-invoice', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  checkAccountingPeriod(),
  posController.issueInvoice
);

// Legacy endpoint
router.post('/issueInvoice', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || null) }), 
  checkAccountingPeriod(),
  posController.issueInvoice
);

export default router;
