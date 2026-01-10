const { sequelize, Account, Invoice, JournalEntry, JournalPosting, PayrollRun } = require('./models');

async function testPayment() {
  const t = await sequelize.transaction();
  try {
    console.log('Starting transaction...');
    
    // Inputs
    const date = '2025-12-18';
    const amount = 2000;
    const payment_method = 'cash';
    const account_code = '2430'; // Salaries Payable
    const expense_type = 'payment';
    const payment_details = { payment_type: 'salary', payroll_run_id: 3 };
    const description = 'Test Salary Payment';
    const attachments = { branch: 'Main' };

    // 1. Validate Amount
    if (amount <= 0) throw new Error('invalid_amount');

    // 2. Find Payment Account (Cash)
    let payAcc = await Account.findOne({ where: { account_code: '1110' }, transaction: t });
    if (!payAcc) throw new Error('payment_account_not_found');
    console.log('Payment Account:', payAcc.account_code);

    // 3. Find Expense/Liability Account (2430)
    let acc = await Account.findOne({ where: { account_code: account_code }, transaction: t });
    if (!acc) throw new Error('account_not_found');
    console.log('Liability Account:', acc.account_code);

    // 4. Create Invoice
    const inv = await Invoice.create({
      invoice_number: 'TEST-' + Date.now(),
      type: 'expense',
      expense_type: expense_type,
      date: date,
      total: amount,
      tax: 0,
      status: 'draft',
      payment_method: payment_method,
      expense_account_code: acc.account_code,
      payment_account_code: payAcc.account_code,
      attachments: JSON.stringify(attachments)
    }, { transaction: t });
    console.log('Invoice created:', inv.id);

    // 5. Create Journal Entry
    const entry = await JournalEntry.create({
      date: date,
      debit: amount,
      credit: amount,
      description: description,
      status: 'draft',
      related_type: 'expense_invoice',
      related_id: inv.id
    }, { transaction: t });
    console.log('Journal Entry created:', entry.id);

    // 6. Postings
    // Credit Cash
    await JournalPosting.create({ journal_entry_id: entry.id, account_id: payAcc.id, debit: 0, credit: amount }, { transaction: t });
    // Debit Liability
    await JournalPosting.create({ journal_entry_id: entry.id, account_id: acc.id, debit: amount, credit: 0 }, { transaction: t });

    // 7. Link Payroll
    console.log('Linking Payroll Run:', payment_details.payroll_run_id);
    const run = await PayrollRun.findByPk(payment_details.payroll_run_id, { transaction: t });
    if (!run) throw new Error('payroll_run_not_found');
    
    // Simulate update
    await PayrollRun.update({ status: 'paid', posted_at: new Date() }, { where: { id: payment_details.payroll_run_id }, transaction: t });
    console.log('Payroll Run updated');

    await t.commit();
    console.log('Success!');
  } catch (e) {
    await t.rollback();
    console.error('Failed:', e.message);
  } finally {
    await sequelize.close();
  }
}

testPayment();
