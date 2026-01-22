import { pool } from '../db.js';
import { createInvoiceJournalEntry } from '../services/accountingService.js';
import { parseOrderLines } from '../utils/posHelpers.js';

/**
 * Normalize branch name
 */
function normalizeBranchName(branch) {
  const s = String(branch || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'palace_india' || s === 'palce_india') {
    return 'place_india';
  }
  return s;
}

/**
 * Get tables layout
 * GET /api/pos/tables-layout
 */
export async function getTablesLayout(req, res) {
  try {
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const normalizedBranch = normalizeBranchName(branch);
    const key = `pos_tables_layout_${normalizedBranch}`;
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    const value = rows && rows[0] ? rows[0].value : null;
    res.json(value || { rows: [] }); 
  } catch (e) { 
    res.json({ rows: [] }); 
  }
}

/**
 * Save tables layout
 * PUT /api/pos/tables-layout
 */
export async function putTablesLayout(req, res) {
  try {
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    const normalizedBranch = normalizeBranchName(branch);
    const key = `pos_tables_layout_${normalizedBranch}`;
    const value = req.body || {};
    
    await pool.query('INSERT INTO settings(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    res.json({ ok: true });
  } catch (e) { 
    console.error('[POS] tables-layout save error:', e);
    res.status(500).json({ error: "server_error" }); 
  }
}

/**
 * Get table state (busy tables)
 * GET /api/pos/table-state
 */
export async function getTableState(req, res) {
  try {
    // CRITICAL: Guards - return empty array if branch is missing
    let branch = String(req.query?.branch || req.user?.default_branch || 'china_town');
    if (!branch || String(branch).trim() === '') {
      return res.json({ busy: [] });
    }
    
    const normalizedBranch = normalizeBranchName(branch);
    
    // Query with both original and normalized branch names to handle all cases
    const { rows } = await pool.query(
      `SELECT table_code FROM orders 
       WHERE (branch = $1 OR branch = $2) 
       AND status = $3`,
      [branch, normalizedBranch, 'DRAFT']
    );
    
    // CRITICAL: Guards - ensure rows is array
    if (!Array.isArray(rows)) {
      return res.json({ busy: [] });
    }
    
    const busy = (rows || []).map(r => r?.table_code).filter(Boolean);
    res.json({ busy: Array.isArray(busy) ? busy : [] });
  } catch (e) {
    console.error('[POS] table-state error:', e);
    res.json({ busy: [] });
  }
}

/**
 * Verify cancel password
 * POST /api/pos/verify-cancel
 */
export async function verifyCancel(req, res) {
  try {
    const branch = String(req.body?.branch || req.user?.default_branch || 'china_town');
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [`settings_branch_${branch}`]);
    const v = rows && rows[0] ? rows[0].value : null;
    const pwd = v && v.cancel_password ? String(v.cancel_password) : '';
    const ok = !pwd || String(req.body?.password || '') === pwd;
    res.json(ok);
  } catch (e) { 
    res.json(true); 
  }
}

/**
 * Save draft order
 * POST /api/pos/save-draft
 */
export async function saveDraft(req, res) {
  try {
    console.log('[POS] saveDraft - Request received | userId=', req.user?.id, 'email=', req.user?.email);
    const b = req.body || {};
    
    // Normalize branch - handle variations like 'palace_india' -> 'place_india'
    let branch = b.branch || req.user?.default_branch || 'china_town';
    branch = normalizeBranchName(branch);
    
    // Normalize table_code - ensure it's a string (can be number or string)
    const table_code = b.table || b.table_code || b.tableId || null;
    const table_code_normalized = table_code ? String(table_code).trim() : null;
    const order_id = b.order_id ? Number(b.order_id) : null;
    
    // Handle both 'lines' and 'items' - frontend may send either
    // If lines is already in the correct format (with type), use it
    // Otherwise, if items is provided, convert it to the correct format
    let rawLines = Array.isArray(b.lines) ? b.lines : (Array.isArray(b.items) ? b.items : []);
    
    console.log(`[POS] saveDraft - branch=${branch}, table=${table_code_normalized}, order_id=${order_id}, raw_lines_count=${rawLines.length}`);
    
    // Build lines array in the format expected by frontend:
    // - Each item should have type: 'item'
    // - One meta object with type: 'meta' containing branch, table, customer info, etc.
    const linesArray = [];
    
    // Calculate totals from items
    const itemsOnly = Array.isArray(rawLines) ? rawLines.filter(it => it && it.type !== 'meta') : [];
    let subtotal = 0;
    let totalDiscount = 0;
    
    for (const item of itemsOnly) {
      const qty = Number(item.quantity || item.qty || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      subtotal += qty * price;
      totalDiscount += discount;
    }
    
    // Apply global discount if provided
    const globalDiscountPct = Number(b.discountPct || b.discount_pct || 0);
    if (globalDiscountPct > 0) {
      const globalDiscount = subtotal * (globalDiscountPct / 100);
      totalDiscount += globalDiscount;
    }
    
    // Calculate tax and total according to specification:
    // tax_amount = ((subtotal - discount_amount) * taxPct) / 100
    // total_amount = subtotal - discount_amount + tax_amount
    const taxPct = Number(b.taxPct || b.tax_pct || 15);
    const totalTax = ((subtotal - totalDiscount) * taxPct) / 100;
    const totalAmount = subtotal - totalDiscount + totalTax;
    
    // Add meta object with calculated totals
    const meta = {
      type: 'meta',
      branch: branch,
      table: table_code_normalized,
      customer_name: b.customerName || b.customer_name || '',
      customer_phone: b.customerPhone || b.customer_phone || '',
      customerId: b.customerId || null,
      discountPct: Number(b.discountPct || b.discount_pct || 0),
      taxPct: Number(b.taxPct || b.tax_pct || 15),
      paymentMethod: b.paymentMethod || b.payment_method || '',
      payLines: Array.isArray(b.payLines) ? b.payLines : [],
      // Calculated totals
      subtotal: subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      total_amount: totalAmount
    };
    linesArray.push(meta);
    
    // Process items - check if they already have type: 'item'
    const items = Array.isArray(rawLines) ? rawLines : [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      
      // If item already has type: 'item', use it as-is
      if (item.type === 'item') {
        linesArray.push(item);
        continue;
      }
      
      // If item has type: 'meta', skip it (we already have meta)
      if (item.type === 'meta') {
        continue;
      }
      
      // Convert plain item to format with type: 'item'
      const convertedItem = {
        type: 'item',
        product_id: item.id || item.product_id || null,
        id: item.id || item.product_id || null,
        name: item.name || '',
        name_en: item.name_en || '', // Preserve bilingual name
        qty: Number(item.quantity || item.qty || 0),
        quantity: Number(item.quantity || item.qty || 0),
        price: Number(item.price || 0),
        discount: Number(item.discount || 0)
      };
      
      // Only add if it has valid product_id or name
      if (convertedItem.product_id || convertedItem.name) {
        linesArray.push(convertedItem);
      }
    }
    
    console.log(`[POS] saveDraft - Converted lines: ${linesArray.length} items (1 meta + ${linesArray.length - 1} items)`);
    
    // Validate branch and table_code before insert
    if (!branch || String(branch).trim() === '') {
      console.error('[POS] saveDraft - Invalid branch:', branch);
      return res.status(400).json({ error: "invalid_branch", details: "Branch is required" });
    }
    
    if (!table_code_normalized || table_code_normalized === '') {
      console.error('[POS] saveDraft - Invalid table_code:', table_code);
      return res.status(400).json({ error: "invalid_table", details: "Table is required" });
    }
    
    // For PostgreSQL JSONB, we'll use JSON.stringify
    const linesJson = JSON.stringify(linesArray);
    
    if (order_id) {
      // Update existing order
      console.log(`[POS] saveDraft - Updating order ${order_id}`);
      const { rows } = await pool.query(
        `UPDATE orders 
         SET lines=$1::jsonb, 
             subtotal=$2, 
             discount_amount=$3, 
             tax_amount=$4, 
             total_amount=$5,
             customer_name=$6,
             customer_phone=$7,
             "customerId"=$8,
             updated_at=NOW() 
         WHERE id=$9 
         RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId"`,
        [linesJson, subtotal, totalDiscount, totalTax, totalAmount, 
         meta.customer_name || '', meta.customer_phone || '', meta.customerId || null, order_id]
      );
      const order = rows && rows[0];
      
      if (!order) {
        console.error(`[POS] saveDraft - Order ${order_id} not found`);
        return res.status(404).json({ error: "not_found", details: `Order ${order_id} not found` });
      }
      
      console.log(`[POS] saveDraft - Updated order ${order_id}, lines type:`, typeof order?.lines);
      
      // Parse lines back for response
      let parsedLines = linesArray;
      if (order && order.lines) {
        parsedLines = parseOrderLines(order.lines);
      }
      
      // CRITICAL: Ensure parsedLines is always an array
      if (!Array.isArray(parsedLines)) {
        console.warn('[POS] saveDraft - parsedLines is not an array, using linesArray');
        parsedLines = linesArray;
      }
      
      console.log(`[POS] saveDraft - SUCCESS - Updated order ${order_id}, returning ${parsedLines.length} lines`);
      
      // Extract calculated totals from meta and items
      const metaData = parsedLines.find(l => l && l.type === 'meta') || {};
      const itemsArray = parsedLines.filter(l => l && l.type === 'item');
      const calculatedTotals = {
        subtotal: metaData.subtotal || 0,
        discount_amount: metaData.discount_amount || 0,
        tax_amount: metaData.tax_amount || 0,
        total_amount: metaData.total_amount || 0
      };
      
      const response = {
        ...order,
        lines: parsedLines,
        items: itemsArray,  // Filtered items (not meta)
        order_id: order.id,
        invoice: null,  // No invoice for draft orders
        // Add calculated totals to top level for easy access
        subtotal: calculatedTotals.subtotal,
        discount_amount: calculatedTotals.discount_amount,
        tax_amount: calculatedTotals.tax_amount,
        total_amount: calculatedTotals.total_amount,
        // Meta fields extracted for compatibility
        customerName: metaData.customer_name || '',
        customerPhone: metaData.customer_phone || '',
        customerId: metaData.customerId || null,
        discountPct: Number(metaData.discountPct || 0),
        taxPct: Number(metaData.taxPct || 15),
        paymentMethod: metaData.paymentMethod || '',
        payLines: Array.isArray(metaData.payLines) ? metaData.payLines : []
      };
      console.log(`[POS] saveDraft - Response includes order_id: ${response.order_id}, invoice: ${response.invoice}, total_amount: ${response.total_amount}, lines: ${response.lines.length}, items: ${response.items.length}`);
      return res.json(response);
    }
    
    // Create new order
    console.log(`[POS] saveDraft - Creating new order for branch=${branch}, table=${table_code_normalized}`);
    
    const { rows } = await pool.query(
      `INSERT INTO orders(branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId") 
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, branch, table_code, lines, status, subtotal, discount_amount, tax_amount, total_amount, customer_name, customer_phone, "customerId", created_at`,
      [branch, table_code_normalized, linesJson, 'DRAFT', subtotal, totalDiscount, totalTax, totalAmount,
       meta.customer_name || '', meta.customer_phone || '', meta.customerId || null]
    );
    const order = rows && rows[0];
    
    if (!order || !order.id) {
      console.error('[POS] saveDraft - Failed to create order - no ID returned');
      return res.status(500).json({ error: "create_failed", details: "Failed to create order" });
    }
    
    console.log(`[POS] saveDraft - SUCCESS - Created order ${order.id}, branch='${order.branch}', table_code='${order.table_code}', status='${order.status}'`);
    
    // Parse lines back for response
    let parsedLines = linesArray;
    if (order && order.lines) {
      parsedLines = parseOrderLines(order.lines);
    }
    
    // CRITICAL: Ensure parsedLines is always an array
    if (!Array.isArray(parsedLines)) {
      console.warn('[POS] saveDraft - parsedLines is not an array, using linesArray');
      parsedLines = linesArray;
    }
    
    console.log(`[POS] saveDraft - Returning ${parsedLines.length} lines for new order ${order.id}`);
    
    // Extract calculated totals from meta and items
    const metaData = parsedLines.find(l => l && l.type === 'meta') || {};
    const itemsArray = parsedLines.filter(l => l && l.type === 'item');
    const calculatedTotals = {
      subtotal: metaData.subtotal || 0,
      discount_amount: metaData.discount_amount || 0,
      tax_amount: metaData.tax_amount || 0,
      total_amount: metaData.total_amount || 0
    };
    
    const response = {
      ...order,
      lines: parsedLines,
      items: itemsArray,  // Filtered items (not meta)
      order_id: order.id,
      invoice: null,  // No invoice for draft orders
      // Add calculated totals to top level for easy access
      subtotal: calculatedTotals.subtotal,
      discount_amount: calculatedTotals.discount_amount,
      tax_amount: calculatedTotals.tax_amount,
      total_amount: calculatedTotals.total_amount,
      // Meta fields extracted for compatibility
      customerName: metaData.customer_name || '',
      customerPhone: metaData.customer_phone || '',
      customerId: metaData.customerId || null,
      discountPct: Number(metaData.discountPct || 0),
      taxPct: Number(metaData.taxPct || 15),
      paymentMethod: metaData.paymentMethod || '',
      payLines: Array.isArray(metaData.payLines) ? metaData.payLines : []
    };
    console.log(`[POS] saveDraft - Response includes order_id: ${response.order_id}, invoice: ${response.invoice}, total_amount: ${response.total_amount}, lines: ${response.lines.length}, items: ${response.items.length}`);
    res.json(response);
  } catch (e) { 
    console.error('[POS] saveDraft error:', e);
    console.error('[POS] saveDraft error message:', e?.message);
    console.error('[POS] saveDraft error stack:', e?.stack);
    console.error('[POS] saveDraft error code:', e?.code);
    console.error('[POS] saveDraft error detail:', e?.detail);
    res.status(500).json({ error: "server_error", details: e?.message||"unknown", code: e?.code, detail: e?.detail }); 
  }
}

/**
 * Issue invoice from order
 * POST /api/pos/issue-invoice
 */
export async function issueInvoice(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    
    // CRITICAL: Log received body for debugging
    console.log('[BACKEND] /pos/issueInvoice received body:', JSON.stringify(b, null, 2));
    console.log('[BACKEND] /pos/issueInvoice order_id type:', typeof b.order_id, 'value:', b.order_id);
    
    // CRITICAL: order_id is REQUIRED for POS invoice issuing
    // Extract order_id explicitly - it MUST be provided
    // Force conversion to number (handle both string and number)
    const order_id = b.order_id ? (typeof b.order_id === 'number' ? b.order_id : Number(b.order_id)) : null;
    
    if (!order_id) {
      console.error('[ISSUE FAILED] Missing order_id in request body');
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: "missing_order_id", 
        details: "order_id is required to issue invoice from order" 
      });
    }
    
    console.log('[ISSUE DEBUG] order_id:', order_id);
    console.log('[ISSUE DEBUG] b.lines type:', typeof b.lines, 'isArray:', Array.isArray(b.lines));
    
    // CRITICAL: Generate invoice number if "Auto" or empty/null
    // Invoice number MUST be generated on backend - never accept "Auto" from frontend
    let number = b.number || null;
    if (!number || number === 'Auto' || String(number).trim() === '' || String(number).toLowerCase() === 'auto') {
      // Generate next invoice number using same logic as invoiceController.nextNumber
      const { rows } = await client.query(
        'SELECT number FROM invoices WHERE number IS NOT NULL AND number ~ $1 ORDER BY id DESC LIMIT 1',
        ['^INV/\\d{4}/\\d+$']
      );
      const last = rows && rows[0] ? String(rows[0].number || '') : '';
      const year = (new Date()).getFullYear();
      const m = /INV\/(\d{4})\/(\d+)/.exec(last);
      let nextN = 1;
      if (m && Number(m[1]) === year) {
        const parsed = Number(m[2] || 0);
        nextN = isFinite(parsed) && parsed > 0 ? parsed + 1 : 1;
      }
      number = `INV/${year}/${String(nextN).padStart(10, '0')}`;
      console.log('[ISSUE] Generated invoice number:', number);
    }
    
    const date = b.date || new Date();
    const customer_id = b.customer_id || null;
    const subtotal = Number(b.subtotal||0);
    const discount_pct = Number(b.discount_pct||0);
    const discount_amount = Number(b.discount_amount||0);
    const tax_pct = Number(b.tax_pct||0);
    const tax_amount = Number(b.tax_amount||0);
    const total = Number(b.total||0);
    const payment_method = b.payment_method || null;
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const status = String(b.status||'posted');
    
    // Variable to store items from order (if order_id provided)
    let orderItems = [];
    // CRITICAL: Initialize lines variable - use b.lines as fallback if order_id not provided
    let lines = Array.isArray(b.lines) ? b.lines : [];
    
    // If order_id provided, validate and lock order (DRAFT → ISSUED flow)
    if (order_id) {
      // Lock order and check status - CRITICAL: Must be DRAFT
      const { rows: orderRows } = await client.query(
        'SELECT id, status, invoice_id FROM orders WHERE id=$1 FOR UPDATE',
        [order_id]
      );
      const order = orderRows && orderRows[0];
      
      // CRITICAL: Log validation state for debugging
      const validationState = {
        orderId: order_id,
        orderExists: !!order,
        status: order?.status || null,
        hasInvoiceId: !!order?.invoice_id,
        invoiceId: order?.invoice_id || null
      };
      
      if (!order) {
        console.error('[ISSUE FAILED] Order not found:', validationState);
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "not_found", details: `Order ${order_id} not found` });
      }
      
      // CRITICAL: Only allow issuing from DRAFT status
      if (String(order.status||'').toUpperCase() !== 'DRAFT') {
        console.error('[ISSUE FAILED] Invalid order status:', validationState);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "invalid_state", 
          details: `Order status must be DRAFT, got: ${order.status}` 
        });
      }
      
      // CRITICAL: Prevent double-issuing
      if (order.invoice_id) {
        console.error('[ISSUE FAILED] Order already issued:', validationState);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "already_issued", 
          details: `Order ${order_id} already has invoice ${order.invoice_id}` 
        });
      }
      
      // CRITICAL: Load order and extract items - THE ONLY SOURCE OF TRUTH
      const { rows: orderFullRows } = await client.query(
        'SELECT lines FROM orders WHERE id=$1',
        [order_id]
      );
      const orderFull = orderFullRows && orderFullRows[0];
      let orderLines = [];
      try {
        if (Array.isArray(orderFull?.lines)) {
          orderLines = orderFull.lines;
        } else if (typeof orderFull?.lines === 'string') {
          orderLines = JSON.parse(orderFull.lines || '[]');
        }
      } catch (e) {
        console.error('[ISSUE] Failed to parse order.lines:', e);
      }
      
      // CRITICAL: Extract items from order.lines - THE ONLY SOURCE OF TRUTH
      // Filter by product_id/item_id and qty > 0 (more flexible than type='item')
      orderItems = Array.isArray(orderLines)
        ? orderLines.filter(l =>
            l &&
            (l.product_id || l.item_id || l.id) &&
            Number(l.qty ?? l.quantity ?? 1) > 0
          )
        : [];
      
      // CRITICAL: Log order.items for debugging
      console.log('[ISSUE INVOICE] order.lines =', orderLines?.length || 0);
      console.log('[ISSUE INVOICE] order.items (extracted) =', orderItems?.length || 0);
      console.log('[ISSUE INVOICE] orderItems sample:', orderItems.slice(0, 2));
      
      // CRITICAL: Validate orderItems - THE ONLY SOURCE, no reliance on req.body.lines
      if (orderItems.length === 0) {
        console.error('[ISSUE FAILED] Empty order:', { 
          ...validationState, 
          itemsCount: orderItems.length, 
          orderLinesCount: orderLines.length,
          orderLinesPreview: orderLines.slice(0, 3)
        });
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: "empty_lines", 
          details: "Order has no items",
          debug: {
            orderId: order_id,
            orderLines: orderLines?.length || 0,
            extractedItems: orderItems.length
          }
        });
      }
      
      // Log successful validation
      console.log('[ISSUE VALIDATION] Order validated successfully:', { ...validationState, itemsCount: orderItems.length });
      
      // CRITICAL: Map orderItems to invoice lines - NO CONDITIONAL, ALWAYS USE orderItems
      // Don't rely on req.body.lines - orderItems is THE ONLY SOURCE
      lines = orderItems.map(item => ({
        type: 'item',
        product_id: item.product_id ?? item.item_id ?? item.id ?? null,
        name: String(item.name || ''),
        name_en: String(item.name_en || ''), // Preserve bilingual name
        qty: Number(item.qty ?? item.quantity ?? 0),
        price: Number(item.price ?? item.unit_price ?? 0),
        discount: Number(item.discount ?? 0)
      }));
      console.log('[ISSUE] Using order items for invoice:', lines.length, 'items');
    }
    
    // Insert invoice
    // CRITICAL: Normalize and clean lines array - handle double stringification
    let linesArray = Array.isArray(lines) ? lines : [];
    
    // تطهير كل عناصر الـ array قبل الإدراج - CRITICAL: Normalize all values to correct types
    linesArray = linesArray
      .map(item => {
        // تحويل أي string JSON إلى object
        if (typeof item === 'string') {
          try {
            const parsed = JSON.parse(item);
            // Re-parse if still string (double stringification)
            if (typeof parsed === 'string') {
              try {
                return JSON.parse(parsed);
              } catch {
                return null;
              }
            }
            return parsed;
          } catch (err) {
            console.error('[ISSUE DEBUG] Invalid JSON string:', item.substring(0, 200));
            return null;
          }
        }
        // تنظيف object - CRITICAL: Ensure all numeric fields are numbers, not strings
        if (typeof item === 'object' && item !== null) {
          const clean = {};
          for (const [key, value] of Object.entries(item)) {
            // Skip undefined and functions
            if (value === undefined || typeof value === 'function') {
              continue;
            }
            // Normalize numeric fields to actual numbers
            if (key === 'qty' || key === 'quantity' || key === 'price' || key === 'discount' || key === 'amount') {
              const numValue = Number(value);
              clean[key] = isNaN(numValue) ? 0 : numValue;
            } else if (key === 'product_id') {
              const numValue = Number(value);
              clean[key] = isNaN(numValue) ? null : numValue;
            } else if (key === 'type' || key === 'name' || key === 'name_en') {
              // String fields - ensure they're strings
              clean[key] = String(value || '');
            } else {
              // Other fields - copy as-is if they're primitive types
              if (value !== null && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
                clean[key] = value;
              }
            }
          }
          return clean;
        }
        return null;
      })
      .filter(Boolean)
      .filter(item => {
        // CRITICAL: Filter only sale items - must have type='item' AND (product_id OR name)
        // Reject meta, tax, discount, or any non-sale items
        if (!item || typeof item !== 'object') return false;
        if (item.type && String(item.type).trim() !== 'item') return false; // Reject meta/tax/discount
        const hasProductId = item.product_id || item.item_id || item.id;
        const hasQty = (item.qty !== undefined && item.qty !== null) || (item.quantity !== undefined && item.quantity !== null);
        const hasName = item.name && String(item.name).trim().length > 0;
        // Must have qty AND (product_id OR name)
        return hasQty && (hasProductId || hasName);
      }); // فلترة - فقط عناصر البيع الفعلية (type='item' مع product_id)
    
    // Fallback: use items from order if lines is empty
    if (!linesArray.length && order_id && orderItems && orderItems.length > 0) {
      linesArray = orderItems
        .map(it => {
          // CRITICAL: Normalize all numeric values - ensure they're actual numbers, not strings
          const qty = Number(it.qty || it.quantity || 0);
          const price = Number(it.price || 0);
          const discount = Number(it.discount || 0);
          const productId = it.product_id ? Number(it.product_id) : null;
          
          return {
            type: 'item',
            product_id: isNaN(productId) ? null : productId,
            name: String(it.name || ''),
            name_en: String(it.name_en || ''), // Preserve bilingual name
            qty: isNaN(qty) ? 0 : qty,
            price: isNaN(price) ? 0 : price,
            discount: isNaN(discount) ? 0 : discount
          };
        })
        .filter(item => item.qty > 0); // فلترة العناصر التي لها كمية صفر
    }
    
    // CRITICAL: If still empty and order_id exists, try to load from order directly
    if (!linesArray.length && order_id) {
      try {
        const { rows: orderCheckRows } = await client.query('SELECT lines FROM orders WHERE id = $1', [order_id]);
        const orderCheck = orderCheckRows && orderCheckRows[0];
        if (orderCheck) {
          let orderCheckLines = [];
          if (Array.isArray(orderCheck.lines)) {
            orderCheckLines = orderCheck.lines;
          } else if (typeof orderCheck.lines === 'string') {
            try { orderCheckLines = JSON.parse(orderCheck.lines || '[]'); } catch {}
          }
          // CRITICAL: Filter only sale items (type='item' with product_id), not meta/tax/discount
          const orderCheckItems = Array.isArray(orderCheckLines) 
            ? orderCheckLines.filter(x => x && x.type === 'item' && (x.product_id || x.item_id || x.id))
            : [];
          if (orderCheckItems.length > 0) {
            linesArray = orderCheckItems.map(it => ({
              type: 'item',
              product_id: it.product_id || it.item_id || it.id ? Number(it.product_id || it.item_id || it.id) : null,
              name: String(it.name || ''),
              name_en: String(it.name_en || ''),
              qty: Number(it.qty || it.quantity || 0),
              price: Number(it.price || 0),
              discount: Number(it.discount || 0)
            })).filter(item => item.qty > 0 && (item.product_id || item.name));
          }
        }
      } catch (e) {
        console.warn('[ISSUE] Failed to load lines from order:', e);
      }
    }
    
    // تحقق نهائي - CRITICAL: Do not allow empty lines for issued invoices
    if (!linesArray.length) {
      console.error('[ISSUE FAILED] Empty lines array after normalization', { 
        originalLines: lines, 
        linesType: typeof lines, 
        linesIsArray: Array.isArray(lines),
        orderItemsLength: orderItems?.length || 0,
        order_id: order_id,
        status: status
      });
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "empty_lines", details: "Invoice must have at least one line item. Make sure order has items." });
    }
    
    // التحقق النهائي قبل أي INSERT
    if (!linesArray.every(item => typeof item === 'object' && item !== null)) {
      console.error('[ISSUE FAILED] linesArray contains invalid elements:', linesArray);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_lines", details: "Lines array contains invalid elements" });
    }
    
    // CRITICAL: Final validation - ensure all values are properly typed
    linesArray = linesArray.map(item => {
      const clean = {
        type: String(item.type || 'item'),
        name: String(item.name || ''),
        name_en: String(item.name_en || ''),
        qty: Number(item.qty || item.quantity || 0),
        price: Number(item.price || 0),
        discount: Number(item.discount || 0)
      };
      if (item.product_id != null) {
        clean.product_id = Number(item.product_id);
      }
      return clean;
    });
    
    // CRITICAL: Validate all numeric values are actual numbers (not NaN)
    const invalidItems = linesArray.filter(item => 
      isNaN(item.qty) || isNaN(item.price) || isNaN(item.discount)
    );
    if (invalidItems.length > 0) {
      console.error('[ISSUE FAILED] Invalid numeric values in linesArray:', invalidItems);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_values", details: "Lines contain invalid numeric values" });
    }
    
    // CRITICAL: Pass linesArray directly as object/array (same as supplier_invoices)
    // The pg library will automatically convert JavaScript objects/arrays to JSONB
    // This is safer than manual stringification and avoids escape issues
    
    // Validate JSON structure one more time
    try {
      JSON.stringify(linesArray);
    } catch (err) {
      console.error('[ISSUE FAILED] linesArray is not JSON-serializable:', err);
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_json", details: "Lines array cannot be serialized to JSON" });
    }
    
    // CRITICAL: Stringify for client.query inside transaction
    const linesJson = JSON.stringify(linesArray);
    
    // CRITICAL: Use stringified JSON WITHOUT ::jsonb cast (Test 2 pattern that PASSED)
    // Test 2: stringified JSON WITHOUT cast PASSED
    // Test 3: stringified JSON WITH cast PASSED
    // But Test 2 is simpler, so use it
    // PostgreSQL will automatically convert string to JSONB based on column type
    // CRITICAL: Set type = 'sale' for POS invoices so they appear in sales screen
    const { rows } = await client.query(
      'INSERT INTO invoices(number, date, customer_id, lines, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, number, status, total, branch, type',
      [number, date, customer_id, linesJson, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, payment_method, status, branch, 'sale']
    );
    
    console.log('[ISSUE DEBUG] Invoice inserted successfully', { invoiceId: rows[0]?.id, linesCount: linesArray.length });
    
    const invoice = rows && rows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "server_error", details: "Failed to create invoice" });
    }

    // Update order status to ISSUED and link invoice (if order_id provided)
    if (order_id) {
      await client.query(
        'UPDATE orders SET status=$1, invoice_id=$2 WHERE id=$3',
        ['ISSUED', invoice.id, order_id]
      );
      console.log(`[POS] Issue invoice: Order ${order_id} → ISSUED, Invoice ${invoice.id}`);
    }

    // Create journal entry automatically
    let journalEntryId = null;
    if (status === 'posted' && total > 0) {
      try {
        journalEntryId = await createInvoiceJournalEntry(
          invoice.id,
          customer_id,
          subtotal,
          discount_amount,
          tax_amount,
          total,
          payment_method,
          branch
        );
        
        // CRITICAL: Link journal entry to invoice
        if (journalEntryId) {
          await client.query(
            'UPDATE invoices SET journal_entry_id = $1 WHERE id = $2',
            [journalEntryId, invoice.id]
          );
          console.log(`[ACCOUNTING] Linked journal entry ${journalEntryId} to invoice ${invoice.id}`);
        } else {
          throw new Error('JOURNAL_CREATION_FAILED: Journal entry ID is null after creation');
        }
      } catch (journalError) {
        console.error('[ACCOUNTING] CRITICAL: Failed to create journal entry for invoice:', invoice.id, journalError);
        await client.query('ROLLBACK');
        return res.status(500).json({ 
          error: "journal_creation_failed", 
          details: journalError?.message || "Failed to create journal entry for invoice",
          invoice_id: invoice.id
        });
      }
    }

    await client.query('COMMIT');
    res.json({
      ...invoice,
      journal_entry_id: journalEntryId
    });
  } catch (e) {
    await client.query('ROLLBACK');
    const errorMsg = e?.message || String(e || 'unknown');
    console.error('[POS] issueInvoice error:', errorMsg);
    console.error('[POS] issueInvoice error stack:', e?.stack);
    console.error('[POS] issueInvoice error code:', e?.code);
    console.error('[POS] issueInvoice error detail:', e?.detail);
    res.status(500).json({ error: "server_error", details: errorMsg });
  } finally {
    client.release();
  }
}
