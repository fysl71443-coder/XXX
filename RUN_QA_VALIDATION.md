# تشغيل سكريبت التحقق التلقائي (QA Validation)

## على Render (مستحسن)

### الطريقة 1: عبر SSH Shell

1. افتح Render Dashboard
2. اذهب إلى Service الخاص بك
3. اضغط على "Shell" أو "SSH"
4. نفذ الأوامر التالية:

```bash
cd backend/scripts
node qa-validation.js
```

### الطريقة 2: عبر Render Console

1. افتح Render Dashboard
2. اذهب إلى Service الخاص بك
3. اضغط على "Console"
4. نفذ:

```bash
cd backend/scripts && node qa-validation.js
```

## محلياً (إذا كانت قاعدة البيانات متصلة)

### Windows PowerShell:

```powershell
cd backend\scripts
$env:DATABASE_URL="your_database_url_here"
$env:DB_SSL="true"
node qa-validation.js
```

### Linux/Mac:

```bash
cd backend/scripts
export DATABASE_URL="your_database_url_here"
export DB_SSL="true"
node qa-validation.js
```

## النتائج المتوقعة

### ✅ نجاح:
```
✅ نجح: 8 فحص
  ✓ جميع القيود متوازنة
  ✓ لا توجد قيود بدون مصدر
  ✓ لا توجد قيود مكررة
  ✓ تم التحقق من X حساب
  ✓ الميزانية العمومية متوازنة
  ✓ وجد X مسودة مبيعات
  ✓ جميع المصروفات المنشورة مرتبطة بقيود
  ✓ جميع الفواتير المنشورة مرتبطة بقيود

✅ النظام جاهز للإنتاج!
```

### ❌ فشل:
```
❌ فشل: X فحص
  ✗ وجد X قيد غير متوازن
  ✗ وجد X قيد بدون مصدر
  ...

⚠️ النظام يحتاج إصلاحات قبل الإنتاج!
```
