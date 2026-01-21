import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as productController from '../controllers/productController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// List products
router.get('/', 
  authorize('products', 'view'), 
  productController.list
);

// Get single product
router.get('/:id', 
  authorize('products', 'view'), 
  productController.get
);

// Create product
router.post('/', 
  authorize('products', 'create'), 
  productController.create
);

// Update product
router.put('/:id', 
  authorize('products', 'edit'), 
  productController.update
);

// Delete product
router.delete('/:id', 
  authorize('products', 'delete'), 
  productController.remove
);

// Bulk import products
router.post('/bulk-import', 
  authorize('products', 'create'), 
  productController.bulkImport
);

export default router;
