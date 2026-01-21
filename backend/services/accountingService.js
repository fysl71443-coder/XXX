import { pool } from '../db.js';

/**
 * Get next journal entry number (reuses deleted numbers)
 * @returns {Promise<number>} Next entry number
 */
export async function getNextEntryNumber() {
  try {
    // Get all used entry numbers, sorted
    const { rows: usedNumbers } = await pool.query(
      'SELECT entry_number FROM journal_entries ORDER BY entry_number ASC'
    );
    
    const usedSet = new Set((usedNumbers || []).map(r => Number(r.entry_number || 0)));
    
    // Find first gap (deleted number) or use next sequential number
    let nextNumber = 1;
    for (const num of usedSet) {
      if (num === nextNumber) {
        nextNumber++;
      } else if (num > nextNumber) {
        // Found a gap - reuse it
        return nextNumber;
      }
    }
    
    // No gaps found, use next sequential number
    return nextNumber;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting next entry number:', e);
    // Fallback: use max + 1
    try {
      const { rows: lastEntry } = await pool.query('SELECT entry_number FROM journal_entries ORDER BY entry_number DESC LIMIT 1');
      return lastEntry && lastEntry[0] ? Number(lastEntry[0].entry_number || 0) + 1 : 1;
    } catch (e2) {
      return 1;
    }
  }
}

/**
 * Get account ID by account number
 * @param {string|number} accountNumber - Account number or code
 * @returns {Promise<number|null>} Account ID or null
 */
export async function getAccountIdByNumber(accountNumber) {
  if (!accountNumber) return null;
  try {
    const { rows } = await pool.query('SELECT id FROM accounts WHERE account_number = $1 OR account_code = $1 LIMIT 1', [String(accountNumber)]);
    return rows && rows[0] ? rows[0].id : null;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting account by number:', accountNumber, e);
    return null;
  }
}

/**
 * Get or create partner account (customer/supplier sub-account)
 * @param {number} partnerId - Partner ID
 * @param {string} partnerType - 'customer' or 'supplier'
 * @returns {Promise<number|null>} Account ID or null
 */
export async function getOrCreatePartnerAccount(partnerId, partnerType) {
  if (!partnerId) return null;
  try {
    // Check if partner already has an account
    const { rows: partnerRows } = await pool.query('SELECT account_id, name FROM partners WHERE id = $1', [partnerId]);
    if (partnerRows && partnerRows[0] && partnerRows[0].account_id) {
      return partnerRows[0].account_id;
    }

    // Get parent account based on type
    const parentAccountNumber = partnerType === 'supplier' ? '2111' : '1141'; // Suppliers: 2111 (موردون), Customers: 1141 (عملاء)
    const parentAccountId = await getAccountIdByNumber(parentAccountNumber);
    if (!parentAccountId) {
      console.warn(`[ACCOUNTING] Parent account ${parentAccountNumber} not found for partner ${partnerId}`);
      return null;
    }

    // Get partner name
    const partnerName = partnerRows && partnerRows[0] ? partnerRows[0].name : `Partner ${partnerId}`;

    // Create sub-account for partner
    const { rows: accountRows } = await pool.query(
      'INSERT INTO accounts(account_number, account_code, name, type, nature, parent_id, opening_balance, allow_manual_entry) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [null, null, partnerName, partnerType === 'supplier' ? 'liability' : 'asset', partnerType === 'supplier' ? 'credit' : 'debit', parentAccountId, 0, false]
    );

    const accountId = accountRows && accountRows[0] ? accountRows[0].id : null;
    if (accountId) {
      // Update partner with account_id
      await pool.query('UPDATE partners SET account_id = $1 WHERE id = $2', [accountId, partnerId]);
    }
    return accountId;
  } catch (e) {
    console.error('[ACCOUNTING] Error getting/creating partner account:', partnerId, e);
    return null;
  }
}

/**
 * Create journal entry for invoice
 * @param {number} invoiceId - Invoice ID
 * @param {number|null} customerId - Customer ID (if credit sale)
 * @param {number} subtotal - Subtotal amount
 * @param {number} discount - Discount amount
 * @param {number} tax - Tax amount
 * @param {number} total - Total amount
 * @param {string|null} paymentMethod - Payment method ('credit', 'cash', etc.)
 * @param {string} branch - Branch name
 * @returns {Promise<number|null>} Journal entry ID or null
 */
export async function createInvoiceJournalEntry(invoiceId, customerId, subtotal, discount, tax, total, paymentMethod, branch) {
  try {
    // Get next entry number (reuses deleted numbers)
    const entryNumber = await getNextEntryNumber();

    const postings = [];
    
    // Determine sales account based on branch and payment method
    // Default: Cash sales - China Town (4111)
    let salesAccountNumber = '4111';
    if (branch) {
      const branchLower = String(branch).toLowerCase();
      if (branchLower.includes('place_india') || branchLower.includes('palace_india')) {
        salesAccountNumber = paymentMethod && String(paymentMethod).toLowerCase() === 'credit' ? '4122' : '4121';
      } else {
        salesAccountNumber = paymentMethod && String(paymentMethod).toLowerCase() === 'credit' ? '4112' : '4111';
      }
    }

    // Get customer account (if credit sale)
    if (customerId && paymentMethod && String(paymentMethod).toLowerCase() === 'credit') {
      const customerAccountId = await getOrCreatePartnerAccount(customerId, 'customer');
      if (!customerAccountId) {
        throw new Error(`JOURNAL_CREATION_FAILED: Customer account not found for customer ${customerId}`);
      }
      // Debit: Customer Receivable (حساب فرعي تحت 1141)
      postings.push({ account_id: customerAccountId, debit: total, credit: 0 });
    } else {
      // Cash sale - use main cash account (1111 - صندوق رئيسي)
      const cashAccountId = await getAccountIdByNumber('1111');
      if (!cashAccountId) {
        throw new Error('JOURNAL_CREATION_FAILED: Cash account (1111) not found');
      }
      postings.push({ account_id: cashAccountId, debit: total, credit: 0 });
    }

    // Credit: Sales Revenue (حسب الفرع وطريقة الدفع)
    const salesAccountId = await getAccountIdByNumber(salesAccountNumber);
    if (!salesAccountId) {
      throw new Error(`JOURNAL_CREATION_FAILED: Sales account (${salesAccountNumber}) not found`);
    }
    postings.push({ account_id: salesAccountId, debit: 0, credit: subtotal - discount });

    // Credit: VAT Output (2141) if tax > 0
    if (tax > 0) {
      const vatAccountId = await getAccountIdByNumber('2141');
      if (!vatAccountId) {
        throw new Error('JOURNAL_CREATION_FAILED: VAT account (2141) not found');
      }
      postings.push({ account_id: vatAccountId, debit: 0, credit: tax });
    }

    // Validate postings balance
    const totalDebit = postings.reduce((sum, p) => sum + Number(p.debit || 0), 0);
    const totalCredit = postings.reduce((sum, p) => sum + Number(p.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.error('[ACCOUNTING] Journal entry unbalanced:', { totalDebit, totalCredit, postings });
      throw new Error(`JOURNAL_CREATION_FAILED: Unbalanced entry (Debit: ${totalDebit}, Credit: ${totalCredit})`);
    }

    // Extract period from date (YYYY-MM format)
    const entryDate = new Date();
    const period = entryDate.toISOString().slice(0, 7); // YYYY-MM
    
    // Create journal entry with period
    // CRITICAL FIX: Set status='posted' when creating journal entry
    const { rows: entryRows } = await pool.query(
      'INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [entryNumber, `فاتورة مبيعات #${invoiceId}`, entryDate, period, 'invoice', invoiceId, 'posted', branch || 'china_town']
    );

    const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
    if (!entryId) {
      throw new Error('JOURNAL_CREATION_FAILED: Failed to create journal entry record');
    }

    // Create postings
    for (const posting of postings) {
      await pool.query(
        'INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,$4)',
        [entryId, posting.account_id, posting.debit, posting.credit]
      );
    }

    console.log(`[ACCOUNTING] Created journal entry #${entryNumber} (ID: ${entryId}) for invoice ${invoiceId}`);
    return entryId;
  } catch (e) {
    console.error('[ACCOUNTING] Error creating journal entry for invoice:', invoiceId, e?.message || e);
    // Re-throw error instead of returning null - this will cause transaction rollback
    throw e;
  }
}
