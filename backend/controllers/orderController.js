import { pool } from '../db.js';
import { calculateOrderTotals } from '../services/orderService.js';
import { parseOrderLines } from '../utils/posHelpers.js';

/**
 * List orders
 * GET /api/orders
 */
export async function list(req, res) {
  try {
    // Normalize branch - same logic as handleSaveDraft
    let branch = req.query?.branch || null;
    if (branch) {
      const branchLower = String(branch).toLowerCase().replace(/\s+/g, '_');
      if (branchLower === 'palace_india' || branchLower === 'palce_india') {
        branch = 'place_india';
      } else {
        branch = branchLower;
      }
    }
    
    const table = req.query?.table || null;
    const status = req.query?.status || null;
    
    let query = 'SELECT id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, "customerId", customer_name, customer_phone, created_at FROM orders WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (branch) {
      query += ` AND LOWER(branch) = LOWER($${paramIndex})`;
      params.push(branch);
      paramIndex++;
    }
    if (table) {
      // Normalize table - handle both string and number
      const tableValue = String(table).trim();
      query += ` AND table_code = $${paramIndex}`;
      params.push(tableValue);
      paramIndex++;
    }
    if (status) {
      // Normalize status - convert to uppercase for comparison
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      query += ` AND UPPER(status) = ANY($${paramIndex})`;
      params.push(statuses.map(s => s.toUpperCase()));
      paramIndex++;
    }
    query += ' ORDER BY id DESC';
    
    console.log(`[ORDERS] GET /api/orders - Query: ${query}`);
    console.log(`[ORDERS] GET /api/orders - Params:`, params);
    
    const { rows } = await pool.query(query, params);
    console.log(`[ORDERS] GET /api/orders - Found ${rows?.length || 0} orders for branch=${branch}, table=${table}, status=${status}`);
    
    if (rows && rows.length > 0) {
      console.log(`[ORDERS] Sample order: id=${rows[0].id}, branch='${rows[0].branch}', table_code='${rows[0].table_code}', status='${rows[0].status}'`);
    }
    
    // Parse lines from JSONB/JSON string to array - handle all cases
    const orders = (rows || []).map(order => {
      // Ensure lines is always an array
      let lines = parseOrderLines(order.lines);
      
      const result = {
        ...order,
        lines: lines,
        // Also add items alias for frontend compatibility
        items: lines
      };
      
      console.log(`[ORDERS] Order ${order.id} response: ${result.lines.length} lines/items`);
      return result;
    });
    
    console.log(`[ORDERS] Returning ${orders.length} orders with lines parsed`);
    res.json(orders);
  } catch (e) { 
    console.error('[ORDERS] Error listing orders:', e);
    res.json([]); 
  }
}

/**
 * Get single order
 * GET /api/orders/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id||0);
    const { rows } = await pool.query('SELECT id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, "customerId", customer_name, customer_phone, created_at FROM orders WHERE id=$1', [id]);
    const order = rows && rows[0];
    if (!order) {
      return res.json(null);
    }
    
    // CRITICAL: Parse lines from JSONB/JSON string/object to array - handle ALL cases
    let lines = parseOrderLines(order.lines);
    
    // CRITICAL: Return unified response - lines is always an array, nothing else
    // Frontend expects: { ...order, lines: [...] }
    const response = {
      ...order,
      lines: Array.isArray(lines) ? lines : []  // CRITICAL: Always return lines as array, never null/undefined/object
    };
    
    console.log(`[ORDERS] Order ${id} response: lines=${response.lines.length} items`);
    
    res.json(response);
  } catch (e) { 
    console.error('[ORDERS] Error getting order:', e);
    res.json(null); 
  }
}

/**
 * Create order
 * POST /api/orders
 */
export async function create(req, res) {
  try {
    const b = req.body || {};
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const table_code = String(b.table || b.table_code || '');
    const lines = Array.isArray(b.lines) ? b.lines : [];
    
    // Calculate totals from lines
    const totals = calculateOrderTotals(lines);
    
    // Insert order with calculated totals
    const { rows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId") 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId"`,
      [branch, table_code, JSON.stringify(lines), 'DRAFT', totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount, totals.customer_name, totals.customer_phone, totals.customerId]
    );
    
    const order = rows && rows[0];
    
    // Parse lines back for response
    let parsedLines = [];
    if (order && order.lines) {
      parsedLines = parseOrderLines(order.lines);
    } else {
      parsedLines = lines;
    }
    
    res.json({
      ...order,
      lines: parsedLines,
      items: parsedLines.filter(l => l && l.type === 'item')
    });
  } catch (e) { 
    console.error('[ORDERS] Error creating order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}

/**
 * Update order
 * PUT /api/orders/:id
 */
export async function update(req, res) {
  try {
    const id = Number(req.params.id||0);
    const b = req.body || {};
    // Handle lines - convert to JSON string with jsonb cast if provided
    let linesJson = null;
    let parsedLines = [];
    
    if (b.lines !== undefined) {
      if (Array.isArray(b.lines)) {
        linesJson = JSON.stringify(b.lines);
        parsedLines = b.lines;
      } else if (b.lines) {
        linesJson = typeof b.lines === 'string' ? b.lines : JSON.stringify(b.lines);
        try { parsedLines = JSON.parse(linesJson); } catch { parsedLines = []; }
      }
    }
    
    // If lines are provided, calculate totals
    let totals = null;
    if (parsedLines.length > 0) {
      totals = calculateOrderTotals(parsedLines);
    }
    
    // Build UPDATE query - if totals are calculated, include them
    let updateQuery, updateParams;
    if (totals) {
      updateQuery = `UPDATE orders 
                     SET branch=COALESCE($1,branch), 
                         table_code=COALESCE($2,table_code), 
                         lines=COALESCE($3::jsonb,lines), 
                         status=COALESCE($4,status),
                         subtotal=$5,
                         discount_amount=$6,
                         tax_amount=$7,
                         total_amount=$8,
                         customer_name=COALESCE($9,customer_name),
                         customer_phone=COALESCE($10,customer_phone),
                         "customerId"=COALESCE($11,"customerId"),
                         updated_at=NOW() 
                     WHERE id=$12 
                     RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId"`;
      updateParams = [b.branch||null, (b.table||b.table_code||null), linesJson, b.status||null, 
                      totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount,
                      totals.customer_name, totals.customer_phone, totals.customerId, id];
    } else {
      updateQuery = `UPDATE orders 
                     SET branch=COALESCE($1,branch), 
                         table_code=COALESCE($2,table_code), 
                         lines=COALESCE($3::jsonb,lines), 
                         status=COALESCE($4,status), 
                         updated_at=NOW() 
                     WHERE id=$5 
                     RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId"`;
      updateParams = [b.branch||null, (b.table||b.table_code||null), linesJson, b.status||null, id];
    }
    
    const { rows } = await pool.query(updateQuery, updateParams);
    const order = rows && rows[0];
    
    // Parse lines back for response
    if (order && order.lines && parsedLines.length === 0) {
      parsedLines = parseOrderLines(order.lines);
    }
    
    res.json({
      ...order,
      lines: parsedLines,
      items: parsedLines.filter(l => l && l.type === 'item')
    });
  } catch (e) { 
    console.error('[ORDERS] Error updating order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}

/**
 * Delete order
 * DELETE /api/orders/:id
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id||0);
    await pool.query('DELETE FROM orders WHERE id=$1', [id]);
    res.json({ ok: true, id });
  } catch (e) { 
    console.error('[ORDERS] Error deleting order:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" }); 
  }
}
