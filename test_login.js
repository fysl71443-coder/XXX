// اختبار تسجيل الدخول
const BASE_URL = 'http://localhost:4000';

async function testLogin() {
  try {
    console.log('🔐 اختبار تسجيل الدخول...');
    console.log('📧 البريد:', 'fysl71443@gmail.com');
    console.log('🔗 URL:', `${BASE_URL}/api/auth/login`);
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'fysl71443@gmail.com',
        password: 'StrongPass123'
      })
    });
    
    const data = await response.json();
    
    console.log('\n📊 النتيجة:');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.token) {
      console.log('\n✅ تسجيل الدخول نجح!');
      console.log('Token:', data.token.substring(0, 50) + '...');
      return data.token;
    } else {
      console.log('\n❌ فشل تسجيل الدخول');
      if (data.error === 'db_not_configured') {
        console.log('⚠️ المشكلة: قاعدة البيانات غير متصلة');
        console.log('💡 الحل: أضف DATABASE_URL في backend/.env');
      } else if (data.error === 'not_found') {
        console.log('⚠️ المشكلة: المستخدم غير موجود');
        console.log('💡 الحل: يجب إنشاء المستخدم أولاً');
      } else if (data.error === 'invalid_credentials') {
        console.log('⚠️ المشكلة: كلمة المرور غير صحيحة');
      }
      return null;
    }
  } catch (error) {
    console.error('\n❌ خطأ في الاتصال:', error.message);
    if (error.message.includes('fetch failed')) {
      console.log('⚠️ الخادم غير متاح على', BASE_URL);
      console.log('💡 تأكد من أن الخادم يعمل: cd backend && npm start');
    }
    return null;
  }
}

testLogin().then(token => {
  if (token) {
    console.log('\n✅ الاختبار نجح!');
    process.exit(0);
  } else {
    console.log('\n❌ الاختبار فشل');
    process.exit(1);
  }
});
