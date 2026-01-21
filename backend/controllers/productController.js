import { pool } from '../db.js';

/**
 * List products
 * GET /api/products
 */
export async function list(req, res) {
  try {
    const includeDisabled = req.query.include_disabled === '1' || req.query.include_disabled === 1;
    
    // CRITICAL: Select all columns including sale_price, price, name_en for bilingual support
    // Filter by is_active only if include_disabled is not set
    let query = `
      SELECT 
        id, name, name_en, sku, barcode, category, unit, 
        COALESCE(sale_price, price, 0) as sale_price,
        price, cost, tax_rate, COALESCE(stock_qty, stock_quantity, 0) as stock_quantity, min_stock, 
        description, is_active, is_service, 
        true as can_be_sold, 
        true as can_be_purchased, 
        false as can_be_expensed,
        created_at, updated_at
      FROM products 
    `;
    
    if (!includeDisabled) {
      // Show products where is_active is true OR NULL (NULL means active by default)
      // This ensures products added manually will show even if is_active is NULL
      query += ` WHERE (is_active = true OR is_active IS NULL) `;
    }
    
    query += ` ORDER BY category ASC, name ASC `;
    
    const { rows } = await pool.query(query);
    
    // Separate active and disabled products
    // Products with is_active = NULL are considered active
    const activeProducts = rows.filter(p => p.is_active !== false);
    const disabledProducts = rows.filter(p => p.is_active === false);
    const disabledIds = disabledProducts.map(p => p.id);
    
    res.json({
      items: activeProducts,
      disabled_ids: disabledIds
    });
  } catch (e) {
    console.error('[PRODUCTS] Error listing products:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Get single product
 * GET /api/products/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Product not found" });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error getting product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create product
 * POST /api/products
 */
export async function create(req, res) {
  try {
    const b = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO products(name, name_en, sku, barcode, category, unit, price, cost, tax_rate, stock_qty, min_stock, description, is_active) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name||'', b.name_en||'', b.sku||null, b.barcode||null, b.category||null, b.unit||'unit', 
       Number(b.price||0), Number(b.cost||0), Number(b.tax_rate||15), Number(b.stock_quantity||b.stock_qty||0), 
       Number(b.min_stock||0), b.description||null, b.is_active!==false]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error creating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Update product
 * PUT /api/products/:id
 */
export async function update(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const b = req.body || {};
    const { rows } = await pool.query(
      `UPDATE products SET name=COALESCE($1,name), name_en=COALESCE($2,name_en), sku=COALESCE($3,sku), 
       barcode=COALESCE($4,barcode), category=COALESCE($5,category), unit=COALESCE($6,unit), 
       price=COALESCE($7,price), cost=COALESCE($8,cost), tax_rate=COALESCE($9,tax_rate), 
       stock_qty=COALESCE($10,stock_qty), min_stock=COALESCE($11,min_stock), 
       description=COALESCE($12,description), is_active=COALESCE($13,is_active), updated_at=NOW() 
       WHERE id=$14 RETURNING *`,
      [b.name||null, b.name_en||null, b.sku||null, b.barcode||null, b.category||null, b.unit||null,
       b.price!=null?Number(b.price):null, b.cost!=null?Number(b.cost):null, b.tax_rate!=null?Number(b.tax_rate):null,
       b.stock_quantity!=null?Number(b.stock_quantity):null, b.min_stock!=null?Number(b.min_stock):null,
       b.description||null, b.is_active, id]
    );
    res.json(rows && rows[0]);
  } catch (e) {
    console.error('[PRODUCTS] Error updating product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Delete product
 * DELETE /api/products/:id
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id || 0);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[PRODUCTS] Error deleting product:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Bulk import products
 * POST /api/products/bulk-import
 */
export async function bulkImport(req, res) {
  try {
    const sections = Array.isArray(req.body) ? req.body : [];
    if (sections.length === 0) {
      return res.status(400).json({ error: "invalid_data", message: "Empty sections array" });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let errors = [];

    // Process each section
    for (const section of sections) {
      const sectionName = String(section.section_name || '').trim();
      const items = Array.isArray(section.items) ? section.items : [];

      if (!sectionName || items.length === 0) continue;

      // Process each item in the section
      for (const item of items) {
        try {
          const itemName = String(item.name || '').trim();
          const itemPrice = Number(item.price || 0);

          if (!itemName || itemPrice <= 0) {
            errors.push({ item: itemName || 'unknown', error: 'Invalid name or price' });
            continue;
          }

          // Parse name: "English / Arabic" format
          let nameEn = '';
          let nameAr = '';
          const nameParts = itemName.split('/').map(s => s.trim()).filter(Boolean);
          if (nameParts.length >= 2) {
            nameEn = nameParts[0];
            nameAr = nameParts.slice(1).join('/'); // Join remaining parts for Arabic
          } else if (nameParts.length === 1) {
            // If no separator, check if it's Arabic (contains Arabic characters)
            const hasArabic = /[\u0600-\u06FF]/.test(nameParts[0]);
            if (hasArabic) {
              nameAr = nameParts[0];
            } else {
              nameEn = nameParts[0];
            }
          }

          // Check if product already exists (by name)
          const { rows: existing } = await pool.query(
            'SELECT id FROM products WHERE name = $1 OR name_en = $2 LIMIT 1',
            [nameAr || nameEn, nameEn || nameAr]
          );

          if (existing && existing[0]) {
            // Update existing product
            await pool.query(
              `UPDATE products SET name=$1, name_en=$2, category=$3, price=$4, updated_at=NOW() WHERE id=$5`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, itemPrice, existing[0].id]
            );
            totalUpdated++;
          } else {
            // Create new product
            await pool.query(
              `INSERT INTO products(name, name_en, category, unit, price, cost, tax_rate, stock_qty, min_stock, is_active) 
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [nameAr || nameEn, nameEn || nameAr, sectionName, 'unit', itemPrice, 0, 15, 0, 0, true]
            );
            totalCreated++;
          }
        } catch (itemError) {
          console.error('[PRODUCTS] Error processing item:', item, itemError);
          errors.push({ item: item.name || 'unknown', error: itemError?.message || 'unknown' });
        }
      }
    }

    console.log(`[PRODUCTS] Bulk import completed: ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`);
    res.json({ 
      ok: true, 
      created: totalCreated, 
      updated: totalUpdated, 
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });
  } catch (e) {
    console.error('[PRODUCTS] Error in bulk import:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}
