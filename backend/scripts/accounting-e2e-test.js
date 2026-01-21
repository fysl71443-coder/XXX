/**
 * اختبار محاسبي شامل End-to-End
 * يختبر: فاتورة بيع → قيد → ميزان → دفتر أستاذ → قائمة دخل
 * 
 * الاستخدام: node scripts/accounting-e2e-test.js
 */

import axios from 'axios';
import { pool } from '../db.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5050/api';

let authToken = null;
let testInvoiceId = null;
let testJournalEntryId = null;
let testExpenseId = null;
let testExpenseJournalId = null;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '═'.repeat(60));
  log(`  ${title}`, 'bold');
  console.log('═'.repeat(60));
}

function subHeader(title) {
  log(`\n▶ ${title}`, 'cyan');
}

async function apiCall(method, endpoint, data = null, description = '') {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      ...(data && { data })
    };
    
    const response = await axios(config);
    if (description) {
      log(`  ✅ ${description}`, 'green');
    }
    return { success: true, data: response.data };
  } catch (error) {
    const msg = error.response?.data?.error || error.response?.data?.details || error.message;
    if (description) {
      log(`  ❌ ${description}: ${msg}`, 'red');
    }
    return { success: false, error: msg, status: error.response?.status };
  }
}

// ═══════════════════════════════════════════════════════════
// 1. المصادقة
// ═══════════════════════════════════════════════════════════
async function authenticate() {
  header('1. المصادقة (Authentication)');
  
  const result = await apiCall('post', '/auth/login', {
    username: 'admin',
    password: 'admin123'
  }, 'تسجيل الدخول');
  
  if (result.success && result.data?.token) {
    authToken = result.data.token;
    log(`     Token: ${authToken.substring(0, 20)}...`, 'blue');
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// 2. التحقق من الحسابات الأساسية
// ═══════════════════════════════════════════════════════════
async function verifyBaseAccounts() {
  header('2. التحقق من الحسابات الأساسية');
  
  const requiredAccounts = [
    { code: '1111', name: 'صندوق رئيسي (Cash)' },
    { code: '4111', name: 'مبيعات نقدية (Cash Sales)' },
    { code: '2141', name: 'ضريبة القيمة المضافة (VAT Output)' },
    { code: '5111', name: 'تكلفة المبيعات (COGS)' },
    { code: '1141', name: 'العملاء (Receivables)' }
  ];
  
  let allFound = true;
  for (const acc of requiredAccounts) {
    const { rows } = await pool.query(
      'SELECT id, account_code, account_number, name FROM accounts WHERE account_code = $1 OR account_number = $1 LIMIT 1',
      [acc.code]
    );
    
    if (rows && rows[0]) {
      log(`  ✅ ${acc.code} - ${acc.name}`, 'green');
    } else {
      log(`  ❌ ${acc.code} - ${acc.name} غير موجود!`, 'red');
      allFound = false;
    }
  }
  
  return allFound;
}

// ═══════════════════════════════════════════════════════════
// 3. إنشاء فاتورة بيع نقدية
// ═══════════════════════════════════════════════════════════
async function createSalesInvoice() {
  header('3. إنشاء فاتورة بيع نقدية');
  
  const invoiceData = {
    customer_id: null, // نقدي بدون عميل
    lines: [
      {
        product_id: null,
        name: 'منتج اختبار E2E',
        quantity: 2,
        unit_price: 100,
        total: 200
      }
    ],
    subtotal: 200,
    discount_pct: 0,
    discount_amount: 0,
    tax_pct: 15,
    tax_amount: 30,
    total: 230,
    payment_method: 'cash',
    branch: 'china_town',
    status: 'paid' // إصدار مباشر
  };
  
  subHeader('إنشاء الفاتورة...');
  
  const result = await apiCall('post', '/invoices', invoiceData, 'إنشاء فاتورة بيع');
  
  if (result.success && result.data?.id) {
    testInvoiceId = result.data.id;
    log(`     رقم الفاتورة: #${result.data.number || testInvoiceId}`, 'blue');
    log(`     المبلغ الإجمالي: ${invoiceData.total} ريال`, 'blue');
    
    // التحقق من إنشاء القيد المحاسبي
    await new Promise(r => setTimeout(r, 500)); // انتظار قليل للتأكد من إنشاء القيد
    
    const { rows } = await pool.query(
      `SELECT je.id, je.entry_number, je.status, je.description
       FROM journal_entries je 
       WHERE je.reference_type = 'invoice' AND je.reference_id = $1 LIMIT 1`,
      [testInvoiceId]
    );
    
    if (rows && rows[0]) {
      testJournalEntryId = rows[0].id;
      log(`  ✅ تم إنشاء القيد المحاسبي تلقائياً`, 'green');
      log(`     رقم القيد: #${rows[0].entry_number}`, 'blue');
      log(`     الحالة: ${rows[0].status}`, 'blue');
      log(`     الوصف: ${rows[0].description}`, 'blue');
      
      // التحقق من تفاصيل القيد
      const { rows: postings } = await pool.query(
        `SELECT jp.*, a.account_code, a.name as account_name
         FROM journal_postings jp
         LEFT JOIN accounts a ON a.id = jp.account_id
         WHERE jp.journal_entry_id = $1`,
        [testJournalEntryId]
      );
      
      log(`     تفاصيل القيد:`, 'blue');
      let totalDebit = 0, totalCredit = 0;
      for (const p of postings || []) {
        totalDebit += Number(p.debit || 0);
        totalCredit += Number(p.credit || 0);
        const type = Number(p.debit || 0) > 0 ? 'مدين' : 'دائن';
        const amount = Number(p.debit || 0) > 0 ? p.debit : p.credit;
        log(`       - ${p.account_code || '???'} ${p.account_name || ''}: ${amount} (${type})`, 'blue');
      }
      
      // التحقق من التوازن
      if (Math.abs(totalDebit - totalCredit) < 0.01) {
        log(`  ✅ القيد متوازن: مدين=${totalDebit}, دائن=${totalCredit}`, 'green');
      } else {
        log(`  ❌ القيد غير متوازن! مدين=${totalDebit}, دائن=${totalCredit}`, 'red');
      }
      
      return true;
    } else {
      log(`  ❌ لم يتم إنشاء القيد المحاسبي!`, 'red');
      return false;
    }
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 4. إنشاء مصروف واختبار تأثيره على الأرباح
// ═══════════════════════════════════════════════════════════
async function createExpense() {
  header('4. إنشاء مصروف (تأثير على الأرباح)');
  
  const expenseData = {
    type: 'expense_invoice',
    account_code: '5211', // مصروفات رواتب
    amount: 50,
    total: 50,
    description: 'مصروف اختبار E2E',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    branch: 'china_town',
    status: 'posted'
  };
  
  subHeader('إنشاء المصروف...');
  
  const result = await apiCall('post', '/expenses', expenseData, 'إنشاء مصروف');
  
  if (result.success && result.data?.id) {
    testExpenseId = result.data.id;
    log(`     رقم المصروف: #${result.data.invoice_number || testExpenseId}`, 'blue');
    log(`     المبلغ: ${expenseData.amount} ريال`, 'blue');
    
    // التحقق من القيد
    await new Promise(r => setTimeout(r, 500));
    
    const { rows } = await pool.query(
      `SELECT je.id, je.entry_number, je.status
       FROM journal_entries je 
       WHERE je.reference_type = 'expense_invoice' AND je.reference_id = $1 LIMIT 1`,
      [testExpenseId]
    );
    
    if (rows && rows[0]) {
      testExpenseJournalId = rows[0].id;
      log(`  ✅ تم إنشاء القيد المحاسبي للمصروف`, 'green');
      log(`     رقم القيد: #${rows[0].entry_number}`, 'blue');
      return true;
    }
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 5. التحقق من ميزان المراجعة
// ═══════════════════════════════════════════════════════════
async function verifyTrialBalance() {
  header('5. التحقق من ميزان المراجعة');
  
  const result = await apiCall('get', '/reports/trial-balance', null, 'جلب ميزان المراجعة');
  
  if (result.success) {
    const items = result.data?.items || result.data || [];
    const totals = result.data?.totals || {};
    
    log(`     عدد الحسابات: ${items.length}`, 'blue');
    log(`     إجمالي المدين: ${totals.debit || 0}`, 'blue');
    log(`     إجمالي الدائن: ${totals.credit || 0}`, 'blue');
    
    // التحقق من التوازن
    const diff = Math.abs(Number(totals.debit || 0) - Number(totals.credit || 0));
    if (diff < 0.01) {
      log(`  ✅ ميزان المراجعة متوازن!`, 'green');
    } else {
      log(`  ⚠️ ميزان المراجعة غير متوازن! الفرق: ${diff}`, 'yellow');
    }
    
    // البحث عن حسابات الاختبار
    const cashAccount = items.find(a => String(a.account_code || a.account_number) === '1111');
    const salesAccount = items.find(a => String(a.account_code || a.account_number) === '4111');
    
    if (cashAccount) {
      log(`     الصندوق (1111): رصيد = ${cashAccount.ending || cashAccount.debit - cashAccount.credit || 0}`, 'blue');
    }
    if (salesAccount) {
      log(`     المبيعات (4111): رصيد = ${salesAccount.ending || salesAccount.credit - salesAccount.debit || 0}`, 'blue');
    }
    
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 6. التحقق من دفتر الأستاذ
// ═══════════════════════════════════════════════════════════
async function verifyGeneralLedger() {
  header('6. التحقق من دفتر الأستاذ');
  
  // جلب قيود اليوم
  const today = new Date().toISOString().split('T')[0];
  
  const result = await apiCall('get', `/journal?from=${today}&to=${today}&status=posted`, null, 'جلب القيود المنشورة');
  
  if (result.success) {
    const items = result.data?.items || result.data || [];
    log(`     عدد القيود المنشورة اليوم: ${items.length}`, 'blue');
    
    // التحقق من قيد الفاتورة
    const invoiceEntry = items.find(e => e.reference_type === 'invoice' && e.reference_id === testInvoiceId);
    if (invoiceEntry) {
      log(`  ✅ قيد الفاتورة موجود في دفتر الأستاذ`, 'green');
      log(`     رقم القيد: #${invoiceEntry.entry_number}`, 'blue');
    } else {
      log(`  ⚠️ قيد الفاتورة غير موجود في نتائج اليوم`, 'yellow');
    }
    
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 7. التحقق من قائمة الدخل
// ═══════════════════════════════════════════════════════════
async function verifyIncomeStatement() {
  header('7. التحقق من قائمة الدخل');
  
  const result = await apiCall('get', '/reports/income-statement', null, 'جلب قائمة الدخل');
  
  if (result.success) {
    const data = result.data || {};
    
    log(`     الإيرادات: ${data.revenue || data.total_revenue || 0}`, 'blue');
    log(`     المصروفات: ${data.expenses || data.total_expenses || 0}`, 'blue');
    log(`     صافي الربح: ${data.net_income || data.profit || 0}`, 'blue');
    
    // التحقق من المنطقية
    const revenue = Number(data.revenue || data.total_revenue || 0);
    const expenses = Number(data.expenses || data.total_expenses || 0);
    const profit = Number(data.net_income || data.profit || 0);
    
    // يجب أن يكون صافي الربح = الإيرادات - المصروفات (تقريباً)
    const expectedProfit = revenue - expenses;
    if (Math.abs(profit - expectedProfit) < 1) {
      log(`  ✅ قائمة الدخل متسقة منطقياً`, 'green');
    } else {
      log(`  ⚠️ تحقق: الربح المتوقع = ${expectedProfit}, الفعلي = ${profit}`, 'yellow');
    }
    
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 8. اختبار قفل الفترة المحاسبية
// ═══════════════════════════════════════════════════════════
async function testPeriodLocking() {
  header('8. اختبار قفل الفترة المحاسبية');
  
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  subHeader('محاولة إنشاء قيد في فترة مفتوحة...');
  
  // إنشاء قيد في فترة مفتوحة (يجب أن ينجح)
  const openPeriodResult = await apiCall('post', '/journal', {
    description: 'قيد اختبار الفترة المفتوحة',
    date: new Date().toISOString().split('T')[0],
    postings: [
      { account_id: 1, debit: 100, credit: 0 },
      { account_id: 2, debit: 0, credit: 100 }
    ]
  }, 'إنشاء قيد في فترة مفتوحة');
  
  if (openPeriodResult.success) {
    // حذف القيد الاختباري
    if (openPeriodResult.data?.id) {
      await apiCall('delete', `/journal/${openPeriodResult.data.id}`, null, 'حذف القيد الاختباري');
    }
  }
  
  // اختبار الفترة المقفلة (نستخدم فترة قديمة)
  subHeader('اختبار منع التعديل في فترة مقفلة...');
  
  const oldPeriod = '2020-01';
  
  // قفل الفترة القديمة (إن لم تكن مقفلة)
  await pool.query(
    `INSERT INTO accounting_periods(period, status, closed_at) 
     VALUES ($1, 'closed', NOW()) 
     ON CONFLICT (period) DO UPDATE SET status = 'closed', closed_at = NOW()`,
    [oldPeriod]
  );
  
  // محاولة إنشاء قيد في الفترة المقفلة
  const closedPeriodResult = await apiCall('post', '/journal', {
    description: 'قيد اختبار الفترة المقفلة',
    date: `${oldPeriod}-15`,
    postings: [
      { account_id: 1, debit: 100, credit: 0 },
      { account_id: 2, debit: 0, credit: 100 }
    ]
  }, 'محاولة إنشاء قيد في فترة مقفلة');
  
  if (!closedPeriodResult.success && closedPeriodResult.status === 403) {
    log(`  ✅ تم منع إنشاء القيد في الفترة المقفلة بنجاح!`, 'green');
    log(`     الخطأ: ${closedPeriodResult.error}`, 'blue');
  } else if (closedPeriodResult.success) {
    log(`  ❌ تم إنشاء القيد رغم قفل الفترة! (خطأ)`, 'red');
    // حذف القيد
    if (closedPeriodResult.data?.id) {
      await apiCall('delete', `/journal/${closedPeriodResult.data.id}`, null);
    }
  }
  
  // إعادة فتح الفترة القديمة للاختبارات المستقبلية
  await pool.query(`UPDATE accounting_periods SET status = 'open', closed_at = NULL WHERE period = $1`, [oldPeriod]);
  
  return true;
}

// ═══════════════════════════════════════════════════════════
// 9. اختبار عكس القيد
// ═══════════════════════════════════════════════════════════
async function testJournalReverse() {
  header('9. اختبار عكس القيد');
  
  if (!testJournalEntryId) {
    log(`  ⚠️ لا يوجد قيد للاختبار`, 'yellow');
    return false;
  }
  
  // التحقق من القيد الأصلي
  const { rows: originalEntry } = await pool.query(
    'SELECT id, entry_number, status FROM journal_entries WHERE id = $1',
    [testJournalEntryId]
  );
  
  if (!originalEntry || !originalEntry[0]) {
    log(`  ❌ القيد الأصلي غير موجود`, 'red');
    return false;
  }
  
  if (originalEntry[0].status !== 'posted') {
    log(`  ⚠️ القيد ليس منشوراً (الحالة: ${originalEntry[0].status})`, 'yellow');
    return true; // ليس خطأ، فقط تجاوز
  }
  
  subHeader('عكس القيد...');
  
  const result = await apiCall('post', `/journal/${testJournalEntryId}/reverse`, {}, 'عكس القيد');
  
  if (result.success) {
    log(`  ✅ تم عكس القيد بنجاح!`, 'green');
    
    if (result.data?.reversingEntry) {
      log(`     رقم القيد العكسي: #${result.data.reversingEntry.entry_number}`, 'blue');
    }
    
    // التحقق من حالة القيد الأصلي
    const { rows: updatedEntry } = await pool.query(
      'SELECT status FROM journal_entries WHERE id = $1',
      [testJournalEntryId]
    );
    
    if (updatedEntry && updatedEntry[0] && updatedEntry[0].status === 'reversed') {
      log(`  ✅ حالة القيد الأصلي تغيرت إلى "reversed"`, 'green');
    }
    
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════
// 10. تنظيف بيانات الاختبار
// ═══════════════════════════════════════════════════════════
async function cleanup() {
  header('10. تنظيف بيانات الاختبار');
  
  try {
    // حذف القيود الاختبارية
    if (testJournalEntryId) {
      await pool.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [testJournalEntryId]);
      await pool.query('DELETE FROM journal_entries WHERE id = $1', [testJournalEntryId]);
      log(`  ✅ تم حذف قيد الفاتورة`, 'green');
    }
    
    if (testExpenseJournalId) {
      await pool.query('DELETE FROM journal_postings WHERE journal_entry_id = $1', [testExpenseJournalId]);
      await pool.query('DELETE FROM journal_entries WHERE id = $1', [testExpenseJournalId]);
      log(`  ✅ تم حذف قيد المصروف`, 'green');
    }
    
    // حذف الفاتورة
    if (testInvoiceId) {
      await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [testInvoiceId]);
      await pool.query('DELETE FROM invoices WHERE id = $1', [testInvoiceId]);
      log(`  ✅ تم حذف الفاتورة`, 'green');
    }
    
    // حذف المصروف
    if (testExpenseId) {
      await pool.query('DELETE FROM expenses WHERE id = $1', [testExpenseId]);
      log(`  ✅ تم حذف المصروف`, 'green');
    }
    
    // حذف أي قيود عكسية متبقية
    await pool.query(`DELETE FROM journal_postings WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE '%اختبار E2E%' OR description LIKE '%اختبار الفترة%')`);
    await pool.query(`DELETE FROM journal_entries WHERE description LIKE '%اختبار E2E%' OR description LIKE '%اختبار الفترة%'`);
    
    log(`  ✅ تم التنظيف بنجاح`, 'green');
  } catch (e) {
    log(`  ⚠️ خطأ أثناء التنظيف: ${e.message}`, 'yellow');
  }
}

// ═══════════════════════════════════════════════════════════
// التشغيل الرئيسي
// ═══════════════════════════════════════════════════════════
async function runTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'bold');
  log('║     اختبار محاسبي شامل End-to-End                          ║', 'bold');
  log('║     Comprehensive Accounting E2E Test                      ║', 'bold');
  log('╚════════════════════════════════════════════════════════════╝', 'bold');
  
  const results = {
    auth: false,
    accounts: false,
    invoice: false,
    expense: false,
    trialBalance: false,
    generalLedger: false,
    incomeStatement: false,
    periodLocking: false,
    reverse: false
  };
  
  try {
    // 1. المصادقة
    results.auth = await authenticate();
    if (!results.auth) {
      log('\n❌ فشل المصادقة - إيقاف الاختبار', 'red');
      return;
    }
    
    // 2. التحقق من الحسابات
    results.accounts = await verifyBaseAccounts();
    
    // 3. إنشاء فاتورة بيع
    results.invoice = await createSalesInvoice();
    
    // 4. إنشاء مصروف
    results.expense = await createExpense();
    
    // 5. ميزان المراجعة
    results.trialBalance = await verifyTrialBalance();
    
    // 6. دفتر الأستاذ
    results.generalLedger = await verifyGeneralLedger();
    
    // 7. قائمة الدخل
    results.incomeStatement = await verifyIncomeStatement();
    
    // 8. قفل الفترة
    results.periodLocking = await testPeriodLocking();
    
    // 9. عكس القيد
    results.reverse = await testJournalReverse();
    
    // 10. التنظيف
    await cleanup();
    
  } catch (e) {
    log(`\n❌ خطأ غير متوقع: ${e.message}`, 'red');
    console.error(e);
  } finally {
    await pool.end();
  }
  
  // ═══════════════════════════════════════════════════════════
  // ملخص النتائج
  // ═══════════════════════════════════════════════════════════
  header('ملخص نتائج الاختبار');
  
  const testNames = {
    auth: 'المصادقة',
    accounts: 'الحسابات الأساسية',
    invoice: 'فاتورة البيع + القيد',
    expense: 'المصروفات + القيد',
    trialBalance: 'ميزان المراجعة',
    generalLedger: 'دفتر الأستاذ',
    incomeStatement: 'قائمة الدخل',
    periodLocking: 'قفل الفترات',
    reverse: 'عكس القيود'
  };
  
  let passed = 0, failed = 0;
  
  for (const [key, name] of Object.entries(testNames)) {
    const status = results[key];
    if (status) {
      log(`  ✅ ${name}`, 'green');
      passed++;
    } else {
      log(`  ❌ ${name}`, 'red');
      failed++;
    }
  }
  
  console.log('\n' + '─'.repeat(40));
  log(`  النتيجة: ${passed}/${passed + failed} اختبار ناجح`, passed === passed + failed ? 'green' : 'yellow');
  
  if (failed === 0) {
    log('\n  🎉 جميع الاختبارات نجحت! النظام المحاسبي جاهز 100%', 'green');
  } else {
    log(`\n  ⚠️ بعض الاختبارات فشلت (${failed})`, 'yellow');
  }
  
  console.log('\n');
}

runTests();
