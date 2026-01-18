import axios from "axios";

const API = "http://localhost:5000/api";
const EMAIL = "fysl71443@gmail.com";
const PASSWORD = "StrongPass123";

let token;

function die(msg) {
  console.error("❌ TEST FAILED:", msg);
  process.exit(1);
}

async function login() {
  try {
    const res = await axios.post(`${API}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    token = res.data.token;
    if (!token) die("No token returned");
    console.log("✅ Login successful");
  } catch (err) {
    die(`Login failed: ${err.response?.data?.error || err.message}`);
  }
}

async function createDraft() {
  try {
    const res = await axios.post(
      `${API}/pos/saveDraft`,
      {
        branch: "china_town",
        table: "99",
        items: [
          { id: 1, name: "Test Product 1", quantity: 2, price: 100, discount: 10 },
          { id: 2, name: "Test Product 2", quantity: 1, price: 50, discount: 0 }
        ],
        taxPct: 15
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.data.id && !res.data.order_id) die("Draft not created - no id or order_id");
    const orderId = res.data.id || res.data.order_id;
    console.log(`✅ Draft created: order_id=${orderId}`);
    console.log(`   invoice=${res.data.invoice === null || !res.data.invoice_id ? 'null ✅' : 'not null ❌'}`);
    return orderId;
  } catch (err) {
    die(`Draft creation failed: ${err.response?.data?.error || err.message}`);
  }
}

async function issueInvoice(orderId) {
  try {
    // Get order details first to build proper payload
    const orderRes = await axios.get(
      `${API}/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const order = orderRes.data;
    
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, it) => sum + (Number(it.qty||it.quantity||0) * Number(it.price||0)), 0);
    const discount = items.reduce((sum, it) => sum + Number(it.discount||0), 0);
    const tax = ((subtotal - discount) * 15) / 100;
    const total = subtotal - discount + tax;
    
    const lines = items.map(it => ({
      type: 'item',
      product_id: it.product_id || it.id,
      name: it.name || '',
      qty: Number(it.qty || it.quantity || 0),
      price: Number(it.price || 0),
      discount: Number(it.discount || 0)
    }));
    
    const res = await axios.post(
      `${API}/pos/issueInvoice`,
      {
        order_id: orderId,
        branch: order.branch || 'china_town',
        table: order.table_code || '99',
        lines: lines,
        subtotal: subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total: total,
        payment_method: 'CASH',
        status: 'posted'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.data.id) {
      die("Invoice not issued – no id returned");
    }

    const invoiceId = res.data.id;
    console.log(`✅ INVOICE ISSUED: invoice_id=${invoiceId}`);
    
    // Verify order was updated
    const verifyRes = await axios.get(
      `${API}/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const updatedOrder = verifyRes.data;
    
    if (updatedOrder.status !== 'ISSUED') {
      die(`Order status not ISSUED: ${updatedOrder.status}`);
    }
    if (!updatedOrder.invoice_id) {
      die("Order invoice_id is missing");
    }
    if (updatedOrder.invoice_id !== invoiceId) {
      die(`Order invoice_id mismatch: expected ${invoiceId}, got ${updatedOrder.invoice_id}`);
    }
    
    console.log(`✅ Order updated: status=ISSUED, invoice_id=${updatedOrder.invoice_id}`);
    return invoiceId;
  } catch (err) {
    console.error("❌ ISSUE FAILED RESPONSE:");
    console.error("Status:", err.response?.status);
    console.error("Error:", err.response?.data?.error || err.message);
    console.error("Details:", err.response?.data?.details || 'No details');
    process.exit(1);
  }
}

(async () => {
  console.log("🧪 اختبار صارم: إصدار الفاتورة");
  console.log("=".repeat(60));
  
  await login();
  const orderId = await createDraft();
  const invoiceId = await issueInvoice(orderId);
  
  console.log("");
  console.log("=".repeat(60));
  console.log("✅ TEST COMPLETED SUCCESSFULLY");
  console.log(`   Order ID: ${orderId}`);
  console.log(`   Invoice ID: ${invoiceId}`);
  console.log("=".repeat(60));
})();
