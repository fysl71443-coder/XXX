# ملخص الإصلاحات

## 1. إصلاح خطأ SQL في `trial-balance/drilldown`
- **المشكلة:** استخدام `je.related_type` بدلاً من `je.reference_type`
- **الحل:** تم تغيير `je.related_type` إلى `je.reference_type` في السطور 7770 و 8021
- **الملاحظة:** تم الاحتفاظ بـ `related_type` في response للتوافق مع frontend

## 2. إصلاح خطأ SQL في `business-day-sales`
- **المشكلة:** استخدام `je.related_type` بدلاً من `je.reference_type`
- **الحل:** تم تغيير `je.related_type` إلى `je.reference_type` في السطور 8021-8022 و 8028
- **الملاحظة:** تم الاحتفاظ بـ `related_type` في response للتوافق مع frontend

## 3. إصلاح التوجيه عند 401
- **المشكلة:** عند 401، لا يتم توجيه المستخدم لصفحة تسجيل الدخول
- **الحل:** تم تحديث response interceptor في `client.js` لـ:
  - مسح جميع عناصر localStorage المتعلقة بالتوكن
  - توجيه المستخدم مباشرة لصفحة تسجيل الدخول
  - الحفاظ على المسار المطلوب في `next` parameter

## 4. التحقق من التقارير
- ✅ `trial-balance`: يستخدم `je.status = 'posted'`
- ✅ `trial-balance/drilldown`: تم إصلاحه
- ✅ `income-statement`: يستخدم `je.status = 'posted'`
- ✅ `business-day-sales`: تم إصلاحه
- ✅ `salesVsExpenses`: يستخدم `je.status = 'posted'`
- ✅ `salesByBranch`: يستخدم `je.status = 'posted'`
- ✅ `expensesByBranch`: يستخدم `je.status = 'posted'`

**ملاحظة:** إذا كان الخطأ لا يزال يحدث، يجب إعادة تشغيل السيرفر لتحميل الكود المحدث.
