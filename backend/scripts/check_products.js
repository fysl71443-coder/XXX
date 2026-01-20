import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/xxx'
});

async function checkProducts() {
  try {
    console.log('=== التحقق من المنتجات في قاعدة البيانات ===\n');
    
    // 1. عدد المنتجات
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM products');
    const totalCount = Number(countRows[0].count);
    console.log(`✅ عدد المنتجات في قاعدة البيانات: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('⚠️  لا توجد منتجات في قاعدة البيانات!\n');
      await pool.end();
      return;
    }
    
    // 2. عينة من المنتجات
    const { rows: sample } = await pool.query(`
      SELECT id, name, name_en, category, sale_price, price, is_active 
      FROM products 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log('📦 عينة من المنتجات (آخر 10):');
    console.log('─'.repeat(80));
    sample.forEach((p, i) => {
      console.log(`${i + 1}. ID: ${p.id}`);
      console.log(`   الاسم: ${p.name || 'بدون اسم'}`);
      console.log(`   الاسم الإنجليزي: ${p.name_en || 'بدون اسم إنجليزي'}`);
      console.log(`   التصنيف: ${p.category || 'بدون تصنيف'}`);
      console.log(`   السعر: ${p.sale_price || p.price || 0}`);
      console.log(`   نشط: ${p.is_active !== false ? 'نعم' : 'لا'}`);
      console.log('');
    });
    
    // 3. إحصائيات
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as with_name,
        COUNT(CASE WHEN name_en IS NOT NULL AND name_en != '' THEN 1 END) as with_name_en,
        COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END) as with_category,
        COUNT(CASE WHEN sale_price > 0 OR price > 0 THEN 1 END) as with_price,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
      FROM products
    `);
    
    const s = stats[0];
    console.log('📊 إحصائيات المنتجات:');
    console.log('─'.repeat(80));
    console.log(`   إجمالي المنتجات: ${s.total}`);
    console.log(`   منتجات لها اسم: ${s.with_name}`);
    console.log(`   منتجات لها اسم إنجليزي: ${s.with_name_en}`);
    console.log(`   منتجات لها تصنيف: ${s.with_category}`);
    console.log(`   منتجات لها سعر: ${s.with_price}`);
    console.log(`   منتجات غير نشطة: ${s.inactive}`);
    console.log('');
    
    // 4. التحقق من الأعمدة المطلوبة
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    
    console.log('🔍 أعمدة جدول products:');
    console.log('─'.repeat(80));
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    await pool.end();
    console.log('\n✅ تم التحقق بنجاح!');
    
  } catch (e) {
    console.error('❌ خطأ:', e.message);
    console.error(e.stack);
    await pool.end();
    process.exit(1);
  }
}

checkProducts();
