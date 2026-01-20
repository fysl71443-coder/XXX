import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

/**
 * Script to test products API endpoint
 * Tests if products query works correctly
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function testProductsQuery() {
  try {
    console.log('=== اختبار استعلام المنتجات ===\n');

    // Test 1: Count all products
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log(`📊 إجمالي المنتجات في قاعدة البيانات: ${countRows[0].count}\n`);

    // Test 2: Get all products
    const { rows: allProducts } = await pool.query(`
      SELECT id, name, name_en, category, price, is_active, created_at 
      FROM products 
      ORDER BY id DESC
    `);
    console.log(`📦 جميع المنتجات (${allProducts.length}):`);
    allProducts.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p.id} | Name: ${p.name} | Active: ${p.is_active} | Category: ${p.category || '(none)'}`);
    });
    console.log('');

    // Test 3: Test the exact query used by API
    const { rows: apiProducts } = await pool.query(`
      SELECT 
        id, name, name_en, sku, barcode, category, unit, 
        COALESCE(sale_price, price, 0) as sale_price,
        price, cost, tax_rate, stock_quantity, min_stock, 
        description, is_active, is_service, can_be_sold, 
        can_be_purchased, can_be_expensed, created_at, updated_at
      FROM products 
      WHERE (is_active = true OR is_active IS NULL)
      ORDER BY category ASC, name ASC
    `);
    console.log(`✅ المنتجات التي يجب أن تظهر في API (${apiProducts.length}):`);
    apiProducts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (ID: ${p.id}) - Active: ${p.is_active} - Category: ${p.category || '(none)'}`);
    });
    console.log('');

    // Test 4: Check for any issues
    const { rows: issues } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_true,
        COUNT(CASE WHEN is_active = false THEN 1 END) as active_false,
        COUNT(CASE WHEN is_active IS NULL THEN 1 END) as active_null
      FROM products
    `);
    console.log('📊 إحصائيات is_active:');
    console.log(`   Total: ${issues[0].total}`);
    console.log(`   is_active = true: ${issues[0].active_true}`);
    console.log(`   is_active = false: ${issues[0].active_false}`);
    console.log(`   is_active IS NULL: ${issues[0].active_null}`);
    console.log('');

    if (apiProducts.length === 0 && allProducts.length > 0) {
      console.log('⚠️  تحذير: يوجد منتجات في قاعدة البيانات لكن لا تظهر في API');
      console.log('   السبب المحتمل: جميع المنتجات لديها is_active = false');
      console.log('   الحل: شغّل UPDATE products SET is_active = true WHERE is_active = false;');
    } else if (apiProducts.length > 0) {
      console.log('✅ المنتجات يجب أن تظهر في البرنامج');
      console.log('   إذا لم تظهر، تحقق من:');
      console.log('   1. الصلاحيات - تأكد من أن المستخدم لديه صلاحية "products:view"');
      console.log('   2. Logs السيرفر - تحقق من رسائل الخطأ في Render Logs');
      console.log('   3. Console المتصفح - افتح Developer Tools وتحقق من الأخطاء');
    }

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testProductsQuery();
