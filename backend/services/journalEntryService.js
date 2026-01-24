/**
 * Journal Entry Service
 * 
 * Unified service for creating journal entries to eliminate code duplication
 * Rule: أي عملية أو فاتورة غير مرتبطة بقيد لا يجب أن يكون لها وجود
 */

import { pool } from '../db.js';

/**
 * Get next entry number (reuses deleted numbers)
 */
async function getNextEntryNumber(client = null) {
  const db = client || pool;
  
  // Get the highest entry number
  const { rows: maxRows } = await db.query(
    'SELECT COALESCE(MAX(entry_number), 0) as max_num FROM journal_entries'
  );
  const maxNum = maxRows && maxRows[0] ? Number(maxRows[0].max_num || 0) : 0;
  
  // Find the first gap (deleted entry number)
  const { rows: gapRows } = await db.query(
    `SELECT entry_number 
     FROM journal_entries 
     WHERE entry_number < $1 
     ORDER BY entry_number DESC 
     LIMIT 1`,
    [maxNum]
  );
  
  if (gapRows && gapRows.length > 0) {
    // There's a gap, find the first missing number
    const { rows: allRows } = await db.query(
      'SELECT entry_number FROM journal_entries ORDER BY entry_number'
    );
    const usedNumbers = new Set(allRows.map(r => Number(r.entry_number)));
    
    for (let i = 1; i <= maxNum; i++) {
      if (!usedNumbers.has(i)) {
        return i;
      }
    }
  }
  
  return maxNum + 1;
}

/**
 * Get account ID by account number
 */
async function getAccountIdByNumber(accountNumber, client = null) {
  const db = client || pool;
  const { rows } = await db.query(
    'SELECT id FROM accounts WHERE account_number = $1 LIMIT 1',
    [accountNumber]
  );
  return rows && rows[0] ? rows[0].id : null;
}

/**
 * Create a journal entry with postings
 * 
 * @param {Object} params
 * @param {string} params.description - Journal entry description
 * @param {Date|string} params.date - Journal entry date
 * @param {Array} params.postings - Array of {account_id, debit, credit}
 * @param {string} params.referenceType - Reference type (invoice, expense, etc.)
 * @param {number} params.referenceId - Reference ID
 * @param {string} params.status - Journal entry status (default: 'posted')
 * @param {string} params.branch - Branch name
 * @param {Object} params.client - Database client (for transaction)
 * @returns {Promise<number>} Journal entry ID
 */
export async function createJournalEntry({
  description,
  date,
  postings,
  referenceType,
  referenceId,
  status = 'posted',
  branch = 'china_town',
  client = null
}) {
  const db = client || pool;
  
  // Validate postings balance
  const totalDebit = postings.reduce((sum, p) => sum + Number(p.debit || 0), 0);
  const totalCredit = postings.reduce((sum, p) => sum + Number(p.credit || 0), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`JOURNAL_CREATION_FAILED: Unbalanced entry (Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)})`);
  }
  
  // Validate postings
  for (let i = 0; i < postings.length; i++) {
    const posting = postings[i];
    if (!posting.account_id) {
      throw new Error(`JOURNAL_CREATION_FAILED: Posting ${i + 1} missing account_id`);
    }
    if ((posting.debit || 0) < 0) {
      throw new Error(`JOURNAL_CREATION_FAILED: Posting ${i + 1} debit cannot be negative`);
    }
    if ((posting.credit || 0) < 0) {
      throw new Error(`JOURNAL_CREATION_FAILED: Posting ${i + 1} credit cannot be negative`);
    }
    if ((posting.debit || 0) > 0 && (posting.credit || 0) > 0) {
      throw new Error(`JOURNAL_CREATION_FAILED: Posting ${i + 1} cannot have both debit and credit`);
    }
  }
  
  // Get next entry number
  const entryNumber = await getNextEntryNumber(client);
  
  // Extract period from date
  const entryDate = date || new Date();
  const period = entryDate instanceof Date 
    ? entryDate.toISOString().slice(0, 7) 
    : new Date(entryDate).toISOString().slice(0, 7);
  
  // Create journal entry
  const { rows: entryRows } = await db.query(
    'INSERT INTO journal_entries(entry_number, description, date, period, reference_type, reference_id, status, branch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [entryNumber, description, entryDate, period, referenceType, referenceId, status, branch]
  );
  
  const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
  if (!entryId) {
    throw new Error('JOURNAL_CREATION_FAILED: Failed to create journal entry record');
  }
  
  // Create postings
  for (const posting of postings) {
    await db.query(
      'INSERT INTO journal_postings(journal_entry_id, account_id, debit, credit) VALUES ($1,$2,$3,$4)',
      [entryId, posting.account_id, posting.debit || 0, posting.credit || 0]
    );
  }
  
  console.log(`[JOURNAL SERVICE] Created journal entry #${entryNumber} (ID: ${entryId}) for ${referenceType} ${referenceId}`);
  return entryId;
}

/**
 * Create journal entry for invoice
 */
export async function createInvoiceJournalEntry(invoiceId, customerId, subtotal, discount, tax, total, paymentMethod, branch, client = null) {
  const postings = [];
  
  // Determine sales account based on branch and payment method
  let salesAccountNumber = '4111'; // Default: Cash sales - China Town
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
    const customerAccountId = await getOrCreatePartnerAccount(customerId, 'customer', client);
    if (!customerAccountId) {
      throw new Error(`JOURNAL_CREATION_FAILED: Customer account not found for customer ${customerId}`);
    }
    // Debit: Customer Receivable
    postings.push({ account_id: customerAccountId, debit: total, credit: 0 });
  } else {
    // Cash sale - use main cash account (1111)
    const cashAccountId = await getAccountIdByNumber('1111', client);
    if (!cashAccountId) {
      throw new Error('JOURNAL_CREATION_FAILED: Cash account (1111) not found');
    }
    postings.push({ account_id: cashAccountId, debit: total, credit: 0 });
  }
  
  // Credit: Sales Revenue
  const salesAccountId = await getAccountIdByNumber(salesAccountNumber, client);
  if (!salesAccountId) {
    throw new Error(`JOURNAL_CREATION_FAILED: Sales account (${salesAccountNumber}) not found`);
  }
  postings.push({ account_id: salesAccountId, debit: 0, credit: subtotal - discount });
  
  // Credit: VAT Output (2141) if tax > 0
  if (tax > 0) {
    const vatAccountId = await getAccountIdByNumber('2141', client);
    if (!vatAccountId) {
      throw new Error('JOURNAL_CREATION_FAILED: VAT account (2141) not found');
    }
    postings.push({ account_id: vatAccountId, debit: 0, credit: tax });
  }
  
  return await createJournalEntry({
    description: `فاتورة مبيعات #${invoiceId}`,
    date: new Date(),
    postings,
    referenceType: 'invoice',
    referenceId: invoiceId,
    status: 'posted',
    branch: branch || 'china_town',
    client
  });
}

/**
 * Create journal entry for expense
 */
export async function createExpenseJournalEntry(expenseId, expenseAccountId, paymentAccountId, total, items, description, branch, client = null) {
  const postings = [];
  
  if (items && items.length > 0) {
    // Multiple items - create posting for each
    for (const item of items) {
      const itemAmount = Number(item.amount || 0);
      const itemAccountId = await getAccountIdByNumber(item.account_code, client);
      if (itemAccountId && itemAmount > 0) {
        postings.push({ account_id: itemAccountId, debit: itemAmount, credit: 0 });
      }
    }
    // Payment posting (credit)
    postings.push({ account_id: paymentAccountId, debit: 0, credit: total });
  } else {
    // Single expense - create two postings
    postings.push({ account_id: expenseAccountId, debit: total, credit: 0 });
    postings.push({ account_id: paymentAccountId, debit: 0, credit: total });
  }
  
  const entryDescription = description 
    ? `مصروف #${expenseId} - ${description}` 
    : `مصروف #${expenseId}`;
  
  return await createJournalEntry({
    description: entryDescription,
    date: new Date(),
    postings,
    referenceType: 'expense',
    referenceId: expenseId,
    status: 'posted',
    branch: branch || 'china_town',
    client
  });
}

/**
 * Create journal entry for supplier invoice
 */
export async function createSupplierInvoiceJournalEntry(invoiceId, supplierId, subtotal, discount, tax, total, paymentMethod, branch, client = null) {
  const postings = [];
  
  // Get supplier account (if credit purchase)
  if (supplierId && paymentMethod && String(paymentMethod).toLowerCase() === 'credit') {
    const supplierAccountId = await getOrCreatePartnerAccount(supplierId, 'supplier', client);
    if (!supplierAccountId) {
      throw new Error(`JOURNAL_CREATION_FAILED: Supplier account not found for supplier ${supplierId}`);
    }
    // Credit: Supplier Payable
    postings.push({ account_id: supplierAccountId, debit: 0, credit: total });
  } else {
    // Cash purchase - use main cash account (1111)
    const cashAccountId = await getAccountIdByNumber('1111', client);
    if (!cashAccountId) {
      throw new Error('JOURNAL_CREATION_FAILED: Cash account (1111) not found');
    }
    postings.push({ account_id: cashAccountId, debit: 0, credit: total });
  }
  
  // Debit: Purchase Expense (5201)
  const purchaseAccountId = await getAccountIdByNumber('5201', client);
  if (!purchaseAccountId) {
    throw new Error('JOURNAL_CREATION_FAILED: Purchase account (5201) not found');
  }
  postings.push({ account_id: purchaseAccountId, debit: subtotal - discount, credit: 0 });
  
  // Debit: VAT Input (2141) if tax > 0
  if (tax > 0) {
    const vatAccountId = await getAccountIdByNumber('2141', client);
    if (!vatAccountId) {
      throw new Error('JOURNAL_CREATION_FAILED: VAT account (2141) not found');
    }
    // For supplier invoices, VAT is input tax (debit)
    postings.push({ account_id: vatAccountId, debit: tax, credit: 0 });
  }
  
  return await createJournalEntry({
    description: `فاتورة مورد #${invoiceId}`,
    date: new Date(),
    postings,
    referenceType: 'supplier_invoice',
    referenceId: invoiceId,
    status: 'posted',
    branch: branch || 'china_town',
    client
  });
}

/**
 * Get or create partner account
 */
async function getOrCreatePartnerAccount(partnerId, partnerType, client = null) {
  const db = client || pool;
  
  // Get partner account number based on type
  const accountNumber = partnerType === 'customer' ? '1141' : '2111';
  
  // Try to find existing account for this partner
  const { rows: existingRows } = await db.query(
    `SELECT a.id 
     FROM accounts a
     JOIN partners p ON a.account_number = p.account_number
     WHERE p.id = $1`,
    [partnerId]
  );
  
  if (existingRows && existingRows.length > 0) {
    return existingRows[0].id;
  }
  
  // Get parent account
  const { rows: parentRows } = await db.query(
    'SELECT id FROM accounts WHERE account_number = $1 LIMIT 1',
    [accountNumber]
  );
  
  if (!parentRows || !parentRows.length) {
    return null;
  }
  
  const parentId = parentRows[0].id;
  
  // Get partner info
  const { rows: partnerRows } = await db.query(
    'SELECT name, name_en FROM partners WHERE id = $1',
    [partnerId]
  );
  
  if (!partnerRows || !partnerRows.length) {
    return null;
  }
  
  const partner = partnerRows[0];
  const partnerAccountNumber = `${accountNumber}.${partnerId}`;
  
  // Create partner account
  const { rows: accountRows } = await db.query(
    `INSERT INTO accounts(account_number, name, name_en, type, nature, parent_id, opening_balance)
     VALUES ($1, $2, $3, $4, $5, $6, 0)
     RETURNING id`,
    [partnerAccountNumber, partner.name, partner.name_en || partner.name, 'asset', 'debit', parentId]
  );
  
  // Update partner with account number
  await db.query(
    'UPDATE partners SET account_number = $1 WHERE id = $2',
    [partnerAccountNumber, partnerId]
  );
  
  return accountRows && accountRows[0] ? accountRows[0].id : null;
}

// Export helper functions for backward compatibility
export { getAccountIdByNumber, getNextEntryNumber };
