# تنفيذ API Contract - خطة العمل

## ✅ ما تم إنجازه

### 1. إنشاء API Contract
- ✅ ملف `backend/API_CONTRACT.md` - يحدد جميع الـ endpoints والـ responses
- ✅ ملف `backend/frontend/src/services/api/contract.js` - Contract للـ Frontend

### 2. إضافة API Validator Middleware
- ✅ Middleware يسجل جميع استدعاءات API
- ✅ يحذر من الـ endpoints غير المعرفة
- ✅ يساعد في اكتشاف API Contract Drift

### 3. إصلاح Frontend API Calls
- ✅ إصلاح `businessDaySales` لاستخدام `/api/reports/business-day-sales`
- ✅ إضافة validation للـ required parameters

---

## 🔄 ما يجب إنجازه

### المرحلة 1: إصلاح جميع Backend Endpoints
- [ ] التأكد من أن جميع الـ endpoints تطابق العقد المحدد
- [ ] إصلاح أي endpoints لا تطابق العقد
- [ ] إضافة validation للـ parameters

### المرحلة 2: إصلاح جميع Frontend API Calls
- [ ] تحديث جميع استدعاءات API لاستخدام العقد
- [ ] إضافة validation قبل كل استدعاء
- [ ] إزالة أي استدعاءات غير معرّفة في العقد

### المرحلة 3: Testing & Validation
- [ ] اختبار جميع الـ endpoints
- [ ] التأكد من أن جميع الـ responses تطابق العقد
- [ ] إصلاح أي مشاكل مكتشفة

---

## 📋 قائمة الـ Endpoints المطلوبة

### Reports
- [x] `/api/reports/business-day-sales`
- [x] `/api/reports/trial-balance`
- [x] `/api/reports/sales-by-branch`
- [x] `/api/reports/expenses-by-branch`
- [x] `/api/reports/sales-vs-expenses`

### Accounts
- [x] `/api/accounts`
- [x] `/api/accounts/:id`

### Journal
- [x] `/api/journal`
- [x] `/api/journal/:id`

---

## 🎯 النتيجة المتوقعة

بعد إكمال التنفيذ:
- ✅ لا توجد استدعاءات API غير معرّفة
- ✅ جميع الـ endpoints موثقة في العقد
- ✅ أي خطأ يظهر فوراً وبوضوح
- ✅ النظام قابل للتوسع والصيانة

---

**تاريخ البدء:** 2026-01-19  
**الحالة:** قيد التنفيذ
