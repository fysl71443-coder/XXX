# 📊 الحسابات المستخدمة في إنشاء فاتورة المبيعات وكيفية الحساب

## 🏦 الحسابات المستخدمة (Accounts)

### 1️⃣ Debit (مدين) - حسب طريقة الدفع

#### أ) الدفع النقدي (Cash) - الحساب `1111`
```javascript
// السطر 5370-5375
paymentAccountNumber = '1111'; // صندوق رئيسي
postings.push({ account_id: paymentAccountId, debit: total, credit: 0 });
```

#### ب) الدفع بالبطاقة/البنك (Card/Bank) - الحساب `1121`
```javascript
// السطر 5365-5367
paymentAccountNumber = '1121'; // Al Rajhi Bank
postings.push({ account_id: paymentAccountId, debit: total, credit: 0 });
```

#### ج) البيع الآجل (Credit Sale) - حساب العميل (تحت `1141`)
```javascript
// السطر 5347-5351
const customerAccountId = await getOrCreatePartnerAccount(customerId, 'customer', db);
postings.push({ account_id: customerAccountId, debit: total, credit: 0 });
```

#### د) تكلفة المبيعات (COGS) - الحساب `5110`
```javascript
// السطر 5438-5442
const cogsAccountId = await getAccountIdByNumber('5110', db); // تكلفة المبيعات
postings.push({ account_id: cogsAccountId, debit: totalCOGS, credit: 0 });
```

---

### 2️⃣ Credit (دائن) - حسب الفرع وطريقة الدفع

#### أ) مبيعات نقدية - China Town - الحساب `4111`
```javascript
// السطر 5336-5342
if (branch === 'china_town' && !isCreditSale) {
  salesAccountNumber = '4111'; // مبيعات نقدية - China Town
}
postings.push({ account_id: salesAccountId, debit: 0, credit: subtotal - discount });
```

#### ب) مبيعات نقدية - Place India - الحساب `4121`
```javascript
// السطر 5339-5340
if (branch === 'place_india' && !isCreditSale) {
  salesAccountNumber = '4121'; // مبيعات نقدية - Place India
}
```

#### ج) مبيعات آجلة - China Town - الحساب `4112`
```javascript
// السطر 5342
if (branch === 'china_town' && isCreditSale) {
  salesAccountNumber = '4112'; // مبيعات آجلة - China Town
}
```

#### د) مبيعات آجلة - Place India - الحساب `4122`
```javascript
// السطر 5340
if (branch === 'place_india' && isCreditSale) {
  salesAccountNumber = '4122'; // مبيعات آجلة - Place India
}
```

#### هـ) ضريبة القيمة المضافة - الحساب `2141`
```javascript
// السطر 5397-5401
if (tax > 0) {
  const vatAccountId = await getAccountIdByNumber('2141', db);
  postings.push({ account_id: vatAccountId, debit: 0, credit: tax });
}
```

#### و) المخزون (للـ COGS) - الحساب `1130`
```javascript
// السطر 5439-5445
const inventoryAccountId = await getAccountIdByNumber('1130', db); // المخزون
postings.push({ account_id: inventoryAccountId, debit: 0, credit: totalCOGS });
```

---

## 🧮 كيفية الحساب (Calculation)

### المعادلة الأساسية:

```
Total = Subtotal - Discount + Tax
```

### في القيد المحاسبي:

#### 1. Debit (مدين):
```javascript
// السطر 5351 أو 5375 أو 5357
debit = total  // إجمالي المبلغ المستلم
```

#### 2. Credit (دائن):
```javascript
// السطر 5393
credit_sales = subtotal - discount  // صافي المبيعات بعد الخصم

// السطر 5400
credit_vat = tax  // ضريبة القيمة المضافة
```

#### 3. التوازن (Balance):
```javascript
// السطر 5451-5453
totalDebit = total  // من حساب الصندوق/البنك/العميل
totalCredit = (subtotal - discount) + tax  // من حساب المبيعات + الضريبة

// يجب أن يكون: totalDebit === totalCredit
// إذا: total = (subtotal - discount) + tax ✅
```

---

## 💰 الخصم (Discount) - كيف يتم حسابه؟

### ✅ الخصم يتم حسابه ويُخصم من المبيعات

#### الموقع: `backend/server.js:5393`

```javascript
// Credit: Sales Revenue (بعد خصم الخصم)
postings.push({ 
  account_id: salesAccountId, 
  debit: 0, 
  credit: subtotal - discount  // ⚠️ الخصم يُخصم هنا
});
```

### 📝 مثال:

```javascript
// بيانات الفاتورة:
subtotal = 100.00
discount = 10.00
tax = 15% * (100 - 10) = 13.50
total = 100 - 10 + 13.50 = 103.50

// القيد المحاسبي:
// Debit (مدين):
//   1111 (صندوق) = 103.50

// Credit (دائن):
//   4111 (مبيعات) = 100 - 10 = 90.00  ✅ الخصم مُخصوم
//   2141 (ضريبة)  = 13.50

// التوازن:
//   Total Debit  = 103.50
//   Total Credit = 90.00 + 13.50 = 103.50 ✅
```

### ⚠️ ملاحظة مهمة:

**الخصم لا يُحسب كحساب منفصل**، بل يُخصم مباشرة من حساب المبيعات:
- ❌ لا يوجد: `4190 (خصم مسموح)` في credit
- ✅ يوجد: `credit = subtotal - discount` (الخصم مُضمن)

---

## ⚠️ لماذا لا ينجح إنشاء القيد؟ (Why Journal Entry Fails)

### الأسباب المحتملة للفشل:

#### 1️⃣ **الحسابات غير موجودة** (Accounts Missing)

**الموقع**: `backend/server.js:5385` أو `5391` أو `5398`

```javascript
// إذا كان الحساب غير موجود:
const paymentAccountId = await getAccountIdByNumber('1111', db);
if (!paymentAccountId) {
  console.error('[ACCOUNTING] CRITICAL: Payment account not found!');
  return null;  // ❌ يرجع null → ROLLBACK
}

const salesAccountId = await getAccountIdByNumber(salesAccountNumber, db);
if (!salesAccountId) {
  // ❌ يرجع null → ROLLBACK
}
```

**الحل**: التأكد من وجود الحسابات التالية:
- `1111` (صندوق رئيسي)
- `1121` (بنك) - إذا كان الدفع بالبطاقة
- `4111` (مبيعات نقدية - China Town)
- `4121` (مبيعات نقدية - Place India)
- `4112` (مبيعات آجلة - China Town)
- `4122` (مبيعات آجلة - Place India)
- `2141` (ضريبة القيمة المضافة)

#### 2️⃣ **القيد غير متوازن** (Unbalanced Entry)

**الموقع**: `backend/server.js:5453-5465`

```javascript
// التحقق من التوازن:
const totalDebit = postings.reduce((sum, p) => sum + Number(p.debit || 0), 0);
const totalCredit = postings.reduce((sum, p) => sum + Number(p.credit || 0), 0);

if (Math.abs(totalDebit - totalCredit) > 0.01) {
  console.error('[ACCOUNTING] Journal entry unbalanced:', {
    totalDebit,
    totalCredit,
    difference: Math.abs(totalDebit - totalCredit)
  });
  return null;  // ❌ يرجع null → ROLLBACK
}
```

**السبب المحتمل**:
- حساب الخصم غير صحيح
- حساب الضريبة غير صحيح
- `total` ≠ `(subtotal - discount) + tax`

#### 3️⃣ **لا يوجد postings** (No Postings)

**الموقع**: `backend/server.js:5469-5478`

```javascript
if (postings.length === 0) {
  console.error('[ACCOUNTING] No postings created for invoice:', invoiceId);
  return null;  // ❌ يرجع null → ROLLBACK
}
```

#### 4️⃣ **فشل إنشاء journal entry** (Failed to Create Entry)

**الموقع**: `backend/server.js:5491-5501`

```javascript
const entryId = entryRows && entryRows[0] ? entryRows[0].id : null;
if (!entryId) {
  console.error('[ACCOUNTING] Failed to create journal entry');
  return null;  // ❌ يرجع null → ROLLBACK
}
```

#### 5️⃣ **فشل إنشاء postings** (Failed to Create Postings)

**الموقع**: `backend/server.js:5506-5532`

```javascript
try {
  for (const posting of postings) {
    if (!posting.account_id) {
      throw new Error(`Posting has missing account_id`);
    }
    await db.query(
      'INSERT INTO journal_postings(...) VALUES ($1,$2,$3,$4)',
      [entryId, posting.account_id, posting.debit, posting.credit]
    );
  }
} catch (postingError) {
  console.error('[ACCOUNTING] Error creating journal postings:', postingError);
  throw postingError;  // ❌ يرجع null → ROLLBACK
}
```

#### 6️⃣ **خطأ عام في try-catch** (General Error)

**الموقع**: `backend/server.js:5537-5540`

```javascript
} catch (e) {
  console.error('[ACCOUNTING] Error creating journal entry:', invoiceId, e);
  return null;  // ❌ يرجع null → ROLLBACK
}
```

---

## 🔍 للتحقق من المشكلة

### 1. فحص وجود الحسابات:

```sql
SELECT id, account_number, name 
FROM accounts 
WHERE account_number IN ('1111', '1121', '4111', '4121', '4112', '4122', '2141');
```

### 2. فحص server logs:

ابحث عن:
- `[ACCOUNTING] CRITICAL: Payment account not found`
- `[ACCOUNTING] Journal entry unbalanced`
- `[ACCOUNTING] No postings created`
- `[ACCOUNTING] Error creating journal entry`
- `[ACCOUNTING] Error creating journal postings`

### 3. حساب التوازن يدوياً:

```javascript
// مثال:
subtotal = 100.00
discount = 10.00
tax = 13.50
total = 103.50

// Debit:
debit = 103.50  // من 1111 (صندوق)

// Credit:
credit_sales = 100 - 10 = 90.00  // من 4111 (مبيعات)
credit_vat = 13.50  // من 2141 (ضريبة)

// التوازن:
totalDebit = 103.50
totalCredit = 90.00 + 13.50 = 103.50  ✅ متوازن
```

---

## ✅ الخلاصة

1. **الحسابات المستخدمة**:
   - Debit: `1111` (صندوق) أو `1121` (بنك) أو حساب العميل (للبيع الآجل)
   - Credit: `4111/4121/4112/4122` (مبيعات) + `2141` (ضريبة)

2. **الخصم**: يُخصم من المبيعات (`credit = subtotal - discount`)

3. **التوازن**: `total = (subtotal - discount) + tax`

4. **فشل القيد**: غالباً بسبب:
   - حساب مفقود في قاعدة البيانات
   - القيد غير متوازن
   - خطأ في حساب المبالغ
