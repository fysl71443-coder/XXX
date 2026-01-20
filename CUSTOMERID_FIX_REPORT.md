# تقرير إصلاح customerId Column Alignment

## المشكلة
العمود في قاعدة البيانات هو `"customerId"` (CamelCase مع quotes)، لكن الكود يستخدم `customerid` (lowercase بدون quotes) في بعض الأماكن في SQL queries.

## المراجع التي تم إصلاحها

### backend/server.js

#### 1. Function: calculateOrderTotals (Line 5942)
**قبل:**
```javascript
const customerid = meta ? (meta.customerId || meta.customer_id || null) : (lines[0]?.customerId || null);
return { ..., customerid };
```

**بعد:**
```javascript
const customerId = meta ? (meta.customerId || meta.customer_id || null) : (lines[0]?.customerId || null);
return { ..., customerId };
```

#### 2. Function: handleCreateOrder (Lines 5967-5970)
**قبل:**
```sql
INSERT INTO orders(..., customerid) 
VALUES (..., $11) 
RETURNING ..., customerid
```
```javascript
totals.customerid
```

**بعد:**
```sql
INSERT INTO orders(..., "customerId") 
VALUES (..., $11) 
RETURNING ..., "customerId"
```
```javascript
totals.customerId
```

#### 3. Function: handleUpdateOrder (Lines 6038, 6041, 6044)
**قبل:**
```sql
customerid=COALESCE($11,customerid),
RETURNING ..., customerid
```
```javascript
totals.customerid
```

**بعد:**
```sql
"customerId"=COALESCE($11,"customerId"),
RETURNING ..., "customerId"
```
```javascript
totals.customerId
```

#### 4. Function: handleUpdateOrder - Simple Update (Line 6053)
**قبل:**
```sql
RETURNING ..., customerid
```

**بعد:**
```sql
RETURNING ..., "customerId"
```

#### 5. Function: handleGetOrders (Line 5734)
**قبل:**
```sql
SELECT ..., customerId, ...
```

**بعد:**
```sql
SELECT ..., "customerId", ...
```

#### 6. Function: handleGetOrder (Line 5830)
**قبل:**
```sql
SELECT ..., customerId, ...
```

**بعد:**
```sql
SELECT ..., "customerId", ...
```

#### 7. Function: handleSaveDraft - Update (Lines 7627, 7630)
**قبل:**
```sql
customerid=$8,
RETURNING ..., customerid
```

**بعد:**
```sql
"customerId"=$8,
RETURNING ..., "customerId"
```

#### 8. Function: handleSaveDraft - Insert (Lines 7710, 7712)
**قبل:**
```sql
INSERT INTO orders(..., customerid) 
VALUES (..., $11) 
RETURNING ..., customerid
```

**بعد:**
```sql
INSERT INTO orders(..., "customerId") 
VALUES (..., $11) 
RETURNING ..., "customerId"
```

### backend/scripts/comprehensive_system_test.cjs

#### Line 133
**قبل:**
```sql
SELECT ..., customerId, ...
```

**بعد:**
```sql
SELECT ..., "customerId", ...
```

### backend/scripts/fix_draft_orders.sql

#### Line 43
**قبل:**
```sql
ALTER TABLE orders ADD COLUMN customerId INTEGER;
```

**بعد:**
```sql
ALTER TABLE orders ADD COLUMN "customerId" INTEGER;
```

#### Line 161
**قبل:**
```sql
customerId = COALESCE(...)
```

**بعد:**
```sql
"customerId" = COALESCE(...)
```

## ملخص التغييرات

### SQL Queries:
- ✅ جميع INSERT queries تستخدم `"customerId"` مع quotes
- ✅ جميع UPDATE queries تستخدم `"customerId"` مع quotes
- ✅ جميع SELECT queries تستخدم `"customerId"` مع quotes
- ✅ جميع RETURNING clauses تستخدم `"customerId"` مع quotes

### JavaScript Variables:
- ✅ جميع JavaScript variables تستخدم `customerId` (CamelCase)
- ✅ جميع object properties تستخدم `customerId` (CamelCase)

## الملفات المعدلة

1. `backend/server.js` - 8 مواقع
2. `backend/scripts/comprehensive_system_test.cjs` - 1 موقع
3. `backend/scripts/fix_draft_orders.sql` - 2 مواقع

## التحقق

بعد تطبيق هذه التغييرات:
- ✅ جميع SQL queries تستخدم `"customerId"` مع quotes بشكل متسق
- ✅ جميع JavaScript variables تستخدم `customerId` بشكل متسق
- ✅ لا يوجد استخدام لـ `customerid` (lowercase) في SQL
