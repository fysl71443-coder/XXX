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

    let query = `
      SELECT 
        o.id,
        o.number as invoice_number,
        o.total,
        o.subtotal,
        o.tax,
        o.printed_at,
        o.created_at,
        o.payment_method,
        o.branch,
        p.name as customer_name,
        json_agg(json_build_object(
          'name', pr.name,
          'quantity', oi.quantity,
          'price', oi.price,
          'total', oi.total
        )) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN partners p ON o.customer_id = p.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products pr ON oi.product_id = pr.id
      WHERE o.printed_at IS NOT NULL
    `;

    const params = [];
    let paramIndex = 1;

    // Search by invoice number
    if (invoiceNumber) {
      query += ` AND o.number ILIKE $${paramIndex}`;
      params.push(`%${invoiceNumber}%`);
      paramIndex++;
    }

    // Filter by branch
    if (branch) {
      query += ` AND o.branch = $${paramIndex}`;
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
      GROUP BY o.id, o.number, o.total, o.subtotal, o.tax, o.printed_at, 
               o.created_at, o.payment_method, o.branch, p.name
      ORDER BY o.printed_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await pool.query(query, params);

    res.json(rows);
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
        p.name as customer_name,
        p.phone as customer_phone,
        json_agg(json_build_object(
          'id', oi.id,
          'name', pr.name,
          'quantity', oi.quantity,
          'price', oi.price,
          'total', oi.total
        )) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN partners p ON o.customer_id = p.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products pr ON oi.product_id = pr.id
      WHERE o.id = $1
      GROUP BY o.id, p.name, p.phone
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error('[RECEIPTS] Error getting:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}

/**
 * Mark order as printed
 * POST /api/receipts/:id/mark-printed
 */
export async function markPrinted(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const { rows } = await pool.query(`
      UPDATE orders
      SET printed_at = COALESCE(printed_at, NOW())
      WHERE id = $1
      RETURNING *
    `, [id]);

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
      whereClause += ` AND o.branch = $${paramIndex}`;
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
        COALESCE(SUM(o.total), 0) as total_amount,
        COALESCE(AVG(o.total), 0) as average_amount,
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
