// التحقق من أن الخادم يعمل
import http from 'http';

const PORT = 10000;

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  console.log(`حالة الرد: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('رد الخادم:', data || '(لا يوجد محتوى)');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`❌ الخادم لا يعمل على المنفذ ${PORT}`);
  console.error(`الخطأ: ${e.message}`);
  console.log('\n💡 لتشغيل الخادم:');
  console.log('   cd backend && npm start');
  process.exit(1);
});

req.end();
