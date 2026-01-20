# 🔐 إصلاح مشكلة تسجيل الدخول

## ❌ المشكلة:
- Frontend Dev Server يعمل على `http://localhost:3000` ✅
- Backend Server **لا يعمل** على `http://localhost:4000` ❌
- النتيجة: **"تعذر تسجيل الدخول"** لأن Frontend لا يستطيع الاتصال بالـ Backend API

---

## ✅ الحل:

### الخطوة 1: تشغيل Backend Server

افتح terminal جديد وشغّل:

```bash
cd backend
$env:PORT="4000"
$env:NODE_ENV="development"
node server.js
```

**أو:**

```bash
cd backend
npm start
```

(إذا كان PORT=4000 في `.env`)

---

### الخطوة 2: التحقق من أن كلا الخوادم يعملان

| الخادم | URL | المنفذ | الحالة |
|--------|-----|--------|--------|
| **Backend** | http://localhost:4000 | 4000 | ⚠️ يجب تشغيله |
| **Frontend Dev** | http://localhost:3000 | 3000 | ✅ يعمل |

---

### الخطوة 3: تسجيل الدخول

1. افتح: `http://localhost:3000/login`
2. أدخل:
   - **Email:** `fysl71443@gmail.com`
   - **Password:** `StrongPass123`
3. اضغط **تسجيل الدخول**

---

## 📊 ملاحظات:

- **Frontend Dev Server** على 3000 ✅ يعمل
- **Backend Server** على 4000 ❌ يحتاج تشغيل
- **Frontend Dev Server** يحتاج Backend Server ليعمل لتسجيل الدخول

---

## 🔍 التحقق من حالة الخوادم:

```powershell
# Backend Server (4000)
Test-NetConnection -ComputerName localhost -Port 4000 -InformationLevel Quiet

# Frontend Dev Server (3000)
Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet
```

---

## ⚡ الأوامر السريعة:

### تشغيل Backend فقط:
```bash
cd backend
npm start
```

### تشغيل Frontend Dev Server فقط:
```bash
cd backend/frontend
npm start
```

### تشغيل كلاهما:
- **Terminal 1:** `cd backend && npm start`
- **Terminal 2:** `cd backend/frontend && npm start`

---

**بعد تشغيل Backend Server، حاول تسجيل الدخول مرة أخرى!** 🎉
