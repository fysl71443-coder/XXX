# 📋 خطة اختبارات شاملة للنظام (End-to-End QA)

## نظرة عامة
هذه الوثيقة تمثل اختبارات End-to-End كاملة تغطي كل شاشة وكل عملية محاسبية وتشغيلية، مع التركيز على سلامة البيانات، القيود المحاسبية، الأرقام، والتقارير.

---

## 1️⃣ شاشة المبيعات / نقطة البيع (POS)

### 1.1 إنشاء مسودة مبيعات (Draft Order)

**الخطوات:**
1. اختيار الفرع
2. اختيار الطاولة
3. إضافة أصناف متعددة (بأسعار وضريبة مختلفة)
4. حفظ كمسودة

**التحقق:**
- ✅ يتم إنشاء Order بحالة `DRAFT`
- ✅ ربط الطلب بالفرع والطاولة
- ✅ مجموع الأصناف = مجموع تفاصيل السطور
- ✅ الضريبة محسوبة بدقة
- ✅ لا يتم إنشاء أي قيد محاسبي بعد

**SQL للتحقق:**
```sql
SELECT id, branch, table_code, status, subtotal, tax_amount, total_amount 
FROM orders 
WHERE status = 'DRAFT' 
ORDER BY id DESC LIMIT 1;

-- التحقق من عدم وجود قيد محاسبي
SELECT je.id FROM journal_entries je
JOIN orders o ON je.reference_id = o.id AND je.reference_type = 'order'
WHERE o.status = 'DRAFT';
```

### 1.2 تعديل المسودة

**الخطوات:**
1. فتح المسودة
2. تعديل الكمية
3. حذف صنف
4. إضافة صنف جديد

**التحقق:**
- ✅ تحديث الإجمالي بشكل فوري
- ✅ عدم إنشاء قيود إضافية
- ✅ حفظ التعديلات بشكل صحيح

**SQL للتحقق:**
```sql
-- التحقق من تحديث الإجمالي
SELECT id, subtotal, tax_amount, total_amount, updated_at
FROM orders 
WHERE id = <order_id>;

-- التحقق من عدم وجود قيود إضافية
SELECT COUNT(*) FROM journal_entries 
WHERE reference_type = 'order' AND reference_id = <order_id>;
-- يجب أن يكون 0
```

### 1.3 إصدار الفاتورة (Finalize Invoice)

**الخطوات:**
1. تحويل المسودة إلى فاتورة
2. اختيار طريقة الدفع (نقدي / آجل / جزئي)

**التحقق المحاسبي:**
- ✅ إنشاء قيد يومية تلقائي
- ✅ حساب الصندوق / البنك (مدين)
- ✅ حساب الإيرادات (دائن)
- ✅ حساب الضريبة (إن وجد)
- ✅ مجموع المدين = مجموع الدائن

**التحقق من الوصف:**
- ✅ وصف القيد يحتوي:
  - رقم الفاتورة
  - اسم العميل / الطاولة
  - الفرع

**SQL للتحقق:**
```sql
-- التحقق من القيد المحاسبي
SELECT je.id, je.entry_number, je.description, je.status, je.date
FROM journal_entries je
JOIN invoices i ON je.reference_id = i.id AND je.reference_type = 'invoice'
WHERE i.id = <invoice_id>;

-- التحقق من توازن القيد
SELECT 
  SUM(jp.debit) as total_debit,
  SUM(jp.credit) as total_credit,
  SUM(jp.debit) - SUM(jp.credit) as difference
FROM journal_postings jp
JOIN journal_entries je ON je.id = jp.journal_entry_id
WHERE je.id = <journal_entry_id>;
-- difference يجب أن يكون 0.00

-- التحقق من الحسابات المستخدمة
SELECT 
  a.account_code,
  a.name,
  jp.debit,
  jp.credit
FROM journal_postings jp
JOIN accounts a ON a.id = jp.account_id
WHERE jp.journal_entry_id = <journal_entry_id>
ORDER BY jp.debit DESC, jp.credit DESC;
```

---

## 2️⃣ شاشة المصروفات

### 2.1 تسجيل مصروف

**الخطوات:**
1. اختيار نوع المصروف
2. تحديد الحساب
3. إدخال المبلغ والوصف

**التحقق:**
- ✅ إنشاء قيد:
  - مصروف (مدين)
  - صندوق / بنك (دائن)
- ✅ الوصف يظهر كامل في القيد

**SQL للتحقق:**
```sql
-- التحقق من المصروف
SELECT id, account_code, amount, total, status, journal_entry_id
FROM expenses
WHERE id = <expense_id>;

-- التحقق من القيد
SELECT je.id, je.description, je.status
FROM journal_entries je
WHERE je.reference_type = 'expense' AND je.reference_id = <expense_id>;

-- التحقق من الحسابات
SELECT 
  a.account_code,
  a.name,
  jp.debit,
  jp.credit
FROM journal_postings jp
JOIN accounts a ON a.id = jp.account_id
JOIN journal_entries je ON je.id = jp.journal_entry_id
WHERE je.reference_type = 'expense' AND je.reference_id = <expense_id>;
```

### 2.2 سحب نقدي

**التحقق:**
- ✅ حساب السحب (مدين)
- ✅ الصندوق (دائن)
- ✅ لا يؤثر على الأرباح

### 2.3 إيداع نقدي

**التحقق:**
- ✅ الصندوق (مدين)
- ✅ حساب الإيداع (دائن)

### 2.4 سداد / تسوية

**التحقق:**
- ✅ إغلاق الرصيد المفتوح
- ✅ تحديث حالة المستند إلى `SETTLED`
- ✅ عدم السماح بالتعديل بعد التسوية

### 2.5 تسوية الذمم المدينة

**التحقق:**
- ✅ تخفيض رصيد العميل
- ✅ إنشاء قيد تسوية صحيح

---

## 3️⃣ شاشة العملاء

### الاختبارات:
1. إضافة عميل
2. تعديل بياناته
3. ربطه بفواتير مبيعات
4. مراجعة كشف حساب العميل

**التحقق:**
- ✅ الرصيد الافتتاحي صحيح
- ✅ الحركات تظهر مرتبة زمنيًا
- ✅ الرصيد النهائي مطابق للقيود

**SQL للتحقق:**
```sql
-- كشف حساب العميل
SELECT 
  je.date,
  je.entry_number,
  je.description,
  jp.debit,
  jp.credit,
  SUM(jp.debit - jp.credit) OVER (ORDER BY je.date, je.entry_number) as running_balance
FROM journal_postings jp
JOIN journal_entries je ON je.id = jp.journal_entry_id
JOIN accounts a ON a.id = jp.account_id
WHERE a.account_code = '1201' -- حساب العملاء
ORDER BY je.date, je.entry_number;
```

---

## 4️⃣ شاشة الموردين

### الاختبارات:
1. إضافة مورد
2. تسجيل مشتريات آجلة
3. سداد جزئي وكامل

**التحقق:**
- ✅ حساب المورد (دائن)
- ✅ تحديث الرصيد بعد كل عملية

---

## 5️⃣ شاشة المشتريات

### الاختبارات:
1. إنشاء فاتورة شراء
2. إضافة ضريبة
3. ربطها بالمخزون

**التحقق:**
- ✅ زيادة المخزون
- ✅ إنشاء قيد:
  - مخزون (مدين)
  - مورد / صندوق (دائن)

---

## 6️⃣ شاشة الموظفين

### الاختبارات:
1. إضافة موظف
2. تسجيل راتب
3. خصومات / مكافآت

**التحقق:**
- ✅ قيد الرواتب صحيح
- ✅ تحديث الالتزامات

---

## 7️⃣ شاشة القيود اليومية

### الاختبارات:
1. عرض جميع القيود
2. البحث برقم مستند
3. مراجعة الوصف والتفاصيل

**التحقق:**
- ✅ كل قيد متوازن
- ✅ لا يوجد قيد بدون مصدر

**SQL للتحقق:**
```sql
-- التحقق من توازن جميع القيود
SELECT 
  je.id,
  je.entry_number,
  je.description,
  SUM(jp.debit) as total_debit,
  SUM(jp.credit) as total_credit,
  SUM(jp.debit) - SUM(jp.credit) as difference
FROM journal_entries je
JOIN journal_postings jp ON jp.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY je.id, je.entry_number, je.description
HAVING ABS(SUM(jp.debit) - SUM(jp.credit)) > 0.01;
-- يجب أن يكون النتيجة فارغة

-- التحقق من القيود بدون مصدر
SELECT je.id, je.entry_number, je.description, je.reference_type, je.reference_id
FROM journal_entries je
WHERE je.reference_type IS NOT NULL 
  AND je.reference_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = je.reference_id AND je.reference_type = 'expense'
    UNION
    SELECT 1 FROM invoices i WHERE i.id = je.reference_id AND je.reference_type = 'invoice'
  );
-- يجب أن يكون النتيجة فارغة
```

---

## 8️⃣ شاشة التقارير

### 8.1 تقرير اليومية

**التحقق:**
- ✅ تطابقه مع جدول القيود

### 8.2 تقرير الأستاذ العام

**التحقق:**
- ✅ الأرصدة صحيحة

**SQL للتحقق:**
```sql
-- حساب رصيد حساب معين
SELECT 
  a.account_code,
  a.name,
  a.opening_balance,
  COALESCE(SUM(jp.debit), 0) as total_debit,
  COALESCE(SUM(jp.credit), 0) as total_credit,
  a.opening_balance + COALESCE(SUM(jp.debit), 0) - COALESCE(SUM(jp.credit), 0) as current_balance
FROM accounts a
LEFT JOIN journal_postings jp ON jp.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
WHERE a.account_code = '<account_code>'
GROUP BY a.id, a.account_code, a.name, a.opening_balance;
```

### 8.3 تقرير الأرباح والخسائر

**التحقق:**
- ✅ الإيرادات – المصروفات = صافي الربح

**SQL للتحقق:**
```sql
-- حساب الأرباح والخسائر
SELECT 
  'Revenue' as type,
  SUM(jp.credit - jp.debit) as amount
FROM journal_postings jp
JOIN accounts a ON a.id = jp.account_id
JOIN journal_entries je ON je.id = jp.journal_entry_id
WHERE a.type = 'income' AND je.status = 'posted'
UNION ALL
SELECT 
  'Expenses' as type,
  SUM(jp.debit - jp.credit) as amount
FROM journal_postings jp
JOIN accounts a ON a.id = jp.account_id
JOIN journal_entries je ON je.id = jp.journal_entry_id
WHERE a.type = 'expense' AND je.status = 'posted';
```

### 8.4 الميزانية العمومية

**التحقق:**
- ✅ الأصول = الخصوم + حقوق الملكية

**SQL للتحقق:**
```sql
-- حساب الميزانية العمومية
SELECT 
  'Assets' as type,
  SUM(a.opening_balance + COALESCE(SUM(jp.debit - jp.credit), 0)) as total
FROM accounts a
LEFT JOIN journal_postings jp ON jp.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
WHERE a.type = 'asset'
GROUP BY a.type
UNION ALL
SELECT 
  'Liabilities' as type,
  SUM(a.opening_balance + COALESCE(SUM(jp.credit - jp.debit), 0)) as total
FROM accounts a
LEFT JOIN journal_postings jp ON jp.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
WHERE a.type = 'liability'
GROUP BY a.type
UNION ALL
SELECT 
  'Equity' as type,
  SUM(a.opening_balance + COALESCE(SUM(jp.credit - jp.debit), 0)) as total
FROM accounts a
LEFT JOIN journal_postings jp ON jp.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jp.journal_entry_id AND je.status = 'posted'
WHERE a.type = 'equity'
GROUP BY a.type;
```

### 8.5 الطباعة

**التحقق:**
- ✅ لا يوجد قص بالنص
- ✅ الأرقام كاملة
- ✅ العناوين واضحة

---

## 9️⃣ اختبارات عامة (Global)

### 9.1 الصلاحيات (Admin / User)

**التحقق:**
- ✅ Admin لديه جميع الصلاحيات
- ✅ User لديه صلاحيات محدودة فقط

### 9.2 حذف مستند مرتبط

**التحقق:**
- ✅ حذف مستند مرتبط بقيد → مرفوض
- ✅ يجب إرجاع القيد لمسودة أولاً

### 9.3 الأداء (زمن الاستجابة)

**التحقق:**
- ✅ زمن الاستجابة < 2 ثانية للعمليات العادية
- ✅ زمن الاستجابة < 5 ثواني للتقارير

### 9.4 عدم تكرار القيود

**التحقق:**
- ✅ لا يوجد قيد مكرر
- ✅ كل مستند مرتبط بقيد واحد فقط

**SQL للتحقق:**
```sql
-- التحقق من القيود المكررة
SELECT reference_type, reference_id, COUNT(*) as count
FROM journal_entries
WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
GROUP BY reference_type, reference_id
HAVING COUNT(*) > 1;
-- يجب أن يكون النتيجة فارغة
```

---

## ✅ معايير النجاح

يُعتبر النظام جاهزًا للإنتاج فقط عند:

1. ✅ نجاح جميع السيناريوهات المذكورة أعلاه
2. ✅ عدم وجود فروقات محاسبية (جميع القيود متوازنة)
3. ✅ تطابق التقارير مع القيود 100%
4. ✅ عدم وجود قيود بدون مصدر
5. ✅ عدم وجود قيود مكررة
6. ✅ جميع الأرصدة صحيحة
7. ✅ الميزانية العمومية متوازنة

---

## 📝 سجلات الاختبار

### تاريخ الاختبار: ___________
### المختبر: ___________
### البيئة: Production / Staging / Development

| رقم | السيناريو | النتيجة | الملاحظات |
|-----|-----------|---------|-----------|
| 1.1 | إنشاء مسودة مبيعات | ✅ / ❌ | |
| 1.2 | تعديل المسودة | ✅ / ❌ | |
| 1.3 | إصدار الفاتورة | ✅ / ❌ | |
| 2.1 | تسجيل مصروف | ✅ / ❌ | |
| 2.2 | سحب نقدي | ✅ / ❌ | |
| 2.3 | إيداع نقدي | ✅ / ❌ | |
| 2.4 | سداد / تسوية | ✅ / ❌ | |
| 2.5 | تسوية الذمم | ✅ / ❌ | |
| 3 | شاشة العملاء | ✅ / ❌ | |
| 4 | شاشة الموردين | ✅ / ❌ | |
| 5 | شاشة المشتريات | ✅ / ❌ | |
| 6 | شاشة الموظفين | ✅ / ❌ | |
| 7 | شاشة القيود | ✅ / ❌ | |
| 8.1 | تقرير اليومية | ✅ / ❌ | |
| 8.2 | تقرير الأستاذ | ✅ / ❌ | |
| 8.3 | الأرباح والخسائر | ✅ / ❌ | |
| 8.4 | الميزانية | ✅ / ❌ | |
| 8.5 | الطباعة | ✅ / ❌ | |
| 9.1 | الصلاحيات | ✅ / ❌ | |
| 9.2 | حذف مستند | ✅ / ❌ | |
| 9.3 | الأداء | ✅ / ❌ | |
| 9.4 | عدم التكرار | ✅ / ❌ | |

### النتيجة النهائية: ✅ جاهز للإنتاج / ❌ يحتاج إصلاحات

---

## 🔧 سكريبتات التحقق التلقائية

راجع ملف `scripts/qa-validation.js` لسكريبتات التحقق التلقائية.
