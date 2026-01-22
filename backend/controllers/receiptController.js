/**
 * Receipt Controller
 * إدارة الإيصالات المطبوعة
 */

import { pool } from '../db.js';

/**
 * List printed receipts
 * GET /api/receipts
 */
export async function list(req, res) {
  try {
    const { 
      invoiceNumber, 
      date, 
      month, 
      year, 
      branch,
      limit = 100,
      offset = 0
    } = req.query;

    // Note: orders table uses "customerId" (camelCase) not customer_id
    // and stores items in 'lines' JSON column, not in order_items table
    // Note: orders table doesn't have 'number' column, use id instead
    let query = `
      SELECT 
        o.id,
        o.id::text as invoice_number,
        o.total_amount as total,
        o.subtotal,
        o.tax_amount as tax,
        o.printed_at,
        o.created_at,
        o.branch,
        o.customer_name,
        o.lines as items,
        o.receipt_html
      FROM orders o
      WHERE o.printed_at IS NOT NULL
    `;

    const params = [];
    let paramIndex = 1;

    // Search by invoice number (search by id since number column doesn't exist)
    if (invoiceNumber) {
      query += ` AND o.id::text ILIKE $${paramIndex}`;
      params.push(`%${invoiceNumber}%`);
      paramIndex++;
    }

    // Filter by branch
    if (branch) {
      query += ` AND LOWER(o.branch) = LOWER($${paramIndex})`;
      params.push(branch);
      paramIndex++;
    }

    // Filter by exact date
    if (date) {
      query += ` AND DATE(o.printed_at) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    // Filter by month and year
    else if (month && year) {
      query += ` AND EXTRACT(MONTH FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(month, 10));
      paramIndex++;
      query += ` AND EXTRACT(YEAR FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(year, 10));
      paramIndex++;
    }
    // Filter by year only
    else if (year) {
      query += ` AND EXTRACT(YEAR FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    query += `
      ORDER BY o.printed_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await pool.query(query, params);

    // Parse lines JSON if needed
    const results = rows.map(row => {
      let items = [];
      if (row.items) {
        if (typeof row.items === 'string') {
          try { items = JSON.parse(row.items); } catch { items = []; }
        } else if (Array.isArray(row.items)) {
          items = row.items;
        }
        // Filter to only item entries (not meta)
        items = items.filter(i => i && i.type === 'item');
      }
      return {
        ...row,
        items,
        receipt_html: row.receipt_html || null // Include saved receipt HTML
      };
    });

    res.json(results);
  } catch (e) {
    console.error('[RECEIPTS] Error listing:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get single receipt
 * GET /api/receipts/:id
 */
export async function get(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const { rows } = await pool.query(`
      SELECT 
        o.*,
        o.customer_name,
        o.customer_phone
      FROM orders o
      WHERE o.id = $1
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const row = rows[0];
    
    // Parse lines JSON
    let items = [];
    if (row.lines) {
      if (typeof row.lines === 'string') {
        try { items = JSON.parse(row.lines); } catch { items = []; }
      } else if (Array.isArray(row.lines)) {
        items = row.lines;
      }
      items = items.filter(i => i && i.type === 'item');
    }

    res.json({
      ...row,
      items,
      total: row.total_amount,
      tax: row.tax_amount
    });
  } catch (e) {
    console.error('[RECEIPTS] Error getting:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Mark order as printed
 * POST /api/receipts/:id/mark-printed
 * Body: { receipt_html?: string } - Optional receipt HTML to save
 */
export async function markPrinted(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { receipt_html } = req.body || {};

    // First, ensure receipt_html column exists
    try {
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS receipt_html TEXT
      `);
    } catch (colErr) {
      // Column might already exist, ignore error
      console.log('[RECEIPTS] receipt_html column check:', colErr.message);
    }

    const updateFields = ['printed_at = COALESCE(printed_at, NOW())'];
    const params = [];
    let paramIndex = 1;

    if (receipt_html) {
      updateFields.push(`receipt_html = $${paramIndex}`);
      params.push(receipt_html);
      paramIndex++;
    }

    const { rows } = await pool.query(`
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, [...params, id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error('[RECEIPTS] Error marking printed:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Get receipt statistics
 * GET /api/receipts/stats
 */
export async function stats(req, res) {
  try {
    const { branch, date, month, year } = req.query;

    let whereClause = 'WHERE o.printed_at IS NOT NULL';
    const params = [];
    let paramIndex = 1;

    if (branch) {
      whereClause += ` AND LOWER(o.branch) = LOWER($${paramIndex})`;
      params.push(branch);
      paramIndex++;
    }

    if (date) {
      whereClause += ` AND DATE(o.printed_at) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    } else if (month && year) {
      whereClause += ` AND EXTRACT(MONTH FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(month, 10));
      paramIndex++;
      whereClause += ` AND EXTRACT(YEAR FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(year, 10));
      paramIndex++;
    } else if (year) {
      whereClause += ` AND EXTRACT(YEAR FROM o.printed_at) = $${paramIndex}`;
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_receipts,
        COALESCE(SUM(o.total_amount), 0) as total_amount,
        COALESCE(AVG(o.total_amount), 0) as average_amount,
        MIN(o.printed_at) as first_print,
        MAX(o.printed_at) as last_print
      FROM orders o
      ${whereClause}
    `, params);

    res.json(rows[0] || {
      total_receipts: 0,
      total_amount: 0,
      average_amount: 0
    });
  } catch (e) {
    console.error('[RECEIPTS] Error getting stats:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}
