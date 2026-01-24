/**
 * Validation utilities for data validation before database insertion
 */

/**
 * Validate invoice data
 * @param {Object} data - Invoice data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateInvoice(data) {
  const errors = [];
  
  if (!data.number || String(data.number).trim() === '') {
    errors.push('Invoice number is required');
  }
  
  if (!data.date) {
    errors.push('Invoice date is required');
  }
  
  if (data.total < 0) {
    errors.push('Invoice total cannot be negative');
  }
  
  if (data.subtotal < 0) {
    errors.push('Invoice subtotal cannot be negative');
  }
  
  if (data.tax_amount < 0) {
    errors.push('Tax amount cannot be negative');
  }
  
  if (data.discount_amount < 0) {
    errors.push('Discount amount cannot be negative');
  }
  
  // Validate total calculation
  const calculatedTotal = (data.subtotal || 0) - (data.discount_amount || 0) + (data.tax_amount || 0);
  if (Math.abs((data.total || 0) - calculatedTotal) > 0.01) {
    errors.push(`Total mismatch: expected ${calculatedTotal.toFixed(2)}, got ${(data.total || 0).toFixed(2)}`);
  }
  
  if (data.status === 'posted' && (data.total || 0) <= 0) {
    errors.push('Cannot post invoice with zero or negative total');
  }
  
  if (data.status === 'posted' && !data.customer_id && data.payment_method === 'credit') {
    errors.push('Cannot post credit invoice without customer');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate expense data
 * @param {Object} data - Expense data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateExpense(data) {
  const errors = [];
  
  if (!data.account_code) {
    errors.push('Account code is required');
  }
  
  if ((data.total || 0) <= 0) {
    errors.push('Expense total must be greater than zero');
  }
  
  if (data.status === 'posted' && !data.account_code) {
    errors.push('Cannot post expense without account code');
  }
  
  if (data.status === 'posted' && (data.total || 0) <= 0) {
    errors.push('Cannot post expense with zero or negative total');
  }
  
  // Validate items if provided
  if (Array.isArray(data.items) && data.items.length > 0) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item.account_code) {
        errors.push(`Item ${i + 1}: Account code is required`);
      }
      if ((item.amount || 0) <= 0) {
        errors.push(`Item ${i + 1}: Amount must be greater than zero`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate supplier invoice data
 * @param {Object} data - Supplier invoice data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateSupplierInvoice(data) {
  const errors = [];
  
  if (!data.supplier_id && !data.partner_id) {
    errors.push('Supplier ID is required');
  }
  
  if (!data.date) {
    errors.push('Invoice date is required');
  }
  
  if ((data.total || 0) < 0) {
    errors.push('Invoice total cannot be negative');
  }
  
  if ((data.subtotal || 0) < 0) {
    errors.push('Invoice subtotal cannot be negative');
  }
  
  if ((data.tax_amount || 0) < 0) {
    errors.push('Tax amount cannot be negative');
  }
  
  if ((data.discount_amount || 0) < 0) {
    errors.push('Discount amount cannot be negative');
  }
  
  // Validate total calculation
  const calculatedTotal = (data.subtotal || 0) - (data.discount_amount || 0) + (data.tax_amount || 0);
  if (Math.abs((data.total || 0) - calculatedTotal) > 0.01) {
    errors.push(`Total mismatch: expected ${calculatedTotal.toFixed(2)}, got ${(data.total || 0).toFixed(2)}`);
  }
  
  if (data.status === 'posted' && (data.total || 0) <= 0) {
    errors.push('Cannot post supplier invoice with zero or negative total');
  }
  
  // Validate lines if provided
  if (Array.isArray(data.lines) && data.lines.length > 0) {
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      if ((line.qty || 0) <= 0) {
        errors.push(`Line ${i + 1}: Quantity must be greater than zero`);
      }
      if ((line.unit_price || 0) < 0) {
        errors.push(`Line ${i + 1}: Unit price cannot be negative`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate journal entry data
 * @param {Object} data - Journal entry data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateJournalEntry(data) {
  const errors = [];
  
  if (!data.description || String(data.description).trim() === '') {
    errors.push('Journal entry description is required');
  }
  
  if (!data.date) {
    errors.push('Journal entry date is required');
  }
  
  if (!Array.isArray(data.postings) || data.postings.length === 0) {
    errors.push('Journal entry must have at least one posting');
  }
  
  // Validate postings balance
  if (Array.isArray(data.postings) && data.postings.length > 0) {
    const totalDebit = data.postings.reduce((sum, p) => sum + Number(p.debit || 0), 0);
    const totalCredit = data.postings.reduce((sum, p) => sum + Number(p.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Journal entry is unbalanced: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)}`);
    }
    
    // Validate each posting
    for (let i = 0; i < data.postings.length; i++) {
      const posting = data.postings[i];
      if (!posting.account_id) {
        errors.push(`Posting ${i + 1}: Account ID is required`);
      }
      if ((posting.debit || 0) < 0) {
        errors.push(`Posting ${i + 1}: Debit cannot be negative`);
      }
      if ((posting.credit || 0) < 0) {
        errors.push(`Posting ${i + 1}: Credit cannot be negative`);
      }
      if ((posting.debit || 0) > 0 && (posting.credit || 0) > 0) {
        errors.push(`Posting ${i + 1}: Cannot have both debit and credit`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
