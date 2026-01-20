/**
 * اختبار شامل لحسابات المسودات
 * يختبر أن subtotal, discount_amount, tax_amount, total_amount 
 * تُحسب تلقائياً وتُحدث في قاعدة البيانات
 */

const BASE_URL = process.env.API_URL || 'http://localhost:4000';

let TOKEN = '';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`API error: ${res.status} - ${JSON.stringify(json)}`);
  }

  return json;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function round(num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

async function testLogin() {
  console.log('\n[TEST 1] تسجيل الدخول');
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'Admin123!' }
  });
  
  TOKEN = login.token;
  assert(TOKEN, 'يجب أن يكون هناك token بعد تسجيل الدخول');
  console.log('✅ تسجيل الدخول نجح');
}

async function testCreateOrderWithLines() {
  console.log('\n[TEST 2] إنشاء مسودة جديدة مع حساب القيم تلقائياً');
  
  const testLines = [
    {
      type: 'meta',
      branch: 'china_town',
      table: '1',
      customer_name: 'Test Customer',
      customer_phone: '1234567890',
      customerId: null,
      discountPct: 0,
      taxPct: 15,
      paymentMethod: '',
      payLines: []
    },
    {
      type: 'item',
      product_id: 1,
      id: 1,
      name: 'Product 1',
      quantity: 2,
      qty: 2,
      price: 100,
      discount: 10
    },
    {
      type: 'item',
      product_id: 2,
      id: 2,
      name: 'Product 2',
      quantity: 3,
      qty: 3,
      price: 50,
      discount: 0
    }
  ];

  // الحسابات المتوقعة:
  // subtotal = (2 * 100) + (3 * 50) = 200 + 150 = 350
  // discount_amount = 10 + 0 = 10
  // tax_amount = ((350 - 10) * 15) / 100 = (340 * 15) / 100 = 51
  // total_amount = 350 - 10 + 51 = 391

  const expectedSubtotal = 350;
  const expectedDiscount = 10;
  const expectedTax = 51;
  const expectedTotal = 391;

  const order = await request('/api/orders', {
    method: 'POST',
    body: {
      branch: 'china_town',
      table_code: '1',
      lines: testLines,
      status: 'DRAFT'
    }
  });

  assert(order.id, 'يجب أن يكون هناك order_id');
  assert(order.subtotal !== undefined, 'يجب أن يكون subtotal محسوباً');
  assert(order.discount_amount !== undefined, 'يجب أن يكون discount_amount محسوباً');
  assert(order.tax_amount !== undefined, 'يجب أن يكون tax_amount محسوباً');
  assert(order.total_amount !== undefined, 'يجب أن يكون total_amount محسوباً');

  console.log('القيم المحسوبة:', {
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    tax_amount: order.tax_amount,
    total_amount: order.total_amount
  });

  assert(round(order.subtotal) === expectedSubtotal, 
    `subtotal يجب أن يكون ${expectedSubtotal} لكنه ${order.subtotal}`);
  assert(round(order.discount_amount) === expectedDiscount, 
    `discount_amount يجب أن يكون ${expectedDiscount} لكنه ${order.discount_amount}`);
  assert(round(order.tax_amount) === expectedTax, 
    `tax_amount يجب أن يكون ${expectedTax} لكنه ${order.tax_amount}`);
  assert(round(order.total_amount) === expectedTotal, 
    `total_amount يجب أن يكون ${expectedTotal} لكنه ${order.total_amount}`);

  console.log('✅ الحسابات صحيحة في الاستجابة');

  // التحقق من قاعدة البيانات
  const loadedOrder = await request(`/api/orders/${order.id}`);
  assert(round(loadedOrder.subtotal) === expectedSubtotal, 
    `subtotal في قاعدة البيانات يجب أن يكون ${expectedSubtotal}`);
  assert(round(loadedOrder.discount_amount) === expectedDiscount, 
    `discount_amount في قاعدة البيانات يجب أن يكون ${expectedDiscount}`);
  assert(round(loadedOrder.tax_amount) === expectedTax, 
    `tax_amount في قاعدة البيانات يجب أن يكون ${expectedTax}`);
  assert(round(loadedOrder.total_amount) === expectedTotal, 
    `total_amount في قاعدة البيانات يجب أن يكون ${expectedTotal}`);

  console.log('✅ الحسابات صحيحة في قاعدة البيانات');

  return order.id;
}

async function testSaveDraftPOS(orderId) {
  console.log('\n[TEST 3] حفظ مسودة من POS مع حساب القيم');
  
  const testItems = [
    { id: 1, quantity: 1, price: 200, discount: 20 },
    { id: 2, quantity: 2, price: 75, discount: 0 }
  ];

  // الحسابات المتوقعة:
  // subtotal = (1 * 200) + (2 * 75) = 200 + 150 = 350
  // discount_amount = 20 + 0 = 20
  // tax_amount = ((350 - 20) * 15) / 100 = (330 * 15) / 100 = 49.5
  // total_amount = 350 - 20 + 49.5 = 379.5

  const expectedSubtotal = 350;
  const expectedDiscount = 20;
  const expectedTax = 49.5;
  const expectedTotal = 379.5;

  const draft = await request('/api/pos/saveDraft', {
    method: 'POST',
    body: {
      branch: 'china_town',
      table: '2',
      order_id: orderId,
      items: testItems,
      taxPct: 15
    }
  });

  assert(draft.order_id || draft.id, 'يجب أن يكون هناك order_id');
  assert(draft.subtotal !== undefined, 'يجب أن يكون subtotal محسوباً');
  assert(draft.discount_amount !== undefined, 'يجب أن يكون discount_amount محسوباً');
  assert(draft.tax_amount !== undefined, 'يجب أن يكون tax_amount محسوباً');
  assert(draft.total_amount !== undefined, 'يجب أن يكون total_amount محسوباً');

  console.log('القيم المحسوبة:', {
    subtotal: draft.subtotal,
    discount_amount: draft.discount_amount,
    tax_amount: draft.tax_amount,
    total_amount: draft.total_amount
  });

  assert(Math.abs(round(draft.subtotal) - expectedSubtotal) < 1, 
    `subtotal يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(draft.discount_amount) - expectedDiscount) < 1, 
    `discount_amount يجب أن يكون قريباً من ${expectedDiscount}`);
  assert(Math.abs(round(draft.tax_amount) - expectedTax) < 1, 
    `tax_amount يجب أن يكون قريباً من ${expectedTax}`);
  assert(Math.abs(round(draft.total_amount) - expectedTotal) < 1, 
    `total_amount يجب أن يكون قريباً من ${expectedTotal}`);

  console.log('✅ الحسابات صحيحة في saveDraft');

  // التحقق من قاعدة البيانات
  const loadedDraft = await request(`/api/orders/${draft.order_id || draft.id}`);
  assert(Math.abs(round(loadedDraft.subtotal) - expectedSubtotal) < 1, 
    `subtotal في قاعدة البيانات يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(loadedDraft.discount_amount) - expectedDiscount) < 1, 
    `discount_amount في قاعدة البيانات يجب أن يكون قريباً من ${expectedDiscount}`);

  console.log('✅ الحسابات صحيحة في قاعدة البيانات بعد saveDraft');
}

async function testUpdateOrder(orderId) {
  console.log('\n[TEST 4] تحديث مسودة مع حساب القيم تلقائياً');
  
  const updatedLines = [
    {
      type: 'meta',
      branch: 'china_town',
      table: '1',
      customer_name: 'Updated Customer',
      customer_phone: '9876543210',
      customerId: null,
      discountPct: 10, // خصم إجمالي 10%
      taxPct: 15,
      paymentMethod: '',
      payLines: []
    },
    {
      type: 'item',
      product_id: 1,
      id: 1,
      name: 'Product 1',
      quantity: 5,
      qty: 5,
      price: 100,
      discount: 0
    }
  ];

  // الحسابات المتوقعة:
  // subtotal = 5 * 100 = 500
  // discount_amount = 0 + (500 * 10 / 100) = 50 (خصم إجمالي)
  // tax_amount = ((500 - 50) * 15) / 100 = (450 * 15) / 100 = 67.5
  // total_amount = 500 - 50 + 67.5 = 517.5

  const expectedSubtotal = 500;
  const expectedDiscount = 50;
  const expectedTax = 67.5;
  const expectedTotal = 517.5;

  const updated = await request(`/api/orders/${orderId}`, {
    method: 'PUT',
    body: {
      lines: updatedLines
    }
  });

  assert(updated.id, 'يجب أن يكون هناك order_id');
  assert(updated.subtotal !== undefined, 'يجب أن يكون subtotal محسوباً');
  assert(updated.discount_amount !== undefined, 'يجب أن يكون discount_amount محسوباً');
  assert(updated.tax_amount !== undefined, 'يجب أن يكون tax_amount محسوباً');
  assert(updated.total_amount !== undefined, 'يجب أن يكون total_amount محسوباً');

  console.log('القيم المحسوبة بعد التحديث:', {
    subtotal: updated.subtotal,
    discount_amount: updated.discount_amount,
    tax_amount: updated.tax_amount,
    total_amount: updated.total_amount
  });

  assert(Math.abs(round(updated.subtotal) - expectedSubtotal) < 1, 
    `subtotal يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(updated.discount_amount) - expectedDiscount) < 1, 
    `discount_amount يجب أن يكون قريباً من ${expectedDiscount}`);
  assert(Math.abs(round(updated.tax_amount) - expectedTax) < 1, 
    `tax_amount يجب أن يكون قريباً من ${expectedTax}`);
  assert(Math.abs(round(updated.total_amount) - expectedTotal) < 1, 
    `total_amount يجب أن يكون قريباً من ${expectedTotal}`);

  console.log('✅ الحسابات صحيحة بعد التحديث');

  // التحقق من قاعدة البيانات
  const loaded = await request(`/api/orders/${orderId}`);
  assert(Math.abs(round(loaded.subtotal) - expectedSubtotal) < 1, 
    `subtotal في قاعدة البيانات يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(loaded.discount_amount) - expectedDiscount) < 1, 
    `discount_amount في قاعدة البيانات يجب أن يكون قريباً من ${expectedDiscount}`);

  console.log('✅ الحسابات صحيحة في قاعدة البيانات بعد التحديث');
}

async function testNewDraftFromPOS() {
  console.log('\n[TEST 5] إنشاء مسودة جديدة من POS');
  
  const testItems = [
    { id: 10, quantity: 2, price: 150, discount: 30 },
    { id: 11, quantity: 1, price: 200, discount: 0 }
  ];

  // الحسابات المتوقعة:
  // subtotal = (2 * 150) + (1 * 200) = 300 + 200 = 500
  // discount_amount = 30 + 0 = 30
  // tax_amount = ((500 - 30) * 15) / 100 = (470 * 15) / 100 = 70.5
  // total_amount = 500 - 30 + 70.5 = 540.5

  const expectedSubtotal = 500;
  const expectedDiscount = 30;
  const expectedTax = 70.5;
  const expectedTotal = 540.5;

  const draft = await request('/api/pos/saveDraft', {
    method: 'POST',
    body: {
      branch: 'china_town',
      table: '3',
      items: testItems,
      taxPct: 15
    }
  });

  assert(draft.order_id || draft.id, 'يجب أن يكون هناك order_id');
  assert(draft.subtotal !== undefined, 'يجب أن يكون subtotal محسوباً');
  assert(draft.discount_amount !== undefined, 'يجب أن يكون discount_amount محسوباً');
  assert(draft.tax_amount !== undefined, 'يجب أن يكون tax_amount محسوباً');
  assert(draft.total_amount !== undefined, 'يجب أن يكون total_amount محسوباً');

  console.log('القيم المحسوبة:', {
    subtotal: draft.subtotal,
    discount_amount: draft.discount_amount,
    tax_amount: draft.tax_amount,
    total_amount: draft.total_amount
  });

  assert(Math.abs(round(draft.subtotal) - expectedSubtotal) < 1, 
    `subtotal يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(draft.discount_amount) - expectedDiscount) < 1, 
    `discount_amount يجب أن يكون قريباً من ${expectedDiscount}`);
  assert(Math.abs(round(draft.tax_amount) - expectedTax) < 1, 
    `tax_amount يجب أن يكون قريباً من ${expectedTax}`);
  assert(Math.abs(round(draft.total_amount) - expectedTotal) < 1, 
    `total_amount يجب أن يكون قريباً من ${expectedTotal}`);

  console.log('✅ الحسابات صحيحة في مسودة جديدة من POS');

  // التحقق من قاعدة البيانات
  const loadedDraft = await request(`/api/orders/${draft.order_id || draft.id}`);
  assert(Math.abs(round(loadedDraft.subtotal) - expectedSubtotal) < 1, 
    `subtotal في قاعدة البيانات يجب أن يكون قريباً من ${expectedSubtotal}`);
  assert(Math.abs(round(loadedDraft.discount_amount) - expectedDiscount) < 1, 
    `discount_amount في قاعدة البيانات يجب أن يكون قريباً من ${expectedDiscount}`);

  console.log('✅ الحسابات صحيحة في قاعدة البيانات للمسودة الجديدة');

  return draft.order_id || draft.id;
}

async function runTests() {
  try {
    console.log('🧪 بدء الاختبار الشامل لحسابات المسودات\n');
    console.log('='.repeat(60));

    await testLogin();
    const orderId1 = await testCreateOrderWithLines();
    await testSaveDraftPOS(orderId1);
    await testUpdateOrder(orderId1);
    const orderId2 = await testNewDraftFromPOS();

    console.log('\n' + '='.repeat(60));
    console.log('✅✅ جميع الاختبارات نجحت!');
    console.log('\nالنتائج:');
    console.log(`- تم إنشاء وتحديث المسودة ${orderId1}`);
    console.log(`- تم إنشاء المسودة ${orderId2}`);
    console.log('\nجميع الحسابات (subtotal, discount_amount, tax_amount, total_amount)');
    console.log('تُحسب تلقائياً وتُحدث في قاعدة البيانات بشكل صحيح! 🎉');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ فشل الاختبار:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// تشغيل الاختبارات
runTests();
