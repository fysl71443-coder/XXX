/**
 * Fiscal Years Routes
 * مسارات السنوات المالية
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as fiscalYearController from '../controllers/fiscalYearController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ===== Public endpoints (all authenticated users) =====
// These are needed by all users to know if they can create entries

// Get current fiscal year - public (needed for all accounting screens)
router.get('/current', fiscalYearController.getCurrent);

// Check if entries can be created - public (needed for all accounting screens)
router.get('/can-create', fiscalYearController.canCreate);

// Get fiscal year for a specific date - public
router.get('/for-date', fiscalYearController.getForDate);

// Get notifications - public (for all users to see alerts)
router.get('/notifications', fiscalYearController.getNotifications);

// Compare fiscal years - public (for reports)
router.get('/compare', fiscalYearController.compareYears);

// ===== Protected endpoints (require fiscal_years permissions) =====

// List all fiscal years - view permission
router.get('/', authorize('fiscal_years', 'view'), fiscalYearController.list);

// Get fiscal year by ID or year - view permission
router.get('/:id', authorize('fiscal_years', 'view'), fiscalYearController.get);

// Get fiscal year statistics - view permission
router.get('/:id/stats', authorize('fiscal_years', 'view'), fiscalYearController.getStats);

// Get fiscal year activities - view permission
router.get('/:id/activities', authorize('fiscal_years', 'view'), fiscalYearController.getActivities);

// Get year-end checklist - view permission
router.get('/:id/checklist', authorize('fiscal_years', 'view'), fiscalYearController.getChecklist);

// Create new fiscal year - create permission
router.post('/', authorize('fiscal_years', 'create'), fiscalYearController.create);

// Open fiscal year - edit permission
router.post('/:id/open', authorize('fiscal_years', 'edit'), fiscalYearController.openYear);

// Close fiscal year - edit permission
router.post('/:id/close', authorize('fiscal_years', 'edit'), fiscalYearController.closeYear);

// Temporary open - edit permission
router.post('/:id/temporary-open', authorize('fiscal_years', 'edit'), fiscalYearController.temporaryOpen);

// Close temporary opening - edit permission
router.post('/:id/temporary-close', authorize('fiscal_years', 'edit'), fiscalYearController.temporaryClose);

// Rollover fiscal year - edit permission
router.post('/:id/rollover', authorize('fiscal_years', 'edit'), fiscalYearController.rollover);

export default router;
