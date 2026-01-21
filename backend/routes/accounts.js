import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as accountController from '../controllers/accountController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// List accounts (tree structure)
router.get('/', 
  authorize('accounting', 'view'), 
  accountController.list
);

// Get single account
router.get('/:id', 
  authorize('accounting', 'view'), 
  accountController.get
);

// Create account
router.post('/', 
  authorize('accounting', 'create'), 
  accountController.create
);

// Update account
router.put('/:id', 
  authorize('accounting', 'edit'), 
  accountController.update
);

// Delete account
router.delete('/:id', 
  authorize('accounting', 'delete'), 
  accountController.remove
);

// Seed default accounts
router.post('/seed-default', 
  authorize('accounting', 'create'), 
  accountController.seedDefault
);

export default router;
