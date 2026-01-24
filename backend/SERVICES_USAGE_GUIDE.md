# دليل استخدام الخدمات الجديدة (Services Usage Guide)

**التاريخ:** 2026-01-22  
**الحالة:** ✅ تم إنشاء الخدمات الجديدة

---

## 1. Journal Entry Service

### 1.1 الوصف
خدمة موحدة لإنشاء القيود المحاسبية، تقضي على التكرار في الكود.

**الملف:** `backend/services/journalEntryService.js`

### 1.2 الدوال المتاحة

#### `createJournalEntry(params)`
دالة أساسية لإنشاء قيد محاسبي.

**المعاملات:**
- `description` (string) - وصف القيد
- `date` (Date|string) - تاريخ القيد
- `postings` (Array) - مصفوفة من {account_id, debit, credit}
- `referenceType` (string) - نوع المرجع (invoice, expense, etc.)
- `referenceId` (number) - معرف المرجع
- `status` (string) - حالة القيد (افتراضي: 'posted')
- `branch` (string) - اسم الفرع
- `client` (Object) - عميل قاعدة البيانات (للمعاملات)

**مثال:**
```javascript
import { createJournalEntry } from './services/journalEntryService.js';

const entryId = await createJournalEntry({
  description: 'قيد محاسبي',
  date: new Date(),
  postings: [
    { account_id: 1, debit: 100, credit: 0 },
    { account_id: 2, debit: 0, credit: 100 }
  ],
  referenceType: 'invoice',
  referenceId: 123,
  status: 'posted',
  branch: 'china_town',
  client: client // للاستخدام داخل transaction
});
```

#### `createInvoiceJournalEntry(...)`
دالة مخصصة لإنشاء قيد لفاتورة مبيعات.

**المعاملات:**
- `invoiceId` (number) - معرف الفاتورة
- `customerId` (number) - معرف العميل
- `subtotal` (number) - الإجمالي الفرعي
- `discount` (number) - الخصم
- `tax` (number) - الضريبة
- `total` (number) - الإجمالي
- `paymentMethod` (string) - طريقة الدفع
- `branch` (string) - اسم الفرع
- `client` (Object) - عميل قاعدة البيانات

**مثال:**
```javascript
import { createInvoiceJournalEntry } from './services/journalEntryService.js';

const entryId = await createInvoiceJournalEntry(
  invoiceId,
  customerId,
  subtotal,
  discount,
  tax,
  total,
  paymentMethod,
  branch,
  client
);
```

#### `createExpenseJournalEntry(...)`
دالة مخصصة لإنشاء قيد لمصروف.

#### `createSupplierInvoiceJournalEntry(...)`
دالة مخصصة لإنشاء قيد لفاتورة مورد.

---

## 2. Transaction Wrapper

### 2.1 الوصف
Wrapper لتبسيط استخدام المعاملات (transactions) وضمان التنظيف الصحيح.

**الملف:** `backend/utils/transaction.js`

### 2.2 الاستخدام

#### `withTransaction(callback)`
تنفيذ callback داخل معاملة قاعدة بيانات.

**مثال:**
```javascript
import { withTransaction } from './utils/transaction.js';

try {
  const result = await withTransaction(async (client) => {
    // جميع العمليات هنا داخل transaction
    const { rows } = await client.query('INSERT INTO invoices ...');
    await client.query('UPDATE invoices SET journal_entry_id = ...');
    return rows[0];
  });
  
  res.json(result);
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

**الفوائد:**
- ✅ يضمن COMMIT تلقائياً عند النجاح
- ✅ يضمن ROLLBACK تلقائياً عند الخطأ
- ✅ يضمن إطلاق client.release() دائماً
- ✅ يقلل من الأخطاء البرمجية

#### `withTransactionRetry(callback, maxRetries, delayMs)`
تنفيذ callback مع إعادة المحاولة في حالة الفشل.

**مثال:**
```javascript
import { withTransactionRetry } from './utils/transaction.js';

const result = await withTransactionRetry(
  async (client) => {
    // ...
  },
  3, // maxRetries
  1000 // delayMs
);
```

---

## 3. Input Sanitization

### 3.1 الوصف
أدوات لتنظيف البيانات المدخلة لمنع SQL injection و XSS.

**الملف:** `backend/utils/sanitizer.js`

### 3.2 الدوال المتاحة

#### `sanitizeString(input, maxLength)`
تنظيف نص.

**مثال:**
```javascript
import { sanitizeString } from './utils/sanitizer.js';

const cleanName = sanitizeString(req.body.name, 100);
```

#### `sanitizeNumber(input, min, max)`
تنظيف رقم.

**مثال:**
```javascript
import { sanitizeNumber } from './utils/sanitizer.js';

const cleanTotal = sanitizeNumber(req.body.total, 0, 1000000);
```

#### `sanitizeDate(input)`
تنظيف تاريخ.

**مثال:**
```javascript
import { sanitizeDate } from './utils/sanitizer.js';

const cleanDate = sanitizeDate(req.body.date);
```

#### `sanitizeEmail(input)`
تنظيف بريد إلكتروني.

#### `sanitizePhone(input)`
تنظيف رقم هاتف.

#### `sanitizeJSON(input)`
تنظيف JSON (لـ JSONB columns).

---

## 4. أمثلة الاستخدام الكاملة

### 4.1 مثال: إنشاء فاتورة مع قيد

```javascript
import { withTransaction } from './utils/transaction.js';
import { createInvoiceJournalEntry } from './services/journalEntryService.js';
import { sanitizeString, sanitizeNumber, sanitizeDate } from './utils/sanitizer.js';
import { validateInvoice } from './utils/validators.js';

app.post("/api/invoices", authenticateToken, authorize("sales","create"), async (req, res) => {
  try {
    // Sanitize input
    const invoiceData = {
      number: sanitizeString(req.body.number, 50),
      date: sanitizeDate(req.body.date),
      subtotal: sanitizeNumber(req.body.subtotal, 0),
      total: sanitizeNumber(req.body.total, 0),
      // ...
    };
    
    // Validate
    const validation = validateInvoice(invoiceData);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: "validation_failed", 
        details: validation.errors 
      });
    }
    
    // Create invoice with transaction
    const invoice = await withTransaction(async (client) => {
      // Insert invoice
      const { rows } = await client.query(
        'INSERT INTO invoices(...) VALUES (...) RETURNING *',
        [...]
      );
      
      const invoice = rows[0];
      
      // Create journal entry
      if (invoice.status === 'posted' && invoice.total > 0) {
        const journalEntryId = await createInvoiceJournalEntry(
          invoice.id,
          invoice.customer_id,
          invoice.subtotal,
          invoice.discount_amount,
          invoice.tax_amount,
          invoice.total,
          invoice.payment_method,
          invoice.branch,
          client
        );
        
        // Link journal entry
        await client.query(
          'UPDATE invoices SET journal_entry_id = $1 WHERE id = $2',
          [journalEntryId, invoice.id]
        );
      }
      
      return invoice;
    });
    
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 5. خطوات الترحيل (Migration Steps)

### 5.1 ترحيل الكود الموجود

**قبل:**
```javascript
// كود مكرر في كل مكان
const entryNumber = await getNextEntryNumber();
const postings = [];
// ... بناء postings ...
const { rows: entryRows } = await client.query(
  'INSERT INTO journal_entries(...) VALUES (...) RETURNING id',
  [...]
);
// ... إنشاء postings ...
```

**بعد:**
```javascript
import { createInvoiceJournalEntry } from './services/journalEntryService.js';

const journalEntryId = await createInvoiceJournalEntry(
  invoiceId,
  customerId,
  subtotal,
  discount,
  tax,
  total,
  paymentMethod,
  branch,
  client
);
```

### 5.2 ترحيل Transactions

**قبل:**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

**بعد:**
```javascript
import { withTransaction } from './utils/transaction.js';

await withTransaction(async (client) => {
  // ... operations ...
});
```

---

## 6. ملاحظات مهمة

### 6.1 Journal Entry Service
- ✅ يزيل التكرار في الكود
- ✅ يوفر validation موحد
- ✅ يضمن التوازن في القيود
- ⚠️ **ملاحظة:** يجب تحديث الكود الموجود لاستخدام الخدمة الجديدة

### 6.2 Transaction Wrapper
- ✅ يبسط استخدام transactions
- ✅ يقلل الأخطاء
- ⚠️ **ملاحظة:** يمكن استخدامه تدريجياً في الكود الموجود

### 6.3 Input Sanitization
- ✅ يمنع SQL injection
- ✅ يمنع XSS
- ⚠️ **ملاحظة:** يجب تطبيقه على جميع المدخلات

---

**تم إنشاء الدليل:** 2026-01-22  
**آخر تحديث:** 2026-01-22
