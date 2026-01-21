import { pool } from '../db.js';
import { getOrCreatePartnerAccount } from '../services/accountingService.js';

/**
 * List partners
 * GET /api/partners
 */
export async function list(req, res) {
  try {
    const type = String(req.query?.type || "").toLowerCase();
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at FROM partners ORDER BY id DESC');
    const list = Array.isArray(rows) ? rows.map(r => ({ ...r, contact_info: r.contact_info || null })) : [];
    const filtered = list.filter(p => !type || String(p.type||"").toLowerCase() === type);
    res.json(filtered);
  } catch (e) { 
    res.json([]); 
  }
}

/**
 * Get single partner
 * GET /api/partners/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at, updated_at FROM partners WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Partner not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('[PARTNERS] Error getting partner:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create partner
 * POST /api/partners
 */
export async function create(req, res) {
  try {
    const b = req.body || {};
    const name = String(b.name||'').trim(); 
    const type = String(b.type||'customer').toLowerCase();
    const email = b.email || null; 
    const phone = b.phone || null;
    const customer_type = b.customer_type || null;
    const contact_info = b.contact_info ? (typeof b.contact_info === 'object' ? b.contact_info : null) : null;
    
    const { rows } = await pool.query(
      'INSERT INTO partners(name, type, email, phone, customer_type, contact_info) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
      [name, type, email, phone, customer_type, contact_info]
    );
    
    const partner = rows && rows[0];
    if (partner) {
      // Create account automatically for new partner
      const accountId = await getOrCreatePartnerAccount(partner.id, type);
      if (accountId) {
        const { rows: updatedRows } = await pool.query(
          'UPDATE partners SET account_id = $1 WHERE id = $2 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
          [accountId, partner.id]
        );
        if (updatedRows && updatedRows[0]) {
          return res.json(updatedRows[0]);
        }
      }
    }
    res.json(partner);
  } catch (e) { 
    console.error('[PARTNERS] Error creating partner:', e);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown" }); 
  }
}

/**
 * Update partner
 * PUT /api/partners/:id
 */
export async function update(req, res) {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE partners SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), customer_type=COALESCE($4,customer_type), contact_info=COALESCE($5,contact_info), updated_at=NOW() WHERE id=$6 RETURNING id, name, type, email, phone, customer_type, contact_info, status, is_active, account_id, created_at',
      [b.name||null, b.email||null, b.phone||null, b.customer_type||null, (typeof b.contact_info==='object'? b.contact_info : null), id]
    );
    res.json(rows && rows[0]);
  } catch (e) { 
    res.status(500).json({ error: "server_error" }); 
  }
}

/**
 * Delete partner (soft delete)
 * DELETE /api/partners/:id
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id||0);
    await pool.query('UPDATE partners SET is_active = false, status = $1, updated_at = NOW() WHERE id = $2', ['disabled', id]);
    res.json({ ok: true, id });
  } catch (e) { 
    res.status(500).json({ error: "server_error" }); 
  }
}

/**
 * Get partner balance
 * GET /api/partners/:id/balance
 * Calculates balance from posted journal entries only
 */
export async function balance(req, res) {
  try {
    const id = Number(req.params.id || 0);
    
    // Get partner's account_id
    const { rows: partnerRows } = await pool.query(
      'SELECT account_id FROM partners WHERE id = $1',
      [id]
    );
    
    if (!partnerRows || !partnerRows[0]?.account_id) {
      return res.json({ balance: 0 });
    }
    
    const accountId = partnerRows[0].account_id;
    
    // Calculate balance from posted journal entries only
    const { rows: balanceRows } = await pool.query(`
      SELECT 
        COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      WHERE jel.account_id = $1 AND je.status = 'posted'
    `, [accountId]);
    
    const balance = parseFloat(balanceRows[0]?.balance || 0);
    res.json({ balance, partner_id: id, account_id: accountId });
  } catch (e) {
    console.error('[PARTNERS] Error getting balance:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get partner statement
 * GET /api/partners/:id/statement
 * Returns statement items derived from posted journal entries only
 * Query params: from (date), to (date)
 */
export async function statement(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { from, to } = req.query || {};
    
    // Get partner's account_id
    const { rows: partnerRows } = await pool.query(
      'SELECT account_id, name FROM partners WHERE id = $1',
      [id]
    );
    
    if (!partnerRows || !partnerRows[0]?.account_id) {
      return res.json({ items: [], opening_balance: 0, closing_balance: 0 });
    }
    
    const accountId = partnerRows[0].account_id;
    const partnerName = partnerRows[0].name;
    
    // Calculate opening balance (before from date)
    let openingBalance = 0;
    if (from) {
      const { rows: openingRows } = await pool.query(`
        SELECT 
          COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.entry_id = je.id
        WHERE jel.account_id = $1 
          AND je.status = 'posted'
          AND je.date < $2
      `, [accountId, from]);
      openingBalance = parseFloat(openingRows[0]?.balance || 0);
    }
    
    // Build query for statement items
    let query = `
      SELECT 
        je.id as entry_id,
        je.entry_number,
        je.date,
        je.description,
        je.reference_type,
        je.reference_id,
        jel.debit,
        jel.credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      WHERE jel.account_id = $1 AND je.status = 'posted'
    `;
    const params = [accountId];
    let paramIndex = 2;
    
    if (from) {
      query += ` AND je.date >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    if (to) {
      query += ` AND je.date <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    
    query += ' ORDER BY je.date ASC, je.id ASC';
    
    const { rows } = await pool.query(query, params);
    
    // Calculate closing balance
    let runningBalance = openingBalance;
    const items = (rows || []).map(row => {
      const debit = parseFloat(row.debit || 0);
      const credit = parseFloat(row.credit || 0);
      runningBalance += debit - credit;
      return {
        id: row.entry_id,
        entry_number: row.entry_number,
        date: row.date,
        description: row.description,
        reference_type: row.reference_type,
        reference_id: row.reference_id,
        debit,
        credit,
        running_balance: runningBalance
      };
    });
    
    res.json({
      partner_id: id,
      partner_name: partnerName,
      account_id: accountId,
      opening_balance: openingBalance,
      closing_balance: runningBalance,
      items
    });
  } catch (e) {
    console.error('[PARTNERS] Error getting statement:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
