import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as partnerController from '../controllers/partnerController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// List partners
router.get('/', partnerController.list);

// Get single partner
router.get('/:id', partnerController.get);

// Create partner
router.post('/', 
  authorize('clients', 'create'), 
  partnerController.create
);

// Update partner
router.put('/:id', 
  authorize('clients', 'edit'), 
  partnerController.update
);

// Delete partner (soft delete)
router.delete('/:id', 
  authorize('clients', 'delete'), 
  partnerController.remove
);

// Balance endpoint
router.get('/:id/balance', partnerController.balance);

// Statement endpoint
router.get('/:id/statement', partnerController.statement);

export default router;
