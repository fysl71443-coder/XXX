import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { checkAccountingPeriod } from '../middleware/checkAccountingPeriod.js';
import * as journalController from '../controllers/journalController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS (no period check required)
// ═══════════════════════════════════════════════════════════════════════════

// List journal entries
router.get('/', authorize('journal', 'view'), journalController.list);

// Get entries by account
router.get('/account/:id', authorize('journal', 'view'), journalController.byAccount);

// Search by related (invoice, expense, etc.)
router.get('/by-related/search', authorize('journal', 'view'), journalController.findByRelated);

// Get single journal entry
router.get('/:id', authorize('journal', 'view'), journalController.get);

// ═══════════════════════════════════════════════════════════════════════════
// CREATE OPERATIONS (period check with auto-create)
// ═══════════════════════════════════════════════════════════════════════════

// Create journal entry
router.post('/', 
  authorize('journal', 'create'), 
  checkAccountingPeriod({ action: 'create' }), 
  journalController.create
);

// ═══════════════════════════════════════════════════════════════════════════
// MODIFY OPERATIONS (period check required)
// ═══════════════════════════════════════════════════════════════════════════

// Update journal entry (draft only)
router.put('/:id', 
  authorize('journal', 'edit'), 
  checkAccountingPeriod({ action: 'edit' }), 
  journalController.update
);

// Post journal entry (draft → posted)
router.post('/:id/post', 
  authorize('journal', 'post'), 
  checkAccountingPeriod({ action: 'post' }), 
  journalController.postEntry
);

// ═══════════════════════════════════════════════════════════════════════════
// SENSITIVE OPERATIONS (period check with override permission option)
// ═══════════════════════════════════════════════════════════════════════════

// Return to draft (posted → draft) - requires special permission in closed periods
router.post('/:id/return-to-draft', 
  authorize('journal', 'edit'), 
  checkAccountingPeriod({ action: 'return_to_draft', allowWithPermission: true }), 
  journalController.returnToDraft
);

// Reverse journal entry - requires special permission in closed periods
// Note: 'journal.reverse' permission is required, plus 'journal.override_period' for closed periods
router.post('/:id/reverse', 
  authorize('journal', 'reverse'), 
  checkAccountingPeriod({ action: 'reverse', allowWithPermission: true }), 
  journalController.reverse
);

// Delete journal entry (draft only or with admin rights)
// Note: Period check happens inside controller for existing entries
router.delete('/:id', 
  authorize('journal', 'delete'), 
  journalController.remove
);

export default router;
