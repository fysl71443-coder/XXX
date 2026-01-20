# إصلاح مشكلة المصروفات: الترحيل التلقائي وحذف المصروفات

## المشكلة 1: رسالة فشل مع إنشاء المصروف كمسودة

### السبب
- Frontend يتوقع ترحيل تلقائي عند إنشاء مصروف
- Backend كان يتطلب `auto_post = true` أو `status = 'posted'` للترحيل التلقائي
- Frontend لا يرسل أي من هذين، لذلك يتم إنشاء المصروف كـ `draft` ولا يتم ترحيله
- Frontend يتحقق من `status === 'posted'` ويعرض رسالة فشل

### الحل
```javascript
// جعل auto_post = true افتراضياً
const autoPost = b.auto_post !== false; // Default to true unless explicitly set to false
const status = autoPost ? 'posted' : (b.status || 'draft');
```

## المشكلة 2: حذف المصروفات لا يعمل

### السبب
- لا يوجد endpoint DELETE للمصروفات
- Frontend يستدعي `apiExpenses.remove(id)` لكن Backend لا يرد

### الحل
تم إضافة endpoint DELETE:
```javascript
app.delete("/expenses/:id", authenticateToken, authorize("expenses","delete"), ...)
app.delete("/api/expenses/:id", authenticateToken, authorize("expenses","delete"), ...)
```

الـ endpoint يحذف:
- المصروف (expense)
- القيد المحاسبي (journal_entry) إذا كان المصروف منشور
- قيود القيد (journal_postings) المرتبطة

## المشكلة 3: معالجة الأخطاء في الترحيل التلقائي

### السبب
- إذا فشل الترحيل، كان يتم إنشاء المصروف كـ draft بدون إرجاع خطأ
- Frontend يتوقع حذف المصروف إذا فشل الترحيل

### الحل
```javascript
catch (journalError) {
  // إذا فشل الترحيل، حذف المصروف وإرجاع خطأ
  await client.query('ROLLBACK');
  await pool.query('DELETE FROM expenses WHERE id = $1', [expense.id]);
  return res.status(500).json({ 
    error: "post_failed", 
    details: journalError?.message || "Failed to create journal entry"
  });
}
```

## التغييرات المطبقة

### 1. الترحيل التلقائي افتراضي
- `auto_post = true` افتراضياً عند إنشاء مصروف جديد
- يمكن تعطيله بـ `auto_post = false`

### 2. معالجة الأخطاء
- إذا فشل الترحيل، يتم حذف المصروف تلقائياً
- يتم إرجاع خطأ واضح للـ Frontend

### 3. إضافة DELETE endpoint
- حذف المصروفات (draft و posted)
- حذف القيود المحاسبية المرتبطة

### 4. تحسين Logging
- تسجيل تفاصيل الترحيل التلقائي
- تسجيل تفاصيل الحذف

## التحقق من الإصلاح

### بعد Deploy على Render:

1. **اختبار إنشاء مصروف:**
   - أنشئ مصروف جديد
   - يجب أن يتم ترحيله تلقائياً
   - يجب أن تظهر رسالة نجاح

2. **اختبار حذف مصروف:**
   - احذف مصروف (draft)
   - احذف مصروف (posted)
   - يجب أن يتم الحذف بنجاح

3. **التحقق من Logs:**
   - ابحث عن: `[EXPENSES] Auto-posted expense X`
   - ابحث عن: `[EXPENSES] Deleted expense X`

## Commit
- Commit: `898834a0`
- Message: "Fix expenses: Enable auto-post by default, delete expense if posting fails, add DELETE endpoint"
