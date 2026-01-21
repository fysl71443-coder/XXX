/**
 * Accounting Audit Service
 * خدمة تدقيق العمليات المحاسبية
 * 
 * يسجل: من عدّل؟ متى؟ قبل/بعد؟
 */

import { pool } from '../db.js';

/**
 * إنشاء جدول التدقيق المحاسبي (إن لم يكن موجوداً)
 */
export async function ensureAuditTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounting_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER,
        period VARCHAR(10),
        old_data JSONB,
        new_data JSONB,
        changes JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // إنشاء الفهارس
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acc_audit_user_id ON accounting_audit_log(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acc_audit_entity ON accounting_audit_log(entity_type, entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acc_audit_action ON accounting_audit_log(action)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acc_audit_created ON accounting_audit_log(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_acc_audit_period ON accounting_audit_log(period)`);
    
    console.log('[AUDIT] Accounting audit table ensured');
    return true;
  } catch (e) {
    console.error('[AUDIT] Error ensuring audit table:', e);
    return false;
  }
}

/**
 * تسجيل عملية في سجل التدقيق
 * 
 * @param {Object} params
 * @param {number} params.userId - معرف المستخدم
 * @param {string} params.userName - اسم المستخدم
 * @param {string} params.action - نوع العملية (create, update, delete, post, reverse, etc.)
 * @param {string} params.entityType - نوع الكيان (journal_entry, journal_posting, account, etc.)
 * @param {number} params.entityId - معرف الكيان
 * @param {string} params.period - الفترة المحاسبية (YYYY-MM)
 * @param {Object} params.oldData - البيانات القديمة (قبل التعديل)
 * @param {Object} params.newData - البيانات الجديدة (بعد التعديل)
 * @param {string} params.ipAddress - عنوان IP
 * @param {string} params.userAgent - متصفح المستخدم
 * @param {Object} params.details - تفاصيل إضافية
 */
export async function logAudit({
  userId,
  userName,
  action,
  entityType,
  entityId,
  period,
  oldData,
  newData,
  ipAddress,
  userAgent,
  details
}) {
  try {
    // حساب التغييرات
    const changes = calculateChanges(oldData, newData);
    
    await pool.query(
      `INSERT INTO accounting_audit_log (
        user_id, user_name, action, entity_type, entity_id, period,
        old_data, new_data, changes, ip_address, user_agent, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        userId || null,
        userName || null,
        action,
        entityType,
        entityId || null,
        period || null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        changes ? JSON.stringify(changes) : null,
        ipAddress || null,
        userAgent || null,
        details ? JSON.stringify(details) : null
      ]
    );
    
    console.log(`[AUDIT] Logged: ${action} on ${entityType} #${entityId} by user #${userId}`);
    return true;
  } catch (e) {
    console.error('[AUDIT] Error logging audit:', e);
    return false;
  }
}

/**
 * حساب التغييرات بين البيانات القديمة والجديدة
 */
function calculateChanges(oldData, newData) {
  if (!oldData && !newData) return null;
  if (!oldData) return { type: 'created', fields: Object.keys(newData || {}) };
  if (!newData) return { type: 'deleted', fields: Object.keys(oldData || {}) };
  
  const changes = {
    type: 'updated',
    modified: [],
    added: [],
    removed: []
  };
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    
    if (oldVal === undefined && newVal !== undefined) {
      changes.added.push({ field: key, value: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.removed.push({ field: key, value: oldVal });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.modified.push({ field: key, from: oldVal, to: newVal });
    }
  }
  
  if (changes.modified.length === 0 && changes.added.length === 0 && changes.removed.length === 0) {
    return null;
  }
  
  return changes;
}

/**
 * تسجيل إنشاء قيد محاسبي
 */
export async function logJournalCreate(req, entry, postings) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'create',
    entityType: 'journal_entry',
    entityId: entry.id,
    period: entry.period,
    oldData: null,
    newData: {
      entry_number: entry.entry_number,
      description: entry.description,
      date: entry.date,
      status: entry.status,
      branch: entry.branch,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      postings_count: postings?.length || 0,
      total_debit: postings?.reduce((sum, p) => sum + Number(p.debit || 0), 0) || 0,
      total_credit: postings?.reduce((sum, p) => sum + Number(p.credit || 0), 0) || 0
    },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { source: 'api', postings }
  });
}

/**
 * تسجيل تعديل قيد محاسبي
 */
export async function logJournalUpdate(req, oldEntry, newEntry, oldPostings, newPostings) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'update',
    entityType: 'journal_entry',
    entityId: newEntry.id,
    period: newEntry.period,
    oldData: {
      description: oldEntry.description,
      date: oldEntry.date,
      status: oldEntry.status,
      postings_count: oldPostings?.length || 0,
      total_debit: oldPostings?.reduce((sum, p) => sum + Number(p.debit || 0), 0) || 0,
      total_credit: oldPostings?.reduce((sum, p) => sum + Number(p.credit || 0), 0) || 0
    },
    newData: {
      description: newEntry.description,
      date: newEntry.date,
      status: newEntry.status,
      postings_count: newPostings?.length || 0,
      total_debit: newPostings?.reduce((sum, p) => sum + Number(p.debit || 0), 0) || 0,
      total_credit: newPostings?.reduce((sum, p) => sum + Number(p.credit || 0), 0) || 0
    },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { 
      old_postings: oldPostings?.map(p => ({ account_id: p.account_id, debit: p.debit, credit: p.credit })),
      new_postings: newPostings?.map(p => ({ account_id: p.account_id, debit: p.debit, credit: p.credit }))
    }
  });
}

/**
 * تسجيل نشر قيد محاسبي
 */
export async function logJournalPost(req, entry) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'post',
    entityType: 'journal_entry',
    entityId: entry.id,
    period: entry.period,
    oldData: { status: 'draft' },
    newData: { status: 'posted', posted_at: new Date().toISOString() },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { entry_number: entry.entry_number }
  });
}

/**
 * تسجيل عكس قيد محاسبي
 */
export async function logJournalReverse(req, originalEntry, reversingEntry) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'reverse',
    entityType: 'journal_entry',
    entityId: originalEntry.id,
    period: originalEntry.period,
    oldData: { status: 'posted' },
    newData: { status: 'reversed' },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { 
      original_entry_number: originalEntry.entry_number,
      reversing_entry_id: reversingEntry.id,
      reversing_entry_number: reversingEntry.entry_number,
      reason: req.body?.reason || 'User requested reversal'
    }
  });
}

/**
 * تسجيل إرجاع قيد للمسودة
 */
export async function logJournalReturnToDraft(req, entry) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'return_to_draft',
    entityType: 'journal_entry',
    entityId: entry.id,
    period: entry.period,
    oldData: { status: 'posted' },
    newData: { status: 'draft' },
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { 
      entry_number: entry.entry_number,
      reason: req.body?.reason || 'User requested return to draft'
    }
  });
}

/**
 * تسجيل حذف قيد محاسبي
 */
export async function logJournalDelete(req, entry) {
  return logAudit({
    userId: req.user?.id,
    userName: req.user?.username || req.user?.name,
    action: 'delete',
    entityType: 'journal_entry',
    entityId: entry.id,
    period: entry.period,
    oldData: {
      entry_number: entry.entry_number,
      description: entry.description,
      date: entry.date,
      status: entry.status,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id
    },
    newData: null,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    details: { reason: req.body?.reason || 'User requested deletion' }
  });
}

/**
 * تسجيل قفل/فتح فترة محاسبية
 */
export async function logPeriodStatusChange(req, period, oldStatus, newStatus, closedBy = null) {
  return logAudit({
    userId: req?.user?.id || closedBy,
    userName: req?.user?.username || req?.user?.name,
    action: newStatus === 'closed' ? 'close_period' : 'open_period',
    entityType: 'accounting_period',
    entityId: null,
    period: period,
    oldData: { status: oldStatus },
    newData: { status: newStatus },
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent'],
    details: { 
      period: period,
      reason: req?.body?.reason || (newStatus === 'closed' ? 'Period closed' : 'Period reopened')
    }
  });
}

/**
 * جلب سجل التدقيق لكيان معين
 */
export async function getAuditLog(entityType, entityId, limit = 50) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM accounting_audit_log 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [entityType, entityId, limit]
    );
    return rows || [];
  } catch (e) {
    console.error('[AUDIT] Error fetching audit log:', e);
    return [];
  }
}

/**
 * جلب سجل التدقيق لفترة معينة
 */
export async function getAuditLogByPeriod(period, limit = 100) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM accounting_audit_log 
       WHERE period = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [period, limit]
    );
    return rows || [];
  } catch (e) {
    console.error('[AUDIT] Error fetching audit log by period:', e);
    return [];
  }
}

/**
 * جلب سجل التدقيق لمستخدم معين
 */
export async function getAuditLogByUser(userId, limit = 100) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM accounting_audit_log 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return rows || [];
  } catch (e) {
    console.error('[AUDIT] Error fetching audit log by user:', e);
    return [];
  }
}

/**
 * جلب سجل التدقيق مع التصفية
 */
export async function searchAuditLog({
  entityType,
  entityId,
  action,
  userId,
  period,
  fromDate,
  toDate,
  page = 1,
  pageSize = 50
}) {
  try {
    let query = 'SELECT * FROM accounting_audit_log WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(entityType);
    }
    if (entityId) {
      query += ` AND entity_id = $${paramIndex++}`;
      params.push(entityId);
    }
    if (action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(action);
    }
    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }
    if (period) {
      query += ` AND period = $${paramIndex++}`;
      params.push(period);
    }
    if (fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(toDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const limit = Math.min(pageSize, 200);
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    return rows || [];
  } catch (e) {
    console.error('[AUDIT] Error searching audit log:', e);
    return [];
  }
}

// تصدير الدوال
export default {
  ensureAuditTable,
  logAudit,
  logJournalCreate,
  logJournalUpdate,
  logJournalPost,
  logJournalReverse,
  logJournalReturnToDraft,
  logJournalDelete,
  logPeriodStatusChange,
  getAuditLog,
  getAuditLogByPeriod,
  getAuditLogByUser,
  searchAuditLog
};
