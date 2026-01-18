import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
const API_BASE = 'http://localhost:5000/api'; // Backend API on port 5000

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

async function getAuthToken() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const email = 'fysl71443@gmail.com';
    const { rows } = await client.query(
      'SELECT id, email, role FROM "users" WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = rows && rows[0];
    if (!user) {
      throw new Error('User not found');
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    return token;
  } finally {
    await client.end();
  }
}

async function apiRequest(method, path, token, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (e) {
    return { status: 0, error: e.message, data: null };
  }
}

async function checkAccountingPeriod(period) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT id, period, status FROM accounting_periods WHERE period = $1 LIMIT 1',
      [period]
    );
    return rows && rows[0] ? rows[0] : null;
  } finally {
    await client.end();
  }
}

async function ensureAccountingPeriod(period) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const existing = await checkAccountingPeriod(period);
    if (existing) {
      if (existing.status !== 'open') {
        await client.query(
          'UPDATE accounting_periods SET status=$1, opened_at=NOW(), closed_at=NULL WHERE period=$2',
          ['open', period]
        );
        console.log(`✅ Updated period ${period} to OPEN`);
      } else {
        console.log(`✅ Period ${period} already OPEN`);
      }
    } else {
      await client.query(
        'INSERT INTO accounting_periods(period, status, opened_at) VALUES ($1, $2, NOW()) ON CONFLICT (period) DO UPDATE SET status=EXCLUDED.status',
        [period, 'open']
      );
      console.log(`✅ Created period ${period} with OPEN status`);
    }
  } finally {
    await client.end();
  }
}

async function getOrder(orderId, token) {
  return await apiRequest('GET', `/orders/${orderId}`, token);
}

async function checkOrderInDB(orderId) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT id, status, invoice_id, branch, table_code FROM orders WHERE id=$1',
      [orderId]
    );
    return rows && rows[0] || null;
  } finally {
    await client.end();
  }
}

async function checkInvoiceInDB(invoiceId) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT id, number, status, total FROM invoices WHERE id=$1',
      [invoiceId]
    );
    return rows && rows[0] || null;
  } finally {
    await client.end();
  }
}

async function testIssueInvoiceFlow() {
  console.log('🧪 اختبار عملية إصدار الفاتورة');
  console.log('='.repeat(60));
  
  try {
    // 1. الحصول على Token
    console.log('\n1️⃣ الحصول على Token...');
    const token = await getAuthToken();
    if (!token) {
      console.error('❌ فشل الحصول على Token');
      return;
    }
    console.log(`✅ Token: ${token.substring(0, 30)}...`);
    
    // 2. التأكد من وجود فترة محاسبية مفتوحة
    console.log('\n2️⃣ التحقق من فترة محاسبية...');
    const currentDate = new Date();
    const period = currentDate.toISOString().slice(0, 7); // YYYY-MM
    console.log(`   Period: ${period}`);
    await ensureAccountingPeriod(period);
    
    // 3. إنشاء مسودة جديدة
    console.log('\n3️⃣ إنشاء مسودة جديدة...');
    const draftPayload = {
      branch: 'china_town',
      table: '5',
      items: [
        { product_id: 1, name: 'Test Product 1', quantity: 2, price: 100, discount: 0 },
        { product_id: 2, name: 'Test Product 2', quantity: 1, price: 50, discount: 0 }
      ],
      discountPct: 0,
      taxPct: 15
    };
    
    const saveDraftRes = await apiRequest('POST', '/pos/saveDraft', token, draftPayload);
    console.log(`   Status: ${saveDraftRes.status}`);
    console.log(`   Response:`, JSON.stringify(saveDraftRes.data, null, 2));
    
    if (saveDraftRes.status !== 200 || !saveDraftRes.data?.order_id) {
      console.error('❌ فشل إنشاء المسودة');
      return;
    }
    
    const orderId = saveDraftRes.data.order_id;
    console.log(`✅ المسودة أنشئت: order_id=${orderId}`);
    console.log(`   invoice=null: ${saveDraftRes.data.invoice === null || !saveDraftRes.data.invoice_id ? '✅' : '❌'}`);
    
    // 4. التحقق من المسودة في DB
    console.log('\n4️⃣ التحقق من المسودة في قاعدة البيانات...');
    const orderInDB = await checkOrderInDB(orderId);
    if (!orderInDB) {
      console.error('❌ المسودة غير موجودة في قاعدة البيانات');
      return;
    }
    console.log(`✅ Order في DB:`, {
      id: orderInDB.id,
      status: orderInDB.status,
      invoice_id: orderInDB.invoice_id,
      branch: orderInDB.branch,
      table_code: orderInDB.table_code
    });
    
    if (orderInDB.status !== 'DRAFT') {
      console.warn(`⚠️  حالة المسودة ليست DRAFT: ${orderInDB.status}`);
    }
    
    // 5. الحصول على المسودة من API
    console.log('\n5️⃣ الحصول على المسودة من API...');
    const getOrderRes = await getOrder(orderId, token);
    console.log(`   Status: ${getOrderRes.status}`);
    if (getOrderRes.status === 200) {
      const order = getOrderRes.data;
      const items = Array.isArray(order.lines) ? order.lines.filter(l => l && l.type === 'item') : [];
      console.log(`✅ Order من API:`, {
        id: order.id,
        status: order.status,
        invoice_id: order.invoice_id || null,
        itemsCount: items.length
      });
    }
    
    // 6. إصدار الفاتورة
    console.log('\n6️⃣ إصدار الفاتورة...');
    const issuePayload = {
      order_id: orderId,
      branch: 'china_town',
      table: '5',
      lines: [
        { type: 'item', product_id: 1, name: 'Test Product 1', qty: 2, price: 100, discount: 0 },
        { type: 'item', product_id: 2, name: 'Test Product 2', qty: 1, price: 50, discount: 0 }
      ],
      subtotal: 250,
      discount_amount: 0,
      tax_amount: 37.5,
      total: 287.5,
      payment_method: 'CASH',
      status: 'posted'
    };
    
    const issueRes = await apiRequest('POST', '/pos/issueInvoice', token, issuePayload);
    console.log(`   Status: ${issueRes.status}`);
    console.log(`   Response:`, JSON.stringify(issueRes.data, null, 2));
    
    if (issueRes.status !== 200 || !issueRes.data?.id) {
      console.error('❌ فشل إصدار الفاتورة');
      console.error('   Error:', issueRes.data?.error || 'Unknown error');
      console.error('   Details:', issueRes.data?.details || 'No details');
      return;
    }
    
    const invoiceId = issueRes.data.id;
    console.log(`✅ الفاتورة أنشئت: invoice_id=${invoiceId}`);
    
    // 7. التحقق من تحديث Order
    console.log('\n7️⃣ التحقق من تحديث Order...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    const updatedOrderInDB = await checkOrderInDB(orderId);
    if (!updatedOrderInDB) {
      console.error('❌ Order غير موجود في DB');
      return;
    }
    
    console.log(`✅ Order المحدث:`, {
      id: updatedOrderInDB.id,
      status: updatedOrderInDB.status,
      invoice_id: updatedOrderInDB.invoice_id
    });
    
    if (updatedOrderInDB.status !== 'ISSUED') {
      console.error(`❌ حالة Order ليست ISSUED: ${updatedOrderInDB.status}`);
    } else {
      console.log(`✅ حالة Order = ISSUED`);
    }
    
    if (!updatedOrderInDB.invoice_id) {
      console.error(`❌ invoice_id غير موجود في Order`);
    } else {
      console.log(`✅ invoice_id = ${updatedOrderInDB.invoice_id}`);
      if (updatedOrderInDB.invoice_id !== invoiceId) {
        console.warn(`⚠️  invoice_id في Order (${updatedOrderInDB.invoice_id}) يختلف عن invoice_id المُرجَع (${invoiceId})`);
      }
    }
    
    // 8. التحقق من Invoice في DB
    console.log('\n8️⃣ التحقق من Invoice في قاعدة البيانات...');
    const invoiceInDB = await checkInvoiceInDB(invoiceId);
    if (!invoiceInDB) {
      console.error('❌ Invoice غير موجود في قاعدة البيانات');
      return;
    }
    console.log(`✅ Invoice في DB:`, {
      id: invoiceInDB.id,
      number: invoiceInDB.number,
      status: invoiceInDB.status,
      total: invoiceInDB.total
    });
    
    // 9. ملخص
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الاختبار:');
    console.log('='.repeat(60));
    console.log(`✅ المسودة: order_id=${orderId}, status=${updatedOrderInDB.status}`);
    console.log(`✅ الفاتورة: invoice_id=${invoiceId}, status=${invoiceInDB.status}`);
    console.log(`✅ Order مرتبط بالفاتورة: ${updatedOrderInDB.invoice_id === invoiceId ? 'نعم' : 'لا'}`);
    console.log('='.repeat(60));
    console.log('✅ الاختبار نجح!');
    
  } catch (e) {
    console.error('\n❌ خطأ في الاختبار:', e);
    console.error(e.stack);
  }
}

testIssueInvoiceFlow();
