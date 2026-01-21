/**
 * Accounting Audit Log Routes
 * مسارات سجل التدقيق المحاسبي
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import * as auditService from '../services/accountingAuditService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/audit/accounting
 * البحث في سجل التدقيق المحاسبي
 */
router.get('/accounting', authorize('audit', 'view'), async (req, res) => {
  try {
    const {
      entity_type,
      entity_id,
      action,
      user_id,
      period,
      from_date,
      to_date,
      page = 1,
      pageSize = 50
    } = req.query || {};
    
    const logs = await auditService.searchAuditLog({
      entityType: entity_type,
      entityId: entity_id ? Number(entity_id) : null,
      action,
      userId: user_id ? Number(user_id) : null,
      period,
      fromDate: from_date,
      toDate: to_date,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50
    });
    
    res.json({
      items: logs,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50
    });
  } catch (e) {
    console.error('[AUDIT API] Error searching audit log:', e);
    res.status(500).json({ error: 'server_error', details: e?.message || 'Unknown error' });
  }
});

/**
 * GET /api/audit/accounting/entry/:id
 * سجل التدقيق لقيد محاسبي معين
 */
router.get('/accounting/entry/:id', authorize('audit', 'view'), async (req, res) => {
  try {
    const entryId = Number(req.params.id || 0);
    const logs = await auditService.getAuditLog('journal_entry', entryId, 100);
    
    res.json({
      entity_type: 'journal_entry',
      entity_id: entryId,
      items: logs
    });
  } catch (e) {
    console.error('[AUDIT API] Error getting entry audit log:', e);
    res.status(500).json({ error: 'server_error', details: e?.message || 'Unknown error' });
  }
});

/**
 * GET /api/audit/accounting/period/:period
 * سجل التدقيق لفترة محاسبية معينة
 */
router.get('/accounting/period/:period', authorize('audit', 'view'), async (req, res) => {
  try {
    const period = req.params.period;
    const logs = await auditService.getAuditLogByPeriod(period, 200);
    
    res.json({
      period: period,
      items: logs
    });
  } catch (e) {
    console.error('[AUDIT API] Error getting period audit log:', e);
    res.status(500).json({ error: 'server_error', details: e?.message || 'Unknown error' });
  }
});

/**
 * GET /api/audit/accounting/user/:userId
 * سجل التدقيق لمستخدم معين
 */
router.get('/accounting/user/:userId', authorize('audit', 'view'), async (req, res) => {
  try {
    const userId = Number(req.params.userId || 0);
    const logs = await auditService.getAuditLogByUser(userId, 200);
    
    res.json({
      user_id: userId,
      items: logs
    });
  } catch (e) {
    console.error('[AUDIT API] Error getting user audit log:', e);
    res.status(500).json({ error: 'server_error', details: e?.message || 'Unknown error' });
  }
});

/**
 * GET /api/audit/accounting/actions
 * قائمة أنواع العمليات المتاحة
 */
router.get('/accounting/actions', authorize('audit', 'view'), async (req, res) => {
  res.json({
    actions: [
      { code: 'create', name_ar: 'إنشاء', name_en: 'Create' },
      { code: 'update', name_ar: 'تعديل', name_en: 'Update' },
      { code: 'delete', name_ar: 'حذف', name_en: 'Delete' },
      { code: 'post', name_ar: 'نشر', name_en: 'Post' },
      { code: 'reverse', name_ar: 'عكس', name_en: 'Reverse' },
      { code: 'return_to_draft', name_ar: 'إرجاع للمسودة', name_en: 'Return to Draft' },
      { code: 'close_period', name_ar: 'قفل فترة', name_en: 'Close Period' },
      { code: 'open_period', name_ar: 'فتح فترة', name_en: 'Open Period' },
      { code: 'period_override', name_ar: 'تجاوز قفل فترة', name_en: 'Period Override' }
    ],
    entity_types: [
      { code: 'journal_entry', name_ar: 'قيد محاسبي', name_en: 'Journal Entry' },
      { code: 'journal_posting', name_ar: 'ترحيل', name_en: 'Journal Posting' },
      { code: 'account', name_ar: 'حساب', name_en: 'Account' },
      { code: 'accounting_period', name_ar: 'فترة محاسبية', name_en: 'Accounting Period' }
    ]
  });
});

export default router;
