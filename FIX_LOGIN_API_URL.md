# 🔧 إصلاح مشكلة تسجيل الدخول - Frontend Dev Server

## ❌ المشكلة:

**Frontend Dev Server على `http://localhost:3000` يحاول الاتصال بـ `http://localhost:3000/api` بدلاً من `http://localhost:4000/api`**

### السبب:

في `backend/frontend/src/services/api/client.js`:
```javascript
const API_BASE = process.env.REACT_APP_API_URL || (window.location.origin + '/api')
```

عندما يعمل Frontend Dev Server على `http://localhost:3000`:
- `window.location.origin` = `http://localhost:3000`
- `API_BASE` = `http://localhost:3000/api` ❌

يجب أن يكون:
- `API_BASE` = `http://localhost:4000/api` ✅

---

## ✅ الحل:

### 1. تم إنشاء ملف `.env` في `backend/frontend/`:

```
REACT_APP_API_URL=http://localhost:4000/api
```

### 2. **يجب إعادة تشغيل Frontend Dev Server** لقراءة ملف `.env`:

```bash
# 1. أوقف Frontend Dev Server الحالي (Ctrl+C)

# 2. شغّله مرة أخرى:
cd backend/frontend
npm start
```

---

## 📋 الخطوات:

### 1. تأكد من أن Backend Server يعمل على 4000:
```
✅ Backend Server: http://localhost:4000
```

### 2. أوقف Frontend Dev Server الحالي:
- اضغط `Ctrl+C` في terminal الذي يعمل فيه Frontend Dev Server

### 3. شغّل Frontend Dev Server مرة أخرى:
```bash
cd backend/frontend
npm start
```

### 4. جرّب تسجيل الدخول:
```
http://localhost:3000/login
```

---

## ✅ النتيجة المتوقعة:

بعد إعادة تشغيل Frontend Dev Server:
- ✅ `REACT_APP_API_URL` = `http://localhost:4000/api`
- ✅ Frontend Dev Server سيتصل بـ Backend Server بشكل صحيح
- ✅ تسجيل الدخول سيعمل

---

**⚠️ مهم: يجب إعادة تشغيل Frontend Dev Server لقراءة ملف `.env` الجديد!**
