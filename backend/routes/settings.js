import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { isAdminUser } from '../utils/auth.js';
import * as settingsController from '../controllers/settingsController.js';

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

// List settings
router.get('/', requireAdmin, settingsController.list);

// Get single setting
router.get('/:key', requireAdmin, settingsController.get);

// Update setting
router.put('/:key', requireAdmin, settingsController.update);

// Backup settings
router.post('/backup', requireAdmin, settingsController.backup);

// Restore settings
router.post('/restore', requireAdmin, settingsController.restore);

export default router;
