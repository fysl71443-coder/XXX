import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { isAdminUser } from '../utils/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Admin check middleware
function requireAdmin(req, res, next) {
  if (!req.user) {
    console.log(`[REQUIRE_ADMIN] REJECTED: No user`);
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!isAdminUser(req.user)) {
    console.log(`[REQUIRE_ADMIN] REJECTED: User ${req.user.id} is not admin`);
    return res.status(403).json({ error: "forbidden", details: "Admin access required" });
  }
  next();
}

// List users
router.get('/', requireAdmin, userController.list);

// Get single user
router.get('/:id', requireAdmin, userController.get);

// Create user
router.post('/', requireAdmin, userController.create);

// Update user
router.put('/:id', requireAdmin, userController.update);

// Toggle user active status
router.post('/:id/toggle', requireAdmin, userController.toggle);

// Reset user password
router.post('/:id/reset-password', requireAdmin, userController.resetPassword);

// Get user permissions
router.get('/:id/permissions', userController.getPermissions);

// Update user permissions
router.put('/:id/permissions', requireAdmin, userController.updatePermissions);

// Delete user
router.delete('/:id', requireAdmin, userController.remove);

export default router;
