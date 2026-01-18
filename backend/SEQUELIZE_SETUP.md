# دليل إعداد Sequelize ORM

## ✅ ما تم إنجازه

### 1. تثبيت الحزم
```bash
npm install sequelize pg-hstore
```

### 2. الملفات المنشأة

| الملف | الوصف |
|-------|-------|
| `db-sequelize.js` | إعداد الاتصال بـ Sequelize |
| `models/Account.js` | موديل الحسابات |
| `models/JournalEntry.js` | موديل القيود المحاسبية |
| `models/JournalPosting.js` | موديل سطور القيود |
| `models/Expense.js` | موديل المصروفات |
| `models/Invoice.js` | موديل الفواتير |
| `models/index.js` | تصدير جميع الموديلات والعلاقات |
| `scripts/sync-sequelize.js` | سكريبت مزامنة الجداول |

---

## 🚀 طريقة الاستخدام

### 1. مزامنة الجداول

```bash
# مع DATABASE_URL في .env
node backend/scripts/sync-sequelize.js

# أو مع DATABASE_URL مباشرة
DATABASE_URL=postgresql://user:pass@host:port/dbname node backend/scripts/sync-sequelize.js
```

**ما يفعله `sync-sequelize.js`:**
- ✅ يتحقق من الاتصال بقاعدة البيانات
- ✅ يضيف الأعمدة المفقودة (`alter: true`)
- ✅ لا يحذف البيانات الموجودة (`force: false`)
- ✅ يعرض الجداول المتزامنة

### 2. استخدام الموديلات في الكود

```javascript
import { Account, JournalEntry, JournalPosting, Expense, Invoice } from './models/index.js';

// إنشاء حساب جديد
const account = await Account.create({
  account_code: '1111',
  name: 'الصندوق',
  type: 'asset',
  nature: 'debit'
});

// إنشاء قيد محاسبي
const entry = await JournalEntry.create({
  description: 'مصروف تجريبي',
  date: new Date(),
  status: 'draft'
});

// إضافة سطور القيد
await JournalPosting.create({
  journal_entry_id: entry.id,
  account_id: account.id,
  debit: 100,
  credit: 0
});

// جلب قيد مع سطوره
const entryWithPostings = await JournalEntry.findByPk(entry.id, {
  include: [{
    model: JournalPosting,
    as: 'postings',
    include: [{
      model: Account,
      as: 'account'
    }]
  }]
});

// جلب مصروف مع قيده
const expense = await Expense.findByPk(1, {
  include: [{
    model: JournalEntry,
    as: 'journalEntry'
  }]
});
```

---

## 📋 العلاقات المحددة

### JournalEntry ↔ JournalPosting
- `JournalEntry.hasMany(JournalPosting)` - قيد واحد له عدة سطور
- `JournalPosting.belongsTo(JournalEntry)` - كل سطر ينتمي لقيد واحد

### JournalPosting ↔ Account
- `JournalPosting.belongsTo(Account)` - كل سطر ينتمي لحساب

### Expense ↔ JournalEntry
- `Expense.belongsTo(JournalEntry)` - مصروف واحد يمكن ربطه بقيد واحد
- `onDelete: 'SET NULL'` - عند حذف القيد، `journal_entry_id` يصبح NULL

### Invoice ↔ JournalEntry
- `Invoice.belongsTo(JournalEntry)` - فاتورة واحدة يمكن ربطها بقيد واحد
- `onDelete: 'SET NULL'` - عند حذف القيد، `journal_entry_id` يصبح NULL

### Account (Self-referential)
- `Account.hasMany(Account, { foreignKey: 'parent_id' })` - حساب له حسابات فرعية
- `Account.belongsTo(Account, { foreignKey: 'parent_id' })` - حساب ينتمي لحساب أب

---

## 🔍 ملاحظات مهمة

### 1. ES Modules
جميع الملفات تستخدم ES modules (`import/export`) لأن المشروع يستخدم `"type": "module"` في `package.json`.

### 2. journal_postings vs journal_lines
المشروع يستخدم `journal_postings` وليس `journal_lines`، لذلك الموديل اسمه `JournalPosting`.

### 3. Timestamps
جميع الموديلات تستخدم `timestamps: false` لأن الجداول الموجودة تتعامل مع `created_at` و `updated_at` يدوياً.

### 4. underscored: true
جميع الموديلات تستخدم `underscored: true` لأن الجداول تستخدم snake_case.

### 5. alter: true
عند المزامنة، استخدم `alter: true` لإضافة الأعمدة المفقودة دون حذف البيانات.

---

## 🧪 اختبار الموديلات

```javascript
import { Account, JournalEntry, JournalPosting, Expense } from './models/index.js';
import sequelize from './db-sequelize.js';

async function test() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected');

    // اختبار جلب حسابات
    const accounts = await Account.findAll({ limit: 5 });
    console.log('Accounts:', accounts.length);

    // اختبار جلب قيود
    const entries = await JournalEntry.findAll({
      include: [{
        model: JournalPosting,
        as: 'postings'
      }],
      limit: 5
    });
    console.log('Journal Entries:', entries.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

test();
```

---

## 📚 المزيد من الأمثلة

### البحث عن مصروفات مع قيودها

```javascript
const expenses = await Expense.findAll({
  where: { status: 'posted' },
  include: [{
    model: JournalEntry,
    as: 'journalEntry',
    include: [{
      model: JournalPosting,
      as: 'postings',
      include: [{
        model: Account,
        as: 'account'
      }]
    }]
  }]
});
```

### إنشاء قيد محاسبي كامل

```javascript
const entry = await JournalEntry.create({
  description: 'مصروف #123',
  date: new Date(),
  status: 'posted',
  reference_type: 'expense',
  reference_id: 123
});

// مدين: مصروف
await JournalPosting.create({
  journal_entry_id: entry.id,
  account_id: expenseAccountId,
  debit: 100,
  credit: 0
});

// دائن: صندوق
await JournalPosting.create({
  journal_entry_id: entry.id,
  account_id: cashAccountId,
  debit: 0,
  credit: 100
});

// ربط المصروف بالقيد
await Expense.update(
  { journal_entry_id: entry.id },
  { where: { id: 123 } }
);
```

---

## ✅ الخطوات التالية

1. ✅ تم تثبيت Sequelize
2. ✅ تم إنشاء الموديلات
3. ✅ تم إنشاء سكريبت المزامنة
4. ⏳ تشغيل `sync-sequelize.js` لمزامنة الجداول
5. ⏳ استخدام الموديلات في `server.js` (اختياري)

---

**تاريخ الإنشاء:** 2025-01-XX  
**الحالة:** ✅ جاهز للاستخدام
