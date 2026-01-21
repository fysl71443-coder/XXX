import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as orderController from '../controllers/orderController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// List orders
router.get('/', 
  authorize('sales', 'view', { branchFrom: req => (req.query.branch || req.query.branch_code || req.body?.branch || req.body?.branch_code || null) }), 
  orderController.list
);

// Get single order
router.get('/:id', 
  authorize('sales', 'view'), 
  orderController.get
);

// Create order
router.post('/', 
  authorize('sales', 'create', { branchFrom: req => (req.body?.branch || req.body?.branch_code || null) }), 
  orderController.create
);

// Update order
router.put('/:id', 
  authorize('sales', 'edit', { branchFrom: req => (req.body?.branch || null) }), 
  orderController.update
);

// Delete order
router.delete('/:id', 
  authorize('sales', 'delete'), 
  orderController.remove
);

export default router;
