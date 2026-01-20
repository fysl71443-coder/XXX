// التحقق من اتصال قاعدة البيانات
import { pool } from './backend/db.js';

async function checkConnection() {
  try {
    console.log('🔍 التحقق من اتصال قاعدة البيانات...');
    
    if (!pool) {
      console.log('❌ pool هو null - DATABASE_URL غير موجود');
      return false;
    }
    
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    const row = result.rows[0];
    
    console.log('✅ قاعدة البيانات متصلة بنجاح!');
    console.log('📅 الوقت الحالي:', row.current_time);
    console.log('🐘 PostgreSQL Version:', row.pg_version.split(',')[0]);
    
    return true;
  } catch (error) {
    console.error('❌ خطأ في الاتصال:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 تأكد من أن خادم PostgreSQL يعمل');
    } else if (error.message.includes('authentication failed')) {
      console.log('💡 تأكد من صحة اسم المستخدم وكلمة المرور في DATABASE_URL');
    }
    return false;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkConnection().then(success => {
  process.exit(success ? 0 : 1);
});
