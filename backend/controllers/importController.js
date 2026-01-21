/**
 * Import Controller
 * استيراد البيانات من الأنظمة القديمة
 */

import { pool } from '../db.js';
import { cache } from '../utils/cache.js';

/**
 * Import journal entries
 * POST /api/import/journal
 */
export async function importJournal(req, res) {
  const client = await pool.connect();
  try {
    const { items, fiscal_year } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'validation_error', message: 'لا توجد بيانات للاستيراد' });
    }

    // Check fiscal year
    const { rows: fyRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE year = $1',
      [fiscal_year]
    );
    
    if (!fyRows || fyRows.length === 0) {
      return res.status(400).json({ error: 'invalid_fiscal_year', message: 'السنة المالية غير موجودة' });
    }

    const fy = fyRows[0];
    if (fy.status === 'closed' && !fy.temporary_open) {
      return res.status(400).json({ error: 'fiscal_year_closed', message: 'السنة المالية مغلقة' });
    }

    await client.query('BEGIN');

    let imported = 0;
    let errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Create journal entry
        const { rows: entryRows } = await client.query(`
          INSERT INTO journal_entries (date, description, reference, status, fiscal_year_id, created_by)
          VALUES ($1, $2, $3, 'posted', $4, $5)
          RETURNING id
        `, [item.date, item.description, item.reference || null, fy.id, userId]);

        const entryId = entryRows[0].id;

        // Create debit posting
        if (item.debit_account && item.amount) {
          await client.query(`
            INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
            SELECT $1, id, $2, 0
            FROM accounts
            WHERE account_number = $3 OR account_code = $3
            LIMIT 1
          `, [entryId, item.amount, item.debit_account]);
        }

        // Create credit posting
        if (item.credit_account && item.amount) {
          await client.query(`
            INSERT INTO journal_postings (journal_entry_id, account_id, debit, credit)
            SELECT $1, id, 0, $2
            FROM accounts
            WHERE account_number = $3 OR account_code = $3
            LIMIT 1
          `, [entryId, item.amount, item.credit_account]);
        }

        imported++;
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    await client.query('COMMIT');

    // Log activity
    await pool.query(`
      INSERT INTO fiscal_year_activities (fiscal_year_id, action, description, details, user_id)
      VALUES ($1, 'import', $2, $3, $4)
    `, [
      fy.id,
      `تم استيراد ${imported} قيد يومي`,
      JSON.stringify({ imported, errors: errors.length }),
      userId
    ]);

    res.json({
      success: true,
      imported,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[IMPORT] Error importing journal:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  } finally {
    client.release();
  }
}

/**
 * Import invoices
 * POST /api/import/invoices
 */
export async function importInvoices(req, res) {
  const client = await pool.connect();
  try {
    const { items, fiscal_year } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'validation_error', message: 'لا توجد بيانات للاستيراد' });
    }

    // Check fiscal year
    const { rows: fyRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE year = $1',
      [fiscal_year]
    );
    
    if (!fyRows || fyRows.length === 0) {
      return res.status(400).json({ error: 'invalid_fiscal_year', message: 'السنة المالية غير موجودة' });
    }

    const fy = fyRows[0];
    if (fy.status === 'closed' && !fy.temporary_open) {
      return res.status(400).json({ error: 'fiscal_year_closed', message: 'السنة المالية مغلقة' });
    }

    await client.query('BEGIN');

    let imported = 0;
    let errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Find or create customer
        let customerId = null;
        if (item.customer) {
          const { rows: customerRows } = await client.query(
            'SELECT id FROM partners WHERE name = $1 AND type IN ($2, $3) LIMIT 1',
            [item.customer, 'customer', 'عميل']
          );
          
          if (customerRows.length > 0) {
            customerId = customerRows[0].id;
          } else {
            // Create customer
            const { rows: newCustomer } = await client.query(
              'INSERT INTO partners (name, type) VALUES ($1, $2) RETURNING id',
              [item.customer, 'customer']
            );
            customerId = newCustomer[0].id;
          }
        }

        // Create invoice
        await client.query(`
          INSERT INTO invoices (date, number, customer_id, total, status, fiscal_year_id, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [item.date, item.number, customerId, item.total, item.status || 'open', fy.id, userId]);

        imported++;
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    await client.query('COMMIT');

    // Log activity
    await pool.query(`
      INSERT INTO fiscal_year_activities (fiscal_year_id, action, description, details, user_id)
      VALUES ($1, 'import', $2, $3, $4)
    `, [
      fy.id,
      `تم استيراد ${imported} فاتورة`,
      JSON.stringify({ imported, errors: errors.length }),
      userId
    ]);

    res.json({
      success: true,
      imported,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[IMPORT] Error importing invoices:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  } finally {
    client.release();
  }
}

/**
 * Import expenses
 * POST /api/import/expenses
 */
export async function importExpenses(req, res) {
  const client = await pool.connect();
  try {
    const { items, fiscal_year } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'validation_error', message: 'لا توجد بيانات للاستيراد' });
    }

    // Check fiscal year
    const { rows: fyRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE year = $1',
      [fiscal_year]
    );
    
    if (!fyRows || fyRows.length === 0) {
      return res.status(400).json({ error: 'invalid_fiscal_year', message: 'السنة المالية غير موجودة' });
    }

    const fy = fyRows[0];
    if (fy.status === 'closed' && !fy.temporary_open) {
      return res.status(400).json({ error: 'fiscal_year_closed', message: 'السنة المالية مغلقة' });
    }

    await client.query('BEGIN');

    let imported = 0;
    let errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Find account if specified
        let accountId = null;
        if (item.account) {
          const { rows: accountRows } = await client.query(
            'SELECT id FROM accounts WHERE account_number = $1 OR account_code = $1 LIMIT 1',
            [item.account]
          );
          if (accountRows.length > 0) {
            accountId = accountRows[0].id;
          }
        }

        // Create expense
        await client.query(`
          INSERT INTO expenses (date, description, amount, category, account_id, fiscal_year_id, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [item.date, item.description, item.amount, item.category || null, accountId, fy.id, userId]);

        imported++;
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    await client.query('COMMIT');

    // Log activity
    await pool.query(`
      INSERT INTO fiscal_year_activities (fiscal_year_id, action, description, details, user_id)
      VALUES ($1, 'import', $2, $3, $4)
    `, [
      fy.id,
      `تم استيراد ${imported} مصروف`,
      JSON.stringify({ imported, errors: errors.length }),
      userId
    ]);

    res.json({
      success: true,
      imported,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[IMPORT] Error importing expenses:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  } finally {
    client.release();
  }
}

/**
 * Validate import data
 * POST /api/import/validate
 */
export async function validateImport(req, res) {
  try {
    const { items, type, fiscal_year } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'validation_error', message: 'لا توجد بيانات للتحقق' });
    }

    // Check fiscal year
    const { rows: fyRows } = await pool.query(
      'SELECT * FROM fiscal_years WHERE year = $1',
      [fiscal_year]
    );
    
    const fyValid = fyRows && fyRows.length > 0;
    const fyOpen = fyValid && (fyRows[0].status === 'open' || fyRows[0].temporary_open);

    const errors = [];
    const warnings = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowErrors = [];

      // Date validation
      if (!item.date) {
        rowErrors.push('التاريخ مطلوب');
      } else {
        const dateYear = new Date(item.date).getFullYear();
        if (dateYear !== fiscal_year) {
          rowErrors.push(`التاريخ ليس في السنة ${fiscal_year}`);
        }
      }

      // Type-specific validations
      if (type === 'journal') {
        if (!item.description) rowErrors.push('الوصف مطلوب');
        if (!item.debit_account) rowErrors.push('حساب المدين مطلوب');
        if (!item.credit_account) rowErrors.push('حساب الدائن مطلوب');
        if (!item.amount || parseFloat(item.amount) <= 0) rowErrors.push('المبلغ غير صالح');
      }

      if (type === 'invoices') {
        if (!item.number) rowErrors.push('رقم الفاتورة مطلوب');
        if (!item.customer) rowErrors.push('العميل مطلوب');
        if (!item.total || parseFloat(item.total) <= 0) rowErrors.push('الإجمالي غير صالح');
      }

      if (type === 'expenses') {
        if (!item.description) rowErrors.push('الوصف مطلوب');
        if (!item.amount || parseFloat(item.amount) <= 0) rowErrors.push('المبلغ غير صالح');
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, errors: rowErrors });
      }
    }

    res.json({
      total: items.length,
      valid: items.length - errors.length,
      invalid: errors.length,
      errors,
      warnings,
      fiscalYear: {
        valid: fyValid,
        open: fyOpen,
        message: !fyValid ? 'السنة المالية غير موجودة' : (!fyOpen ? 'السنة المالية مغلقة' : null)
      }
    });
  } catch (e) {
    console.error('[IMPORT] Error validating:', e);
    res.status(500).json({ error: 'server_error', details: e?.message });
  }
}
