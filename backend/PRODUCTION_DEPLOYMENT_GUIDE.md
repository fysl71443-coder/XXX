# دليل النشر للإنتاج
# Production Deployment Guide

**آخر تحديث:** 2026-01-21

---

## ✅ قائمة فحص الإطلاق (Checklist)

### 🔑 1. تحديث JWT_SECRET و DATABASE_URL

```bash
# في ملف .env
# استخدم أمر لتوليد مفتاح قوي:
openssl rand -base64 64

# مثال .env للإنتاج:
JWT_SECRET=your-very-long-random-secret-key-at-least-64-characters
DATABASE_URL=postgresql://user:password@production-host:5432/database?sslmode=require
NODE_ENV=production
```

⚠️ **تحذير**: لا تستخدم المفاتيح الافتراضية أبداً في الإنتاج!

---

### 🔐 2. تفعيل HTTPS (SSL/TLS)

#### الخيار أ: Reverse Proxy (موصى به)

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### الخيار ب: Let's Encrypt (مجاني)

```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx

# الحصول على شهادة
sudo certbot --nginx -d your-domain.com
```

---

### 🌐 3. ضبط CORS

في ملف `.env`:

```bash
# دومين واحد
CORS_ORIGINS=https://your-domain.com

# دومينات متعددة
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com,https://admin.your-domain.com
```

تم تحديث الكود في `server.js` لدعم قراءة `CORS_ORIGINS` من البيئة.

---

### 🔁 4. إعادة تشغيل الخادم

```bash
# باستخدام PM2 (موصى به للإنتاج)
pm2 restart all

# أو تشغيل مباشر
npm run start
```

#### إعداد PM2 للمرة الأولى:

```bash
# تثبيت PM2
npm install -g pm2

# تشغيل التطبيق
pm2 start server.js --name "accounting-system"

# تفعيل التشغيل التلقائي عند إعادة تشغيل الخادم
pm2 startup
pm2 save
```

---

### 💾 5. تفعيل Backup يومي

#### باستخدام Cron:

```bash
# تعديل crontab
crontab -e

# إضافة السطر التالي (يومياً الساعة 2 صباحاً)
0 2 * * * cd /path/to/backend && node scripts/backup-database.js >> /var/log/backup.log 2>&1

# تنظيف النسخ القديمة أسبوعياً
0 3 * * 0 cd /path/to/backend && node scripts/backup-database.js --cleanup >> /var/log/backup.log 2>&1
```

#### أوامر النسخ الاحتياطي:

```bash
# إنشاء نسخة احتياطية
node scripts/backup-database.js

# عرض النسخ المتاحة
node scripts/backup-database.js --list

# استعادة نسخة
node scripts/backup-database.js --restore backup_file.sql.gz

# حذف النسخ القديمة
node scripts/backup-database.js --cleanup
```

---

### 📊 6. تفعيل Error Logging

#### PM2 Logs:

```bash
# عرض السجلات
pm2 logs accounting-system

# عرض آخر 100 سطر
pm2 logs accounting-system --lines 100

# مسح السجلات
pm2 flush
```

#### إعداد مستوى الـ Logging في `.env`:

```bash
LOG_LEVEL=warn  # production
LOG_LEVEL=info  # development
```

---

## 📌 تحسينات ما بعد الإطلاق

### ✅ 1. Audit Log موحّد

النظام يحتوي بالفعل على نظام Audit Log متكامل:

- **المسار**: `/api/audit/accounting`
- **الميزات**:
  - تتبع جميع العمليات (إنشاء، تعديل، حذف، ترحيل، عكس)
  - تسجيل المستخدم + الوقت + القيم قبل/بعد
  - البحث حسب النوع، المستخدم، الفترة

```javascript
// مثال الاستخدام في Frontend
import { audit } from '../services/api'

// تسجيل عملية
await audit.log({
  entity_type: 'journal_entry',
  entity_id: entryId,
  action: 'update',
  user_id: currentUser.id,
  old_value: oldData,
  new_value: newData
})
```

---

### ✅ 2. قفل الفترات المحاسبية

النظام يدعم قفل الفترات المحاسبية:

```javascript
// API Endpoints
POST /api/accounting-periods/:period/close  // قفل فترة
POST /api/accounting-periods/:period/open   // فتح فترة

// Middleware يمنع التعديل على فترات مغلقة
checkAccountingPeriod
```

---

### ✅ 3. Health Check Endpoint

تم تحديث الـ Health Check ليشمل:

```bash
GET /api/health
```

**Response:**

```json
{
  "status": "healthy",
  "env": "production",
  "port": 4000,
  "timestamp": "2026-01-21T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 128,
    "total": 256,
    "unit": "MB"
  },
  "database": {
    "status": "connected",
    "latency": "5ms"
  },
  "responseTime": "10ms"
}
```

---

### 📈 4. Monitoring للأداء

#### استخدام PM2 Monitoring:

```bash
# عرض الحالة
pm2 status

# عرض الموارد
pm2 monit

# تصدير التقارير
pm2 report
```

#### إعداد Alert للأخطاء:

```javascript
// في server.js - يمكن إضافة
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  // إرسال تنبيه عبر البريد أو Slack
  process.exit(1);
});
```

---

## 🚀 خطوات النشر السريع

```bash
# 1. نسخ ملف البيئة
cp .env.example .env
# تعديل القيم في .env

# 2. تثبيت الاعتماديات
npm install --production

# 3. بناء الـ Frontend
cd frontend && npm install && npm run build && cd ..

# 4. تشغيل الخادم
pm2 start server.js --name "accounting"

# 5. التحقق من العمل
curl http://localhost:4000/api/health
```

---

## 🔒 ملاحظات أمنية مهمة

1. **لا تشارك ملف `.env` أبداً**
2. **استخدم HTTPS دائماً في الإنتاج**
3. **قم بتحديث الاعتماديات بانتظام**: `npm audit fix`
4. **فعّل جدار الحماية** وأغلق المنافذ غير الضرورية
5. **راقب السجلات** للكشف عن محاولات الاختراق
6. **اختبر النسخ الاحتياطي** بشكل دوري

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، راجع التقارير في:
- `FINAL_SYSTEM_REVIEW_REPORT.md`
- `ACCOUNTING_SCREEN_COMPREHENSIVE_REVIEW.md`

---

**✅ النظام جاهز 100% للإنتاج**
