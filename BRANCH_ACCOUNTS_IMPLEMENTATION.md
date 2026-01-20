# 📋 تطبيق جدول branch_accounts - الحل العملي

## ✅ ما تم إنجازه

### 1️⃣ إنشاء جدول `branch_accounts`

**الملف**: `backend/scripts/create_branch_accounts_table.js`

```sql
CREATE TABLE IF NOT EXISTS branch_accounts (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER,
  branch_name TEXT NOT NULL,
  account_type TEXT NOT NULL,  -- 'sales_cash', 'sales_credit', 'payment_cash', 'payment_bank'
  account_number TEXT NOT NULL,  -- رقم الحساب مثل '4111', '4112', '1111', '1121'
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_name, account_type)
);
```

### 2️⃣ تعديل `createInvoiceJournalEntry`

**الملف**: `backend/server.js`

#### أ) إضافة دالة مساعدة `getBranchAccountNumber`:

```javascript
async function getBranchAccountNumber(branch, accountType, db) {
  // Normalize branch name
  const branchLower = String(branch || '').toLowerCase().trim();
  const normalizedBranch = branchLower.includes('place_india') || branchLower.includes('palace_india') 
    ? 'place_india' 
    : (branchLower.includes('china_town') ? 'china_town' : branchLower);
  
  // Query branch_accounts table
  const { rows } = await db.query(
    'SELECT account_number FROM branch_accounts WHERE branch_name = $1 AND account_type = $2 AND is_active = true LIMIT 1',
    [normalizedBranch, accountType]
  );
  
  if (rows && rows[0] && rows[0].account_number) {
    return rows[0].account_number;
  }
  
  // Fallback to hardcoded defaults if not found
  return null;
}
```

#### ب) استخدام `getBranchAccountNumber` للحسابات:

**لحساب المبيعات**:
```javascript
// قبل:
salesAccountNumber = isCreditSale ? '4112' : '4111';  // ثابت

// بعد:
const accountType = isCreditSale ? 'sales_credit' : 'sales_cash';
salesAccountNumber = await getBranchAccountNumber(branch, accountType, db);
// Fallback to defaults if not found
```

**لحساب الدفع**:
```javascript
// قبل:
paymentAccountNumber = '1111' or '1121';  // ثابت

// بعد:
if (paymentMethod === 'bank') {
  paymentAccountNumber = await getBranchAccountNumber(branch, 'payment_bank', db);
} else {
  paymentAccountNumber = await getBranchAccountNumber(branch, 'payment_cash', db);
}
// Fallback to defaults if not found
```

---

## 🚀 كيفية الاستخدام

### 1. إنشاء الجدول وتعبئة البيانات:

```bash
cd backend
node scripts/create_branch_accounts_table.js
```

**النتيجة**:
- ✅ جدول `branch_accounts` يتم إنشاؤه
- ✅ بيانات افتراضية يتم إضافتها للفروع:
  - `china_town` → `4111` (cash), `4112` (credit)
  - `place_india` → `4121` (cash), `4122` (credit)
  - `payment_cash` → `1111`
  - `payment_bank` → `1121`

### 2. التحقق من البيانات:

```sql
-- عرض جميع حسابات الفروع
SELECT * FROM branch_accounts ORDER BY branch_name, account_type;

-- عرض حسابات فرع معين
SELECT * FROM branch_accounts WHERE branch_name = 'china_town';
```

### 3. تحديث الحسابات (إذا لزم الأمر):

```sql
-- تحديث حساب مبيعات نقدية لفرع معين
UPDATE branch_accounts 
SET account_number = '4111', account_id = (SELECT id FROM accounts WHERE account_number = '4111')
WHERE branch_name = 'china_town' AND account_type = 'sales_cash';
```

---

## 💡 الفوائد

### ✅ المرونة:
- إمكانية ربط حساب مختلف لكل فرع
- إمكانية تغيير الحسابات دون تعديل الكود

### ✅ الوضوح:
- جميع حسابات الفرع في مكان واحد
- سهولة الصيانة والتحديث

### ✅ الأمان:
- Fallback إلى القيم الافتراضية إذا لم يكن الحساب موجوداً
- التحقق من `is_active` قبل الاستخدام

### ✅ القابلية للتوسع:
- إمكانية إضافة حسابات جديدة بسهولة
- إمكانية ربط حسابات متعددة لكل فرع

---

## 🔧 أنواع الحسابات المدعومة

| account_type | الوصف | مثال |
|-------------|--------|------|
| `sales_cash` | مبيعات نقدية | `4111`, `4121` |
| `sales_credit` | مبيعات آجلة | `4112`, `4122` |
| `payment_cash` | حساب الصندوق | `1111` |
| `payment_bank` | حساب البنك | `1121` |

---

## ⚠️ ملاحظات مهمة

1. **Fallback Mechanism**: إذا لم يُوجد الحساب في `branch_accounts`، سيتم استخدام القيم الافتراضية (الكود القديم)

2. **Normalization**: يتم تطبيع اسم الفرع تلقائياً:
   - `place_india`, `palace_india` → `place_india`
   - `china_town` → `china_town`

3. **Account ID**: الجدول يحتوي على `account_id` (مرجع إلى `accounts`) لكن الكود يستخدم `account_number` مباشرة

---

## 📝 للاختبار

بعد إنشاء الجدول، جرّب:

```bash
# 1. إنشاء الفاتورة
# 2. التحقق من server logs:
#    - يجب أن ترى: "Account loaded from branch_accounts"
#    - أو: "Account not found in branch_accounts, using fallback"

# 3. التحقق من journal entry:
#    - يجب أن يستخدم الحساب الصحيح من branch_accounts
```

---

## ✅ الخلاصة

✅ **تم إنشاء جدول `branch_accounts`**  
✅ **تم تعديل `createInvoiceJournalEntry` لاستخدام الجدول**  
✅ **تم إضافة Fallback للقيم الافتراضية**  

**الخطوة التالية**: تشغيل migration script لإنشاء الجدول!
