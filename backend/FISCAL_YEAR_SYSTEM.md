# نظام إدارة السنوات المالية
# Fiscal Year Management System

**تاريخ الإنشاء:** 2026-01-21

---

## ✅ ملخص النظام

تم إنشاء نظام شامل لإدارة السنوات المالية يتضمن:

| المكون | الوصف | الحالة |
|--------|-------|--------|
| جدول `fiscal_years` | تخزين بيانات السنوات المالية | ✅ |
| جدول `fiscal_year_activities` | سجل الأنشطة | ✅ |
| API Endpoints | 12 endpoint للإدارة | ✅ |
| FiscalYearContext | سياق React للـ Frontend | ✅ |
| FiscalYearBanner | مكون عرض الحالة | ✅ |
| FiscalYearManagement | شاشة الإدارة الكاملة | ✅ |
| DataImport | شاشة استيراد البيانات | ✅ |

---

## 0. الصلاحيات المُضافة

تمت إضافة الشاشات التالية إلى جدول الصلاحيات:

| الشاشة | الكود | الصلاحيات |
|--------|-------|-----------|
| السنوات المالية | `fiscal_years` | view, create, edit, delete |
| استيراد البيانات | `data_import` | view, create, edit, delete |

---

## 1. قاعدة البيانات

### جدول fiscal_years
```sql
CREATE TABLE fiscal_years (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'rollover'
  temporary_open BOOLEAN DEFAULT FALSE,
  temporary_open_by INT,
  temporary_open_at TIMESTAMP,
  temporary_open_reason TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  closed_by INT,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### جدول fiscal_year_activities
```sql
CREATE TABLE fiscal_year_activities (
  id SERIAL PRIMARY KEY,
  fiscal_year_id INT,
  action VARCHAR(50) NOT NULL, -- 'open', 'close', 'temporary_open', etc.
  description TEXT,
  details JSONB,
  user_id INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 2. API Endpoints

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/fiscal-years` | GET | قائمة السنوات المالية |
| `/api/fiscal-years` | POST | إنشاء سنة جديدة |
| `/api/fiscal-years/current` | GET | السنة الحالية |
| `/api/fiscal-years/:id` | GET | سنة محددة |
| `/api/fiscal-years/:id/stats` | GET | إحصائيات السنة |
| `/api/fiscal-years/:id/activities` | GET | سجل الأنشطة |
| `/api/fiscal-years/:id/open` | POST | فتح السنة |
| `/api/fiscal-years/:id/close` | POST | إغلاق السنة |
| `/api/fiscal-years/:id/temporary-open` | POST | فتح مؤقت |
| `/api/fiscal-years/:id/temporary-close` | POST | إغلاق الفتح المؤقت |
| `/api/fiscal-years/for-date` | GET | سنة لتاريخ محدد |
| `/api/fiscal-years/can-create` | GET | التحقق من إمكانية الإنشاء |

---

## 3. حالات السنة المالية

| الحالة | الأيقونة | اللون | الوصف |
|--------|----------|-------|-------|
| `open` | ✅ | أخضر | مفتوحة - يمكن إنشاء القيود |
| `closed` | 🔒 | أحمر | مغلقة - لا يمكن الإنشاء |
| `closed + temporary_open` | 🔓 | أصفر | مفتوحة مؤقتاً |
| `rollover` | 🔄 | أزرق | قيد الترحيل |

---

## 4. استخدام Frontend

### FiscalYearContext

```jsx
import { useFiscalYear } from './context/FiscalYearContext';

function MyComponent() {
  const {
    currentYear,          // السنة الحالية
    allYears,            // جميع السنوات
    canCreateEntries,    // هل يمكن إنشاء قيود؟
    isClosed,            // هل السنة مغلقة؟
    isTemporaryOpen,     // هل مفتوحة مؤقتاً؟
    openYear,            // فتح السنة
    closeYear,           // إغلاق السنة
    temporaryOpen,       // فتح مؤقت
    temporaryClose,      // إغلاق الفتح المؤقت
    canCreateForDate,    // التحقق لتاريخ محدد
  } = useFiscalYear();
  
  // استخدام
  if (!canCreateEntries) {
    return <div>السنة المالية مغلقة</div>;
  }
}
```

### FiscalYearBanner

```jsx
import { FiscalYearBanner } from './components/FiscalYearBanner';

// في الشاشات المحاسبية
<FiscalYearBanner className="mb-4" />
```

### FiscalYearProtectedButton

```jsx
import { FiscalYearProtectedButton } from './components/FiscalYearBanner';

// زر يتعطل تلقائياً عند إغلاق السنة
<FiscalYearProtectedButton
  onClick={handleCreate}
  className="bg-green-600 text-white px-4 py-2 rounded"
>
  إنشاء قيد جديد
</FiscalYearProtectedButton>
```

---

## 5. الشاشات الجديدة

### شاشة إدارة السنوات المالية
**المسار:** `/fiscal-years`

الميزات:
- عرض جميع السنوات المالية
- فتح/إغلاق السنة
- الفتح المؤقت مع سبب
- إحصائيات (قيود، فواتير، مصروفات)
- سجل الأنشطة

### شاشة استيراد البيانات
**المسار:** `/data-import`

الميزات:
- استيراد قيود يومية من Excel/CSV
- استيراد فواتير
- استيراد مصروفات
- التحقق من الصحة قبل الاستيراد
- عرض الأخطاء وإمكانية التعديل
- تحميل قوالب Excel

---

## 6. كيفية الاستخدام في الشاشات المحاسبية

### إضافة شريط حالة السنة المالية:

```jsx
import { FiscalYearBanner } from '../components/FiscalYearBanner';

function JournalPage() {
  return (
    <div>
      {/* شريط السنة المالية */}
      <FiscalYearBanner className="mb-4" />
      
      {/* باقي الصفحة */}
      ...
    </div>
  );
}
```

### التحقق قبل إنشاء قيد:

```jsx
import { useFiscalYear } from '../context/FiscalYearContext';

function CreateEntry() {
  const { canCreateEntries, canCreateForDate } = useFiscalYear();
  
  const handleCreate = async () => {
    // التحقق من التاريخ المحدد
    const result = await canCreateForDate(selectedDate);
    
    if (!result.canCreate) {
      alert(result.reason);
      return;
    }
    
    // متابعة الإنشاء
    ...
  };
  
  return (
    <button 
      onClick={handleCreate}
      disabled={!canCreateEntries}
    >
      إنشاء قيد
    </button>
  );
}
```

---

## 7. سير العمل المقترح

### 1. بداية السنة:
- السنة الجديدة تُنشأ تلقائياً بحالة `open`
- يمكن إنشاء القيود والفواتير بحرية

### 2. إغلاق السنة:
1. الانتقال إلى `/fiscal-years`
2. اختيار السنة المراد إغلاقها
3. الضغط على "إغلاق السنة المالية"
4. إدخال ملاحظات الإغلاق (اختياري)

### 3. إدخال بيانات قديمة:
1. الانتقال إلى `/fiscal-years`
2. اختيار السنة المغلقة
3. الضغط على "فتح مؤقت"
4. إدخال سبب الفتح (مطلوب)
5. إنشاء القيود المطلوبة
6. الضغط على "إغلاق الفتح المؤقت"

### 4. استيراد بيانات من نظام قديم:
1. الانتقال إلى `/data-import`
2. اختيار نوع البيانات (قيود/فواتير/مصروفات)
3. اختيار السنة المالية
4. تحميل القالب أو رفع الملف
5. مراجعة التحقق من الصحة
6. إصلاح الأخطاء إن وجدت
7. الضغط على "استيراد البيانات"

---

## 8. الملفات المُنشأة

| الملف | الوصف |
|-------|-------|
| `backend/scripts/setup-fiscal-years.js` | سكربت إنشاء الجداول |
| `backend/controllers/fiscalYearController.js` | وحدة التحكم |
| `backend/routes/fiscalYears.js` | مسارات API |
| `frontend/src/context/FiscalYearContext.js` | سياق React |
| `frontend/src/components/FiscalYearBanner.jsx` | مكونات العرض |
| `frontend/src/pages/FiscalYearManagement.jsx` | شاشة الإدارة |
| `frontend/src/pages/DataImport.jsx` | شاشة الاستيراد |

---

## 9. الأمان

- جميع endpoints تتطلب مصادقة
- عمليات الفتح/الإغلاق تتطلب صلاحية `settings.edit`
- سجل الأنشطة يحفظ من قام بكل عملية ومتى

---

## 10. التحسينات المستقبلية

1. **الترحيل التلقائي:** نقل الأرصدة الافتتاحية تلقائياً
2. **التقارير:** تقارير مقارنة بين السنوات
3. **الإشعارات:** تنبيه عند اقتراب نهاية السنة
4. **التدقيق:** تقرير تدقيق شامل لكل سنة

---

## 11. التحسينات المتقدمة (تم التنفيذ)

### 1. الترحيل التلقائي للأرصدة الافتتاحية

**Endpoint:** `POST /api/fiscal-years/:id/rollover`

```javascript
// Request
{
  "target_year": 2027  // اختياري - افتراضي: السنة الحالية + 1
}

// Response
{
  "success": true,
  "message": "تم ترحيل الأرصدة الافتتاحية إلى السنة 2027",
  "sourceYear": 2026,
  "targetYear": 2027,
  "accountsRolledOver": 45
}
```

**ما يفعله:**
- يحسب أرصدة جميع الحسابات في السنة الحالية
- ينشئ السنة الجديدة إذا لم تكن موجودة
- ينشئ قيد الأرصدة الافتتاحية في السنة الجديدة
- يغلق السنة القديمة تلقائياً

### 2. تقارير مقارنة السنوات

**Endpoint:** `GET /api/fiscal-years/compare?year1=2025&year2=2026`

```javascript
// Response
{
  "year1": { "year": 2025, ... },
  "year2": { "year": 2026, ... },
  "summary": {
    "revenue": { "year1": 500000, "year2": 650000, "change": 150000, "changePercent": 30 },
    "expenses": { "year1": 300000, "year2": 350000, "change": 50000, "changePercent": 16.67 },
    "netIncome": { "year1": 200000, "year2": 300000, "change": 100000, "changePercent": 50 }
  },
  "accountComparison": [
    { "accountNumber": "1111", "name": "الصندوق", "year1Balance": 50000, "year2Balance": 75000, "change": 25000, "changePercent": 50 },
    // ...
  ]
}
```

### 3. إشعارات نهاية السنة

**Endpoint:** `GET /api/fiscal-years/notifications`

```javascript
// Response
{
  "notifications": [
    {
      "id": "year_ending_soon",
      "type": "warning",
      "priority": "high",
      "icon": "⏰",
      "title": "اقتراب نهاية السنة المالية",
      "message": "تبقى 15 يوم على نهاية السنة المالية 2026",
      "action": "review_entries",
      "actionLabel": "مراجعة القيود"
    }
  ],
  "count": 1,
  "hasHighPriority": true
}
```

**أنواع الإشعارات:**
| النوع | الأولوية | الوصف |
|-------|----------|-------|
| `year_ending_soon` | high/medium | اقتراب نهاية السنة (30 يوم) |
| `year_ended_not_closed` | high | السنة انتهت ولم تُقفل |
| `temp_open_too_long` | medium | الفتح المؤقت مستمر > 7 أيام |
| `next_year_not_created` | low | السنة القادمة لم تُنشأ |
| `unbalanced_entries` | high | قيود غير متوازنة |

### 4. قائمة التحقق قبل الإقفال

**Endpoint:** `GET /api/fiscal-years/:id/checklist`

```javascript
// Response
{
  "fiscalYear": { ... },
  "checklist": [
    { "id": "balanced_entries", "title": "جميع القيود متوازنة", "completed": true, "count": 0 },
    { "id": "no_pending_invoices", "title": "لا توجد فواتير معلقة", "completed": false, "count": 5 },
    { "id": "all_entries_approved", "title": "جميع القيود معتمدة", "completed": true, "count": 0 },
    { "id": "backup_created", "title": "تم إنشاء نسخة احتياطية", "completed": false },
    { "id": "reports_reviewed", "title": "تمت مراجعة التقارير المالية", "completed": false }
  ],
  "summary": {
    "total": 5,
    "completed": 2,
    "percentage": 40,
    "canClose": false
  }
}
```

---

## 12. المكونات الجديدة في Frontend

### NotificationBell
جرس الإشعارات في الـ Header

```jsx
import { NotificationBell } from './components/FiscalYearNotifications';

<Header>
  <NotificationBell />
</Header>
```

### NotificationsBanner
شريط الإشعارات العاجلة

```jsx
import { NotificationsBanner } from './components/FiscalYearNotifications';

<NotificationsBanner className="mb-4" />
```

### YearComparisonReport
تقرير مقارنة السنوات

```jsx
import { YearComparisonReport } from './components/FiscalYearComparison';

<YearComparisonReport className="mb-6" />
```

### RolloverModal
نافذة ترحيل السنة المالية

```jsx
import { RolloverModal } from './components/FiscalYearRollover';

<RolloverModal
  fiscalYear={selectedYear}
  onClose={() => setShowModal(false)}
  onSuccess={() => refresh()}
/>
```

---

**✅ النظام جاهز للاستخدام**
