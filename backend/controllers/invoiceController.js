import { pool } from '../db.js';
import { parseOrderLines } from '../utils/posHelpers.js';
import { parseIntStrict, getBranchId } from '../utils/validation.js';

/**
 * List invoices
 * GET /api/invoices
 */
export async function list(req, res) {
  try {
    const { type, partner_id, status, from, to, branch, due, order_id } = req.query || {};
    
    let conditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Filter by type (sale/purchase)
    if (type) {
      // 'sale' type means customer invoices
      if (type === 'sale') {
        conditions.push(`(i.type = $${paramIndex} OR i.type IS NULL)`);
        params.push('sale');
        paramIndex++;
      } else {
        conditions.push(`i.type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }
    }
    
    // Filter by partner
    if (partner_id) {
      conditions.push(`i.customer_id = $${paramIndex}`);
      params.push(Number(partner_id));
      paramIndex++;
    }
    
    // Filter by status
    if (status && status !== 'all') {
      conditions.push(`i.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    // Filter by date range
    if (from) {
      conditions.push(`i.date >= $${paramIndex}::date`);
      params.push(from);
      paramIndex++;
    }
    if (to) {
      conditions.push(`i.date <= $${paramIndex}::date`);
      params.push(to);
      paramIndex++;
    }
    
    // Filter by branch
    if (branch && branch !== 'all') {
      conditions.push(`i.branch = $${paramIndex}`);
      params.push(branch);
      paramIndex++;
    }
    
    // Filter by order_id
    if (order_id) {
      conditions.push(`i.order_id = $${paramIndex}`);
      params.push(Number(order_id));
      paramIndex++;
    }
    
    // Due invoices filter
    if (due === '1') {
      conditions.push(`(i.status = 'open' OR i.status = 'partial')`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Join with partners to get customer name
    const query = `
      SELECT 
        i.id, 
        i.number as invoice_number, 
        i.date, 
        i.customer_id as partner_id, 
        i.lines,
        i.subtotal, 
        i.discount_pct, 
        i.discount_amount, 
        i.discount_amount as discount_total,
        i.tax_pct, 
        i.tax_amount as tax, 
        i.total, 
        i.payment_method, 
        i.status, 
        i.branch, 
        i.journal_entry_id,
        i.order_id,
        i.type,
        i.created_at,
        p.name as partner_name,
        p.phone as partner_phone,
        p.customer_type
      FROM invoices i
      LEFT JOIN partners p ON p.id = i.customer_id
      ${whereClause}
      ORDER BY i.id DESC
      LIMIT 500
    `;
    
    const { rows } = await pool.query(query, params);
    
    // Format response with partner object
    const items = (rows || []).map(row => ({
      id: row.id,
      invoice_number: row.invoice_number || row.number,
      date: row.date,
      partner_id: row.partner_id,
      partner: row.partner_name ? {
        id: row.partner_id,
        name: row.partner_name,
        phone: row.partner_phone,
        customer_type: row.customer_type
      } : null,
      lines: row.lines,
      subtotal: Number(row.subtotal || 0),
      discount_pct: Number(row.discount_pct || 0),
      discount_amount: Number(row.discount_amount || 0),
      discount_total: Number(row.discount_total || row.discount_amount || 0),
      tax_pct: Number(row.tax_pct || 0),
      tax: Number(row.tax || 0),
      total: Number(row.total || 0),
      payment_method: row.payment_method,
      status: row.status,
      branch: row.branch,
      journal_entry_id: row.journal_entry_id,
      order_id: row.order_id,
      type: row.type || 'sale',
      created_at: row.created_at,
      // Determine if cash by ledger
      is_cash_by_ledger: row.payment_method && ['cash', 'card', 'bank'].includes(String(row.payment_method).toLowerCase())
    }));
    
    res.json({ items });
  } catch (e) { 
    console.error('[INVOICES] Error listing invoices:', e);
    res.json({ items: [] }); 
  }
}

/**
 * Get single invoice
 * GET /api/invoices/:id
 */
export async function get(req, res) {
  try {
    // CRITICAL: Route regex ensures id is numeric, but validate anyway
    const id = parseIntStrict(req.params.id);
    if (id === null || id <= 0) {
      return res.status(404).json({ error: "not_found", details: "Invalid invoice ID" });
    }
    
    const { rows } = await pool.query('SELECT id, number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, journal_entry_id, created_at, updated_at FROM invoices WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Invoice not found" });
    }
    
    // Parse lines if needed
    const invoice = rows[0];
    if (invoice.lines) {
      invoice.lines = parseOrderLines(invoice.lines);
    }
    
    res.json(invoice);
  } catch (e) {
    console.error('[INVOICES] Error getting invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get next invoice number
 * GET /api/invoices/next-number
 */
export async function nextNumber(req, res) {
  try {
    // DEBUG: Log all parameters to identify NaN source
    console.log('[NEXT-NUMBER] Request details:', {
      params: req.params,
      query: req.query,
      body: req.body,
      user: {
        id: req.user?.id,
        branch_id: req.user?.branch_id,
        default_branch: req.user?.default_branch,
      }
    });
    
    // TEMPORARY: Return early to test if SQL is the issue
    // Uncomment this to test if error happens before SQL:
    // return res.json({ ok: true, test: 'no SQL executed' });
    
    // CRITICAL: Validate any branch_id parameters BEFORE any SQL query
    // This prevents NaN errors in PostgreSQL
    const branchId = getBranchId(req);
    
    // If branch_id is provided, validate it's a valid integer
    // If not provided, that's OK - we'll use all invoices
    if (req.query?.branch_id !== undefined || req.body?.branch_id !== undefined) {
      if (branchId === null) {
        return res.status(400).json({ 
          error: "invalid_branch_id", 
          details: "branch_id must be a valid integer if provided" 
        });
      }
    }
    
    console.log('[NEXT-NUMBER] About to execute SQL query...');
    // Now safe to execute SQL query
    // Note: We don't filter by branch_id here since invoices table doesn't have branch_id column
    // If you need branch filtering, add WHERE branch = $1 clause
    const { rows } = await pool.query('SELECT number FROM invoices ORDER BY id DESC LIMIT 1');
    console.log('[NEXT-NUMBER] SQL query executed successfully');
    const last = rows && rows[0] ? String(rows[0].number||'') : '';
    const year = (new Date()).getFullYear();
    const m = /INV\/(\d{4})\/(\d+)/.exec(last);
    let nextN = 1;
    if (m && Number(m[1]) === year) {
      const parsed = Number(m[2] || 0);
      nextN = isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
    }
    const seq = `INV/${year}/${String(nextN).padStart(10,'0')}`;
    res.json({ next: seq });
  } catch (e) {
    console.error('[INVOICES] Error getting next number:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create invoice
 * POST /api/invoices
 */
export async function create(req, res) {
  try {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const linesJson = lines.length > 0 ? JSON.stringify(lines) : null;
    const { rows } = await pool.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, b.customer_id||null, linesJson, Number(b.subtotal||0), Number(b.discount_pct||0), Number(b.discount_amount||0), Number(b.tax_pct||0), Number(b.tax_amount||0), Number(b.total||0), b.payment_method||null, String(b.status||'draft'), branch]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[INVOICES] Error creating invoice:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Update invoice
 * PUT /api/invoices/:id
 */
export async function update(req, res) {
  try {
    // CRITICAL: Validate id parameter to prevent NaN
    const paramId = String(req.params.id || '').trim();
    if (!/^\d+$/.test(paramId)) {
      return res.status(400).json({ error: "invalid_id", details: "Invalid invoice ID format" });
    }
    const id = Number(paramId);
    if (!id || !isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "invalid_id", details: "Invalid invoice ID" });
    }
    const b = req.body || {};
    const { rows } = await pool.query(
      'UPDATE invoices SET number=COALESCE($1,number), date=COALESCE($2,date), customer_id=COALESCE($3,customer_id), lines=COALESCE($4,lines), subtotal=COALESCE($5,subtotal), discount_pct=COALESCE($6,discount_pct), discount_amount=COALESCE($7,discount_amount), tax_pct=COALESCE($8,tax_pct), tax_amount=COALESCE($9,tax_amount), total=COALESCE($10,total), payment_method=COALESCE($11,payment_method), status=COALESCE($12,status), branch=COALESCE($13,branch), updated_at=NOW() WHERE id=$14 RETURNING id, number, status, total, branch',
      [b.number||null, b.date||null, (b.customer_id!=null?Number(b.customer_id):null), (Array.isArray(b.lines)?b.lines:null), (b.subtotal!=null?Number(b.subtotal):null), (b.discount_pct!=null?Number(b.discount_pct):null), (b.discount_amount!=null?Number(b.discount_amount):null), (b.tax_pct!=null?Number(b.tax_pct):null), (b.tax_amount!=null?Number(b.tax_amount):null), (b.total!=null?Number(b.total):null), b.payment_method||null, b.status||null, b.branch||null, id]
    );
    res.json(rows && rows[0]);
  } catch (e) { 
    res.status(500).json({ error: "server_error" }); 
  }
}

/**
 * Delete invoice
 * DELETE /api/invoices/:id
 */
export async function remove(req, res) {
  try {
    // CRITICAL: Route regex ensures id is numeric, but validate anyway
    const id = parseIntStrict(req.params.id);
    if (id === null || id <= 0) {
      return res.status(400).json({ error: "invalid_id", details: "Invalid invoice ID" });
    }
    await pool.query('DELETE FROM invoices WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { 
    res.status(500).json({ error: "server_error" }); 
  }
}
