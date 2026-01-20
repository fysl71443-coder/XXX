# إصلاح مشكلة عدم ظهور المسودات المحفوظة

## المشكلة
بعد حفظ المسودة (POST /api/pos/save-draft) بنجاح، عند البحث عن الطلبات (GET /api/orders) لا تظهر أي مسودات.

## السبب الجذري

### 1. عدم تطابق حالة الأحرف في status
- **الحفظ**: `status = 'DRAFT'` (بأحرف كبيرة)
- **البحث**: كان يبحث عن `status IN ('DRAFT', 'OPEN')` لكن بدون normalize

### 2. عدم تطابق branch
- **الحفظ**: يتم normalize للـ branch (مثل 'palace_india' → 'place_india')
- **البحث**: لم يكن يتم normalize للـ branch، مما يؤدي إلى عدم التطابق

### 3. عدم تطابق table_code
- **الحفظ**: `table_code` قد يكون string أو number
- **البحث**: كان يبحث بدون normalize

## الحل المطبق

### 1. إصلاح handleGetOrders
```javascript
// Normalize branch - same logic as handleSaveDraft
let branch = req.query?.branch || null;
if (branch) {
  const branchLower = String(branch).toLowerCase().replace(/\s+/g, '_');
  if (branchLower === 'palace_india' || branchLower === 'palce_india') {
    branch = 'place_india';
  } else {
    branch = branchLower;
  }
}

// Use LOWER() for case-insensitive comparison
if (branch) {
  query += ` AND LOWER(branch) = LOWER($${paramIndex})`;
  params.push(branch);
  paramIndex++;
}

// Normalize table_code
if (table) {
  const tableValue = String(table).trim();
  query += ` AND table_code = $${paramIndex}`;
  params.push(tableValue);
  paramIndex++;
}

// Normalize status - convert to uppercase
if (status) {
  const statuses = status.split(',').map(s => s.trim().toUpperCase());
  query += ` AND UPPER(status) = ANY($${paramIndex})`;
  params.push(statuses.map(s => s.toUpperCase()));
  paramIndex++;
}
```

### 2. إصلاح handleSaveDraft
```javascript
// Normalize table_code
const table_code = b.table || b.table_code || b.tableId || null;
const table_code_normalized = table_code ? String(table_code).trim() : null;

// Validate table_code
if (!table_code_normalized || table_code_normalized === '') {
  return res.status(400).json({ error: "invalid_table", details: "Table is required" });
}

// Use normalized table_code in INSERT
[branch, table_code_normalized, linesJson, 'DRAFT', ...]
```

### 3. إضافة Logging
تم إضافة logging مفصل لتسهيل التشخيص:
- Logging عند INSERT: `branch`, `table_code`, `status`
- Logging عند SELECT: Query و Params
- Logging للنتائج: Sample order details

## التحقق من الإصلاح

### 1. بعد Deploy على Render
1. اذهب إلى Render Dashboard > Service > Logs
2. ابحث عن:
   - `[POS] saveDraft - INSERT VALUES: branch='...', table_code='...', status='DRAFT'`
   - `[ORDERS] GET /api/orders - Query: ...`
   - `[ORDERS] GET /api/orders - Found X orders`

### 2. اختبار SQL مباشرة
```sql
-- التحقق من الطلبات المحفوظة
SELECT id, branch, table_code, status, created_at 
FROM orders 
ORDER BY id DESC 
LIMIT 5;

-- البحث عن مسودة محددة
SELECT id, branch, table_code, status 
FROM orders 
WHERE LOWER(branch) = LOWER('china_town') 
  AND table_code = '1' 
  AND UPPER(status) = 'DRAFT';
```

### 3. اختبار في البرنامج
1. افتح POS Invoice
2. أضف منتجات
3. احفظ المسودة
4. اذهب إلى Tables
5. يجب أن تظهر المسودة في الجدول

## ملاحظات مهمة

1. **Status**: يجب أن يكون دائماً `'DRAFT'` (بأحرف كبيرة) عند الحفظ
2. **Branch**: يتم normalize تلقائياً في كلا الاتجاهين (save و get)
3. **Table Code**: يتم تحويله إلى string دائماً لضمان التطابق
4. **Logging**: تم إضافة logging مفصل لتسهيل التشخيص في المستقبل

## Commit
- Commit: `38401606`
- Message: "Fix draft orders not appearing: Normalize branch and table_code in GET /api/orders, ensure consistent status='DRAFT'"
