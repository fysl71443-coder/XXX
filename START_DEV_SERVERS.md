# 🚀 تشغيل الخوادم في وضع المطور - تعليمات سريعة

## ✅ التغييرات المُنفذة

تم تعديل `backend/frontend/src/pages/POSInvoice.jsx` لإضافة:
- ✅ عمود "المبلغ" في جدول ملخص الإيصال
- ✅ صف "الإجمالي الفرعي" (Subtotal)
- ✅ صف "الخصم" (Discount) - يظهر إذا كان > 0
- ✅ صف "الضريبة" (Tax) - يظهر إذا كانت > 0
- ✅ صف "الإجمالي النهائي" (Total) - بخط عريض

---

## 🔄 لتطبيق التغييرات فوراً

### الخيار 1: استخدام Frontend Dev Server (Hot Reload) ⚡

**الأفضل للتطوير السريع - التغييرات تظهر فوراً!**

1. **افتح terminal جديد**

2. **شغّل Backend Server:**
   ```bash
   cd backend
   npm start
   ```
   سيبدأ على: `http://localhost:4000`

3. **افتح terminal آخر**

4. **شغّل Frontend Dev Server:**
   ```bash
   cd backend/frontend
   npm start
   ```
   سيبدأ على: `http://localhost:3000`

5. **افتح المتصفح على:**
   ```
   http://localhost:3000
   ```

**الآن:**
- ✅ أي تغيير في `backend/frontend/src` سيظهر فوراً (hot reload)
- ✅ Backend API متاح على `http://localhost:4000/api`
- ✅ Frontend Dev Server يتصل تلقائياً بـ Backend

---

### الخيار 2: Rebuild Frontend (أبطأ)

**إذا كنت تستخدم Backend Server فقط:**

1. **أوقف الخادم الحالي** (Ctrl+C)

2. **أعد بناء Frontend:**
   ```bash
   cd backend/frontend
   npm run build
   ```

3. **أعد تشغيل Backend:**
   ```bash
   cd backend
   npm start
   ```

4. **افتح المتصفح على:**
   ```
   http://localhost:4000
   ```

---

## 📊 الروابط

| الخادم | URL | الاستخدام |
|--------|-----|-----------|
| Backend | http://localhost:4000 | API + Frontend (production build) |
| Frontend Dev | http://localhost:3000 | Frontend فقط (hot reload) |

---

## ⚡ الأفضل للتطوير

**استخدم Frontend Dev Server** للحصول على:
- ✅ Hot reload فوري
- ✅ لا حاجة لـ rebuild
- ✅ التغييرات تظهر مباشرة

**الأمر:**
```bash
# Terminal 1
cd backend && npm start

# Terminal 2  
cd backend/frontend && npm start
```

---

**جاهز! افتح http://localhost:3000 لرؤية التغييرات فوراً** 🎉
