import { pool } from '../db.js';
import { getNextEntryNumber } from '../services/accountingService.js';
import * as auditService from '../services/accountingAuditService.js';

// Ensure audit table exists on startup
auditService.ensureAuditTable().catch(e => console.warn('[JOURNAL] Could not ensure audit table:', e.message));

/**
 * List journal entries
 * GET /api/journal
 */
export async function list(req, res) {
  try {
    console.log('[JOURNAL] GET /api/journal - Starting request');
    const {
      status, page = 1, pageSize = 20, from, to, type, source,
      reference_prefix, search, account_id, account_ids, accounts_scope,
      min_amount, max_amount, outliersOnly, outliers_threshold,
      unbalancedOnly, summary, period, quarter, preset
    } = req.query || {};
    
    let query = `
      SELECT je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, 
             je.status, je.created_at, je.branch, je.period, je.posted_at,
             COALESCE(SUM(jp.debit), 0) as total_debit,
             COALESCE(SUM(jp.credit), 0) as total_credit
      FROM journal_entries je
      LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND je.status = $${paramIndex++}`;
      params.push(status);
    }
    
    // Handle preset periods
    let effectiveFrom = from;
    let effectiveTo = to;
    if (preset) {
      const now = new Date();
      switch (preset) {
        case 'today':
          effectiveFrom = now.toISOString().slice(0, 10);
          effectiveTo = now.toISOString().slice(0, 10);
          break;
        case 'this_week':
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - dayOfWeek);
          effectiveFrom = startOfWeek.toISOString().slice(0, 10);
          effectiveTo = now.toISOString().slice(0, 10);
          break;
        case 'this_month':
          effectiveFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          effectiveTo = now.toISOString().slice(0, 10);
          break;
        case 'this_year':
          effectiveFrom = `${now.getFullYear()}-01-01`;
          effectiveTo = now.toISOString().slice(0, 10);
          break;
      }
    }
    
    if (effectiveFrom) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(effectiveFrom);
    }
    if (effectiveTo) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(effectiveTo);
    }
    if (search) {
      query += ` AND (je.description ILIKE $${paramIndex++} OR je.entry_number::text LIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (reference_prefix) {
      query += ` AND je.description ILIKE $${paramIndex++}`;
      params.push(`%${reference_prefix}%`);
    }
    if (type) {
      query += ` AND je.reference_type = $${paramIndex++}`;
      params.push(type);
    }
    if (period) {
      query += ` AND je.period = $${paramIndex++}`;
      params.push(period);
    }
    if (quarter) {
      const year = new Date().getFullYear();
      const quarterMap = {
        'Q1': { from: `${year}-01-01`, to: `${year}-03-31` },
        'Q2': { from: `${year}-04-01`, to: `${year}-06-30` },
        'Q3': { from: `${year}-07-01`, to: `${year}-09-30` },
        'Q4': { from: `${year}-10-01`, to: `${year}-12-31` }
      };
      if (quarterMap[quarter]) {
        query += ` AND je.date >= $${paramIndex++} AND je.date <= $${paramIndex++}`;
        params.push(quarterMap[quarter].from, quarterMap[quarter].to);
      }
    }
    
    // Filter by account_ids
    if (account_ids) {
      const ids = String(account_ids).split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        query += ` AND je.id IN (SELECT DISTINCT journal_entry_id FROM journal_postings WHERE account_id = ANY($${paramIndex++}))`;
        params.push(ids);
      }
    } else if (account_id) {
      query += ` AND je.id IN (SELECT DISTINCT journal_entry_id FROM journal_postings WHERE account_id = $${paramIndex++})`;
      params.push(Number(account_id));
    }
    
    query += ` GROUP BY je.id, je.entry_number, je.description, je.date, je.reference_type, je.reference_id, je.status, je.created_at, je.branch, je.period, je.posted_at`;
    
    // Filter by amount range (after aggregation)
    if (min_amount || max_amount) {
      query += ` HAVING 1=1`;
      if (min_amount) {
        query += ` AND GREATEST(COALESCE(SUM(jp.debit), 0), COALESCE(SUM(jp.credit), 0)) >= $${paramIndex++}`;
        params.push(parseFloat(min_amount));
      }
      if (max_amount) {
        query += ` AND GREATEST(COALESCE(SUM(jp.debit), 0), COALESCE(SUM(jp.credit), 0)) <= $${paramIndex++}`;
        params.push(parseFloat(max_amount));
      }
    }
    
    // Filter unbalanced entries
    if (unbalancedOnly === 'true') {
      if (!min_amount && !max_amount) {
        query += ` HAVING ABS(COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0)) > 0.01`;
      } else {
        query += ` AND ABS(COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0)) > 0.01`;
      }
    }
    
    // Order and paginate
    query += ` ORDER BY je.date DESC, je.entry_number DESC`;
    
    // Add pagination
    const limit = Math.min(parseInt(pageSize, 10) || 20, 500);
    const offset = ((parseInt(page, 10) || 1) - 1) * limit;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    
    // Load postings for each entry with account details
    const entryIds = (rows || []).map(r => r.id);
    let postingsMap = new Map();
    
    if (entryIds.length > 0) {
      const postingsQuery = `
        SELECT jp.*, 
               a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
        FROM journal_postings jp
        LEFT JOIN accounts a ON a.id = jp.account_id
        WHERE jp.journal_entry_id = ANY($1)
        ORDER BY jp.id
      `;
      const { rows: postingsRows } = await pool.query(postingsQuery, [entryIds]);
      
      // Group postings by journal_entry_id
      for (const p of postingsRows || []) {
        if (!postingsMap.has(p.journal_entry_id)) {
          postingsMap.set(p.journal_entry_id, []);
        }
        postingsMap.get(p.journal_entry_id).push({
          ...p,
          debit: Number(p.debit || 0),
          credit: Number(p.credit || 0),
          account: p.account_number || p.account_code ? {
            id: p.account_id,
            account_number: p.account_number,
            account_code: p.account_code,
            name: p.account_name,
            name_en: p.account_name_en,
            type: p.account_type
          } : null
        });
      }
    }
    
    // Calculate totals and add postings
    const items = (rows || []).map(row => ({
      ...row,
      total_debit: Number(row.total_debit || 0),
      total_credit: Number(row.total_credit || 0),
      debit: Number(row.total_debit || 0),
      credit: Number(row.total_credit || 0),
      postings: postingsMap.get(row.id) || []
    }));
    
    console.log('[JOURNAL] GET /api/journal - Returning', items.length, 'entries');
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('[JOURNAL] Error listing entries:', e?.message, e?.stack);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get single journal entry
 * GET /api/journal/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { rows: entryRows } = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      return res.status(404).json({ error: "not_found" });
    }
    
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, 
              a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1
       ORDER BY jp.id`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    console.error('[JOURNAL] Error getting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create journal entry
 * POST /api/journal
 */
export async function create(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const postings = Array.isArray(b.postings) ? b.postings : [];
    
    // Generate entry number (reuses deleted numbers)
    const entryNumber = await getNextEntryNumber();
    
    // Extract period from date (YYYY-MM format)
    const entryDate = b.date || new Date();
    const dateObj = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const period = dateObj.toISOString().slice(0, 7); // YYYY-MM
    
    // Create entry with period
    const { rows: entryRows } = await client.query(
      `INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        entryNumber,
        String(b.description || ''),
        entryDate,
        period,
        b.reference_type || null,
        b.reference_id || null,
        'draft',
        b.branch || null
      ]
    );
    
    const entry = entryRows[0];
    
    // Create postings
    for (const p of postings) {
      await client.query(
        `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [
          entry.id,
          Number(p.account_id || 0),
          Number(p.debit || 0),
          Number(p.credit || 0)
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Fetch with postings
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [entry.id]
    );
    
    // Log audit for creation
    auditService.logJournalCreate(req, entry, postingsRows).catch(e => console.warn('[JOURNAL] Audit log failed:', e.message));
    
    res.json({
      ...entry,
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error creating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Update journal entry (draft only)
 * PUT /api/journal/:id
 */
export async function update(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    
    // Verify entry exists and is a draft
    const { rows: existingRows } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!existingRows || !existingRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", message: "Journal entry not found" });
    }
    if (existingRows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_status", message: "Only draft entries can be updated" });
    }
    
    // Update entry
    const entryDate = b.date || existingRows[0].date;
    const dateObj = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const period = dateObj.toISOString().slice(0, 7);
    
    await client.query(
      `UPDATE journal_entries SET description = COALESCE($1, description), date = COALESCE($2, date), period = $3, updated_at = NOW() WHERE id = $4`,
      [b.description || null, entryDate, period, id]
    );
    
    // Update postings if provided
    if (Array.isArray(b.postings)) {
      // Delete old postings
      await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [id]);
      
      // Create new postings
      for (const p of b.postings) {
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [id, Number(p.account_id || 0), Number(p.debit || 0), Number(p.credit || 0)]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch updated entry with postings
    const { rows: entryRows } = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [id]
    );
    
    res.json({
      ...entryRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error updating entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Post journal entry (draft → posted)
 * POST /api/journal/:id/post
 */
export async function postEntry(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    // Verify entry exists and is a draft
    const { rows: entryRows } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", message: "Journal entry not found" });
    }
    if (entryRows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_status", message: "Entry is not a draft" });
    }
    
    // Verify postings are balanced
    const { rows: balanceRows } = await client.query(
      `SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit
       FROM journal_postings WHERE journal_entry_id = $1`,
      [id]
    );
    const balance = balanceRows && balanceRows[0];
    const totalDebit = Number(balance?.total_debit || 0);
    const totalCredit = Number(balance?.total_credit || 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: "unbalanced_entry", 
        message: "Entry is not balanced",
        details: { debit: totalDebit, credit: totalCredit, difference: totalDebit - totalCredit }
      });
    }
    
    // Post the entry
    await client.query(
      `UPDATE journal_entries SET status = 'posted', posted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    
    // Fetch updated entry with postings
    const { rows: updatedRows } = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [id]
    );
    
    // Log audit
    auditService.logJournalPost(req, updatedRows[0]).catch(e => console.warn('[JOURNAL] Audit log failed:', e.message));
    
    res.json({
      ...updatedRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error posting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Return to draft (posted → draft)
 * POST /api/journal/:id/return-to-draft
 */
export async function returnToDraft(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    // Verify entry exists and is posted
    const { rows: entryRows } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", message: "Journal entry not found" });
    }
    if (entryRows[0].status !== 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_status", message: "Entry is not posted" });
    }
    
    // Return to draft
    await client.query(
      `UPDATE journal_entries SET status = 'draft', posted_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    
    // Fetch updated entry with postings
    const { rows: updatedRows } = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [id]
    );
    
    // Log audit
    auditService.logJournalReturnToDraft(req, updatedRows[0]).catch(e => console.warn('[JOURNAL] Audit log failed:', e.message));
    
    res.json({
      ...updatedRows[0],
      postings: (postingsRows || []).map(p => ({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error returning to draft:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Reverse journal entry (create reversing entry)
 * POST /api/journal/:id/reverse
 */
export async function reverse(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    // Verify entry exists and is posted
    const { rows: entryRows } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", message: "Journal entry not found" });
    }
    if (entryRows[0].status !== 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_status", message: "Only posted entries can be reversed" });
    }
    
    const originalEntry = entryRows[0];
    
    // Get original postings
    const { rows: postingsRows } = await client.query(
      'SELECT * FROM journal_postings WHERE journal_entry_id = $1',
      [id]
    );
    
    // Generate new entry number
    const entryNumber = await getNextEntryNumber();
    const now = new Date();
    const period = now.toISOString().slice(0, 7);
    
    // Create reversing entry
    const { rows: newEntryRows } = await client.query(
      `INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status, posted_at, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        entryNumber,
        `عكس قيد #${originalEntry.entry_number} - ${originalEntry.description || ''}`,
        now,
        period,
        'reversal',
        id, // Reference to original entry
        'posted',
        now,
        originalEntry.branch
      ]
    );
    
    const newEntry = newEntryRows[0];
    
    // Create reversed postings (swap debit/credit)
    for (const p of postingsRows || []) {
      await client.query(
        `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [newEntry.id, p.account_id, Number(p.credit || 0), Number(p.debit || 0)]
      );
    }
    
    // Mark original entry as reversed
    await client.query(
      `UPDATE journal_entries SET status = 'reversed', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    
    await client.query('COMMIT');
    
    // Fetch new entry with postings
    const { rows: newPostingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = $1`,
      [newEntry.id]
    );
    
    // Log audit for reversal
    auditService.logJournalReverse(req, originalEntry, newEntry).catch(e => console.warn('[JOURNAL] Audit log failed:', e.message));
    
    res.json({
      originalEntry: {
        id: originalEntry.id,
        entry_number: originalEntry.entry_number,
        status: 'reversed'
      },
      reversingEntry: {
        ...newEntry,
        postings: (newPostingsRows || []).map(p => ({
          ...p,
          debit: Number(p.debit || 0),
          credit: Number(p.credit || 0),
          account: p.account_number || p.account_code ? {
            id: p.account_id,
            account_number: p.account_number,
            account_code: p.account_code,
            name: p.account_name,
            name_en: p.account_name_en,
            type: p.account_type
          } : null
        }))
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error reversing entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Delete journal entry
 * DELETE /api/journal/:id
 */
export async function remove(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    const { password, reason } = req.query || {};
    
    // Verify entry exists
    const { rows: entryRows } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id]
    );
    if (!entryRows || !entryRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", message: "Journal entry not found" });
    }
    
    // Only draft entries can be deleted without special permission
    if (entryRows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_status", message: "Only draft entries can be deleted" });
    }
    
    const entryToDelete = entryRows[0];
    
    // Delete postings first (foreign key constraint)
    await client.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [id]);
    
    // Delete entry
    await client.query('DELETE FROM journal_entries WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    // Log audit for deletion
    auditService.logJournalDelete(req, entryToDelete).catch(e => console.warn('[JOURNAL] Audit log failed:', e.message));
    
    res.json({ ok: true, message: "Entry deleted successfully" });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[JOURNAL] Error deleting entry:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Get journal postings by account
 * GET /api/journal/account/:id
 */
export async function byAccount(req, res) {
  try {
    const accountId = Number(req.params.id || 0);
    const { page = 1, pageSize = 500, from, to } = req.query || {};
    const limit = Math.min(Number(pageSize) || 500, 1000);
    const offset = ((Number(page) || 1) - 1) * limit;
    
    let query = `
      SELECT jp.id, jp.journal_entry_id, jp.account_id, jp.debit, jp.credit,
             je.entry_number, je.description, je.date, je.status,
             a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en
      FROM journal_postings jp
      JOIN journal_entries je ON je.id = jp.journal_entry_id
      LEFT JOIN accounts a ON a.id = jp.account_id
      WHERE jp.account_id = $1 AND je.status = 'posted'
    `;
    const params = [accountId];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND je.date >= $${paramIndex++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex++}`;
      params.push(to);
    }
    
    query += ` ORDER BY je.date ASC, je.entry_number ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    
    const items = (rows || []).map(row => ({
      id: row.id,
      journal_entry_id: row.journal_entry_id,
      account_id: row.account_id,
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      journal: {
        entry_number: row.entry_number,
        description: row.description,
        date: row.date,
        status: row.status
      },
      account: {
        account_number: row.account_number,
        account_code: row.account_code,
        name: row.account_name,
        name_en: row.account_name_en
      }
    }));
    
    res.json(items);
  } catch (e) {
    console.error('[JOURNAL] Error getting account journal:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Find journal entries by related reference
 * GET /api/journal/by-related/search
 */
export async function findByRelated(req, res) {
  try {
    const { reference_type, reference_id } = req.query || {};
    
    if (!reference_type || !reference_id) {
      return res.status(400).json({ error: "missing_params", message: "reference_type and reference_id are required" });
    }
    
    const { rows } = await pool.query(
      `SELECT je.*, 
              COALESCE(SUM(jp.debit), 0) as total_debit,
              COALESCE(SUM(jp.credit), 0) as total_credit
       FROM journal_entries je
       LEFT JOIN journal_postings jp ON jp.journal_entry_id = je.id
       WHERE je.reference_type = $1 AND je.reference_id = $2
       GROUP BY je.id
       ORDER BY je.date DESC, je.entry_number DESC`,
      [reference_type, reference_id]
    );
    
    if (!rows || rows.length === 0) {
      return res.json({ items: [] });
    }
    
    // Load postings for each entry
    const entryIds = rows.map(r => r.id);
    const { rows: postingsRows } = await pool.query(
      `SELECT jp.*, a.account_number, a.account_code, a.name as account_name, a.name_en as account_name_en, a.type as account_type
       FROM journal_postings jp
       LEFT JOIN accounts a ON a.id = jp.account_id
       WHERE jp.journal_entry_id = ANY($1)`,
      [entryIds]
    );
    
    const postingsMap = new Map();
    for (const p of postingsRows || []) {
      if (!postingsMap.has(p.journal_entry_id)) {
        postingsMap.set(p.journal_entry_id, []);
      }
      postingsMap.get(p.journal_entry_id).push({
        ...p,
        debit: Number(p.debit || 0),
        credit: Number(p.credit || 0),
        account: p.account_number || p.account_code ? {
          id: p.account_id,
          account_number: p.account_number,
          account_code: p.account_code,
          name: p.account_name,
          name_en: p.account_name_en,
          type: p.account_type
        } : null
      });
    }
    
    const items = rows.map(row => ({
      ...row,
      total_debit: Number(row.total_debit || 0),
      total_credit: Number(row.total_credit || 0),
      postings: postingsMap.get(row.id) || []
    }));
    
    res.json({ items });
  } catch (e) {
    console.error('[JOURNAL] Error finding by related:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
