import { pool } from '../db.js';
import { getNextEntryNumber, getAccountIdByNumber } from '../services/accountingService.js';

/**
 * List expenses
 * GET /api/expenses
 */
export async function list(req, res) {
  try {
    const { rows } = await pool.query('SELECT id, invoice_number, type, amount, COALESCE(total, amount) as total, account_code, partner_id, description, status, branch, date, payment_method, items, journal_entry_id, created_at FROM expenses ORDER BY id DESC');
    // Map items to format expected by frontend
    const items = (rows || []).map(row => {
      const status = String(row.status || 'draft');
      const hasPostedJournal = !!row.journal_entry_id;
      const isDraft = status === 'draft';
      const isPosted = status === 'posted';
      
      return {
        ...row,
        invoice_number: row.invoice_number || `EXP-${row.id}`,
        total: Number(row.total || row.amount || 0),
        derived_status: isPosted ? 'posted' : (isDraft ? 'draft' : status),
        has_posted_journal: hasPostedJournal,
        allowed_actions: {
          post: isDraft && !hasPostedJournal,
          edit: isDraft && !hasPostedJournal,
          delete: isDraft && !hasPostedJournal,
          reverse: isPosted && hasPostedJournal
        }
      };
    });
    res.json({ items });
  } catch (e) { 
    res.json({ items: [] }); 
  }
}

/**
 * Get single expense
 * GET /api/expenses/:id
 */
export async function get(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const { rows } = await pool.query('SELECT id, invoice_number, type, amount, COALESCE(total, amount) as total, account_code, partner_id, description, status, branch, date, payment_method, items, journal_entry_id, created_at, updated_at FROM expenses WHERE id = $1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "not_found", details: "Expense not found" });
    }
    const expense = rows[0];
    
    // Format expense response with all required fields for frontend
    expense.invoice_number = expense.invoice_number || `EXP-${expense.id}`;
    expense.total = Number(expense.total || expense.amount || 0);
    
    // Frontend expects expense_account_code and payment_account_code
    expense.expense_account_code = expense.account_code || null;
    
    // Calculate payment_account_code based on payment_method
    const paymentMethod = String(expense.payment_method || 'cash').toLowerCase();
    if (paymentMethod === 'bank') {
      expense.payment_account_code = '1121'; // Default bank account
    } else {
      expense.payment_account_code = '1111'; // Default cash account
    }
    
    // Add expense_type for compatibility
    expense.expense_type = expense.type || 'expense';
    
    // Ensure items is an array
    if (expense.items && typeof expense.items === 'string') {
      try {
        expense.items = JSON.parse(expense.items);
      } catch (e) {
        expense.items = [];
      }
    } else if (!Array.isArray(expense.items)) {
      expense.items = [];
    }
    
    res.json(expense);
  } catch (e) {
    console.error('[EXPENSES] Error getting expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  }
}

/**
 * Create expense
 * POST /api/expenses
 */
export async function create(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const expenseType = b.type || b.expense_type || 'expense';
    const amount = Number(b.amount || 0);
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : amount);
    const invoiceNumber = b.invoice_number || null;
    const accountCode = b.account_code || null;
    const partnerId = b.partner_id || null;
    const description = b.description || null;
    const autoPost = b.auto_post !== false; // Default to true unless explicitly set to false
    const status = autoPost ? 'posted' : (b.status || 'draft');
    const branch = b.branch || req.user?.default_branch || 'china_town';
    const date = b.date || new Date().toISOString().slice(0, 10);
    const paymentMethod = b.payment_method || 'cash';
    
    // Insert expense
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const { rows } = await client.query(
      'INSERT INTO expenses(invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [invoiceNumber, expenseType, amount, total, accountCode, partnerId, description, status, branch, date, paymentMethod, itemsJson]
    );
    const expense = rows && rows[0];
    
    if (!expense || !expense.id) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "create_failed", details: "Failed to create expense" });
    }
    
    console.log(`[EXPENSES] Created expense ${expense.id}, amount=${amount}, account=${accountCode}`);
    
    // If expense is posted (not draft), create journal entry automatically
    if (status === 'posted' && total > 0 && accountCode) {
      try {
        const expenseAccountId = await getAccountIdByNumber(accountCode);
        let paymentAccountId = null;
        if (paymentMethod && String(paymentMethod).toLowerCase() === 'bank') {
          paymentAccountId = await getAccountIdByNumber('1121');
        } else {
          paymentAccountId = await getAccountIdByNumber('1111');
        }
        
        if (expenseAccountId && paymentAccountId) {
          const entryDescription = expenseType ? `مصروف #${expense.id} - ${expenseType}` : `مصروف #${expense.id}${description ? ' - ' + description : ''}`;
          
          let totalDebit = 0;
          let totalCredit = total;
          
          if (items.length > 0) {
            for (const item of items) {
              totalDebit += Number(item.amount || 0);
            }
          } else {
            totalDebit = total;
          }
          
          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error('[EXPENSES] Journal entry unbalanced:', { totalDebit, totalCredit, expenseId: expense.id });
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "unbalanced_entry", details: "Journal entry is not balanced" });
          }
          
          const entryNumber = await getNextEntryNumber();
          
          const { rows: entryRows } = await client.query(
            `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
            [entryNumber, entryDescription, date, 'expense', expense.id, 'posted', branch]
          );
          
          const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
          
          if (entryId) {
            if (items.length > 0) {
              for (const item of items) {
                const itemAmount = Number(item.amount || 0);
                const itemAccountId = await getAccountIdByNumber(item.account_code);
                if (itemAccountId && itemAmount > 0) {
                  await client.query(
                    `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                     VALUES ($1, $2, $3, $4)`,
                    [entryId, itemAccountId, itemAmount, 0]
                  );
                }
              }
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, paymentAccountId, 0, total]
              );
            } else {
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, expenseAccountId, total, 0]
              );
              await client.query(
                `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [entryId, paymentAccountId, 0, total]
              );
            }
            
            await client.query('UPDATE expenses SET journal_entry_id = $1 WHERE id = $2', [entryId, expense.id]);
            console.log(`[EXPENSES] Auto-posted expense ${expense.id}, created journal entry ${entryId}`);
          }
        } else {
          if (autoPost) {
            await client.query('ROLLBACK');
            try {
              await pool.query('DELETE FROM expenses WHERE id = $1', [expense.id]);
            } catch (deleteErr) {
              console.error('[EXPENSES] Failed to delete expense after account error:', deleteErr);
            }
            return res.status(400).json({ 
              error: "post_failed", 
              details: "Could not create journal entry - expense account or payment account not found"
            });
          }
        }
      } catch (journalError) {
        console.error('[EXPENSES] Error creating journal entry:', journalError);
        if (autoPost) {
          await client.query('ROLLBACK');
          try {
            await pool.query('DELETE FROM expenses WHERE id = $1', [expense.id]);
          } catch (deleteErr) {
            console.error('[EXPENSES] Failed to delete expense after journal error:', deleteErr);
          }
          return res.status(500).json({ 
            error: "post_failed", 
            details: journalError?.message || "Failed to create journal entry"
          });
        }
      }
    }
    
    await client.query('COMMIT');
    const formattedExpense = {
      ...expense,
      invoice_number: expense.invoice_number || `EXP-${expense.id}`,
      total: Number(expense.total || expense.amount || 0),
      status: expense.status || status
    };
    res.json(formattedExpense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error creating expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Update expense
 * PUT /api/expenses/:id
 */
export async function update(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id||0);
    const b = req.body || {};
    
    const { rows: currentRows } = await client.query('SELECT status, journal_entry_id FROM expenses WHERE id = $1', [id]);
    const currentExpense = currentRows && currentRows[0];
    const oldStatus = currentExpense ? currentExpense.status : null;
    const hasJournalEntry = currentExpense && currentExpense.journal_entry_id;
    
    const items = Array.isArray(b.items) ? b.items : [];
    const total = b.total != null ? Number(b.total) : (items.length > 0 ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : (b.amount != null ? Number(b.amount) : null));
    const itemsJson = items.length > 0 ? JSON.stringify(items) : null;
    const newStatus = b.status || oldStatus;
    const accountCode = b.account_code || null;
    const paymentMethod = b.payment_method || null;
    const expenseType = b.type || b.expense_type || null;
    const description = b.description || null;
    const date = b.date || null;
    const branch = b.branch || null;
    
    const { rows } = await client.query(
      'UPDATE expenses SET invoice_number=COALESCE($1,invoice_number), type=COALESCE($2,type), amount=COALESCE($3,amount), total=COALESCE($4,total), account_code=COALESCE($5,account_code), partner_id=COALESCE($6,partner_id), description=COALESCE($7,description), status=COALESCE($8,status), branch=COALESCE($9,branch), date=COALESCE($10,date), payment_method=COALESCE($11,payment_method), items=COALESCE($12::jsonb,items), updated_at=NOW() WHERE id=$13 RETURNING id, invoice_number, type, amount, total, account_code, partner_id, description, status, branch, date, payment_method, items, created_at',
      [b.invoice_number||null, expenseType, (b.amount!=null?Number(b.amount):null), total, accountCode, (b.partner_id!=null?Number(b.partner_id):null), description, newStatus, branch, date, paymentMethod, itemsJson, id]
    );
    const expense = rows && rows[0];
    if (expense) {
      expense.invoice_number = expense.invoice_number || `EXP-${expense.id}`;
      expense.total = Number(expense.total || expense.amount || 0);
    }
    
    // Create journal entry if status changed to 'posted' and doesn't have one
    if (newStatus === 'posted' && oldStatus !== 'posted' && !hasJournalEntry && total > 0 && (accountCode || (items.length > 0 && items[0]?.account_code))) {
      try {
        const finalAccountCode = accountCode || (items.length > 0 ? items[0].account_code : null);
        if (finalAccountCode) {
          const expenseAccountId = await getAccountIdByNumber(finalAccountCode);
          let paymentAccountId = null;
          const pm = paymentMethod || expense.payment_method || 'cash';
          if (pm && String(pm).toLowerCase() === 'bank') {
            paymentAccountId = await getAccountIdByNumber('1121');
          } else {
            paymentAccountId = await getAccountIdByNumber('1111');
          }
          
          if (expenseAccountId && paymentAccountId) {
            let totalDebit = 0;
            let totalCredit = total;
            
            if (items.length > 0) {
              for (const item of items) {
                totalDebit += Number(item.amount || 0);
              }
            } else {
              totalDebit = total;
            }
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: "unbalanced_entry", details: "Journal entry is not balanced" });
            }
            
            const entryDescription = expenseType ? `مصروف #${expense.id} - ${expenseType}` : `مصروف #${expense.id}${description ? ' - ' + description : ''}`;
            const entryNumber = await getNextEntryNumber();
            
            const { rows: entryRows } = await client.query(
              `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
              [entryNumber, entryDescription, date || expense.date || new Date().toISOString().slice(0, 10), 'expense', expense.id, 'posted', branch || expense.branch || 'china_town']
            );
            
            const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
            
            if (entryId) {
              if (items.length > 0) {
                for (const item of items) {
                  const itemAmount = Number(item.amount || 0);
                  const itemAccountId = await getAccountIdByNumber(item.account_code);
                  if (itemAccountId && itemAmount > 0) {
                    await client.query(
                      `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                       VALUES ($1, $2, $3, $4)`,
                      [entryId, itemAccountId, itemAmount, 0]
                    );
                  }
                }
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              } else {
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, expenseAccountId, total, 0]
                );
                await client.query(
                  `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
                   VALUES ($1, $2, $3, $4)`,
                  [entryId, paymentAccountId, 0, total]
                );
              }
              
              await client.query('UPDATE expenses SET journal_entry_id = $1 WHERE id = $2', [entryId, expense.id]);
            }
          }
        }
      } catch (journalError) {
        console.error('[EXPENSES] Error creating journal entry on update:', journalError);
      }
    }
    
    await client.query('COMMIT');
    res.json(expense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error updating expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}

/**
 * Post expense (create journal entry)
 * POST /api/expenses/:id/post
 */
export async function post(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = Number(req.params.id || 0);
    
    const { rows: expenseRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (!expenseRows || !expenseRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "not_found", details: "Expense not found" });
    }
    
    const expense = expenseRows[0];
    
    if (expense.status === 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "already_posted", details: "Expense is already posted" });
    }
    
    const amount = Number(expense.total || expense.amount || 0);
    const accountCode = expense.account_code;
    
    if (amount <= 0 || !accountCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "invalid_expense", details: "Expense amount or account code is missing" });
    }
    
    await client.query('UPDATE expenses SET status = $1 WHERE id = $2', ['posted', id]);
    
    const expenseAccountId = await getAccountIdByNumber(accountCode);
    let paymentAccountId = null;
    const paymentMethod = String(expense.payment_method || 'cash').toLowerCase();
    if (paymentMethod === 'bank') {
      paymentAccountId = await getAccountIdByNumber('1121');
    } else {
      paymentAccountId = await getAccountIdByNumber('1111');
    }
    
    if (expenseAccountId && paymentAccountId) {
      const entryNumber = await getNextEntryNumber();
      const description = expense.type ? `مصروف #${expense.id} - ${expense.type}` : `مصروف #${expense.id}${expense.description ? ' - ' + expense.description : ''}`;
      
      const { rows: entryRows } = await client.query(
        `INSERT INTO journal_entries(entry_number, description, date, reference_type, reference_id, status, branch)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, entry_number`,
        [entryNumber, description, expense.date, 'expense', expense.id, 'posted', expense.branch || null]
      );
      
      const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
      
      if (entryId) {
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, expenseAccountId, amount, 0]
        );
        await client.query(
          `INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit)
           VALUES ($1, $2, $3, $4)`,
          [entryId, paymentAccountId, 0, amount]
        );
        
        await client.query('UPDATE expenses SET journal_entry_id = $1 WHERE id = $2', [entryId, id]);
      }
    }
    
    await client.query('COMMIT');
    
    const { rows: updatedRows } = await client.query('SELECT * FROM expenses WHERE id = $1', [id]);
    const updatedExpense = updatedRows && updatedRows[0];
    if (updatedExpense) {
      updatedExpense.invoice_number = updatedExpense.invoice_number || `EXP-${updatedExpense.id}`;
      updatedExpense.total = Number(updatedExpense.total || updatedExpense.amount || 0);
    }
    res.json(updatedExpense);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[EXPENSES] Error posting expense:', e);
    res.status(500).json({ error: "server_error", details: e?.message || "unknown" });
  } finally {
    client.release();
  }
}
