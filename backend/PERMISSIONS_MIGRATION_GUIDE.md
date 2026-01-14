# دليل هجرة نظام الصلاحيات

## نظرة عامة

تم إعادة تصميم نظام الصلاحيات ليكون أكثر مرونة وقابلية للتوسع. النظام الجديد يستخدم:
- **Roles**: الأدوار (admin, manager, employee)
- **Screens**: الشاشات (clients, employees, etc.)
- **Actions**: الإجراءات (view, create, edit, delete)
- **Role Permissions**: صلاحيات الدور
- **User Permissions**: صلاحيات المستخدم (للتجاوز)

## خطوات الهجرة

### 1. تشغيل Migration Script

```bash
# على Render أو محلياً
DATABASE_URL="postgresql://..." node backend/scripts/create_permissions_schema.js
```

هذا سيقوم بـ:
- إنشاء الجداول الجديدة
- إضافة البيانات الافتراضية (roles, screens, actions)
- ربط المستخدمين الحاليين بالأدوار
- منح admin جميع الصلاحيات

### 2. التحقق من الهجرة

```bash
# التحقق من admin user
node backend/scripts/check_admin.js

# فحص شامل
node backend/scripts/verify_database.js
```

### 3. تحديث Backend (اختياري - للاستخدام التدريجي)

يمكنك استخدام النظام الجديد تدريجياً:

#### Option A: استخدام authorize_v2 في routes جديدة
```javascript
import { authorize as authorizeV2 } from './middleware/authorize_v2.js';

app.get('/api/new-endpoint', authenticateToken, authorizeV2('clients', 'view'), handler);
```

#### Option B: استبدال authorize القديم
```javascript
// في server.js
import { authorize } from './middleware/authorize_v2.js'; // بدلاً من authorize.js القديم
```

### 4. تحديث Frontend

Frontend الحالي سيعمل بدون تغييرات لأن:
- Admin bypass يعمل في كلا النظامين
- النظام الجديد متوافق مع القديم

لكن يمكنك تحسين الأداء بتحميل الصلاحيات من النظام الجديد:

```javascript
// في AuthContext.js
const loadPermissions = async (userId, roleId) => {
  // تحميل من النظام الجديد
  const res = await apiUsers.permissions(userId);
  return res.all; // جميع الصلاحيات (role + user-specific)
};
```

## البنية الجديدة

### الجداول

#### roles
```sql
id | name    | description
1  | admin   | System administrator
2  | manager | Manager
3  | employee| Regular employee
```

#### screens
```sql
id | name      | code      | description
1  | Clients   | clients   | Client management
2  | Employees | employees | Employee management
...
```

#### actions
```sql
id | name   | code   | description
1  | View   | view   | View records
2  | Create | create | Create records
...
```

#### role_permissions
```sql
role_id | screen_id | action_id
1       | 1         | 1  -- admin can view clients
1       | 1         | 2  -- admin can create clients
...
```

#### user_permissions_new
```sql
user_id | screen_id | action_id | allowed
5       | 1         | 3         | true  -- user 5 can edit clients (override)
```

## الفوائد

### 1. المرونة
- إضافة شاشة جديدة: فقط أضف row في `screens`
- إضافة إجراء جديد: فقط أضف row في `actions`
- لا حاجة لتعديل الكود

### 2. القابلية للتوسع
- إضافة دور جديد: أضف role و role_permissions
- إدارة الصلاحيات عبر قاعدة البيانات فقط

### 3. القابلية للتدقيق
- جدول `audit_log` يسجل كل محاولة وصول
- يمكن تتبع من فعل ماذا ومتى

### 4. التوافق مع النظام القديم
- النظام القديم لا يزال يعمل
- يمكن الانتقال تدريجياً
- Admin bypass يعمل في كلا النظامين

## API Endpoints الجديدة

```
GET  /api/roles                    - جميع الأدوار
GET  /api/screens                  - جميع الشاشات
GET  /api/actions                  - جميع الإجراءات
GET  /api/roles/:id/permissions    - صلاحيات دور معين
PUT  /api/roles/:id/permissions    - تحديث صلاحيات دور
GET  /api/users/:id/permissions    - صلاحيات مستخدم (role + user)
PUT  /api/users/:id/permissions    - تحديث صلاحيات مستخدم
```

## الاختبار

### 1. اختبار Admin
```bash
# Admin يجب أن يرى كل شيء
curl -H "Authorization: Bearer <admin_token>" http://localhost:4000/api/clients
# يجب أن يعمل ✅
```

### 2. اختبار مستخدم عادي
```bash
# مستخدم عادي بدون صلاحيات
curl -H "Authorization: Bearer <user_token>" http://localhost:4000/api/clients
# يجب أن يرجع 403 ❌
```

### 3. منح صلاحيات
```sql
-- منح employee صلاحية view clients
INSERT INTO role_permissions (role_id, screen_id, action_id)
SELECT 3, 1, 1  -- employee, clients, view
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_id = 3 AND screen_id = 1 AND action_id = 1
);
```

## استكشاف الأخطاء

### المشكلة: Admin لا يرى كل شيء
**الحل:**
```sql
-- التحقق من role
SELECT id, name FROM roles WHERE name = 'admin';

-- التحقق من role_id للمستخدم
SELECT id, email, role, role_id FROM users WHERE email = 'admin@example.com';

-- إصلاح role_id
UPDATE users SET role_id = 1 WHERE email = 'admin@example.com';
```

### المشكلة: الصلاحيات لا تعمل
**الحل:**
1. تحقق من وجود الجداول: `node backend/scripts/verify_database.js`
2. تحقق من role_permissions: `SELECT * FROM role_permissions WHERE role_id = X`
3. تحقق من audit_log: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10`

## الدعم

إذا واجهت مشاكل:
1. تحقق من logs في Render
2. شغّل verification scripts
3. راجع audit_log للتحقق من محاولات الوصول
