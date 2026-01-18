import axios from "axios";
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(fileURLToPath(import.meta.url), '../../.env') });

const API = "http://localhost:5000/api";
const EMAIL = "fysl71443@gmail.com";
const PASSWORD = "StrongPass123";

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let token;

async function login() {
  const res = await axios.post(`${API}/auth/login`, {
    email: EMAIL,
    password: PASSWORD
  });
  token = res.data.token;
  if (!token) throw new Error("No token returned");
  console.log("✅ Login successful");
}

async function createDraft() {
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

  if (!res.data.id && !res.data.order_id) throw new Error("Draft not created");
  const orderId = res.data.id || res.data.order_id;
  console.log(`✅ Draft created: order_id=${orderId}`);
  return orderId;
}

async function checkOrderInDB(orderId) {
  const { rows } = await pgClient.query(
    'SELECT id, status, lines FROM orders WHERE id=$1',
    [orderId]
  );
  return rows[0];
}

async function getOrderFromAPI(orderId) {
  const res = await axios.get(
    `${API}/orders/${orderId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

async function testIssueInvoice(orderId) {
  // 1. Get order from DB
  console.log("\n1️⃣ Checking Order in DB:");
  const orderDB = await checkOrderInDB(orderId);
  console.log("   Order DB lines type:", typeof orderDB.lines);
  console.log("   Order DB lines isArray:", Array.isArray(orderDB.lines));
  if (typeof orderDB.lines === 'string') {
    try {
      const parsed = JSON.parse(orderDB.lines);
      console.log("   Order DB lines parsed:", JSON.stringify(parsed, null, 2).substring(0, 500));
    } catch (e) {
      console.log("   Order DB lines parse error:", e.message);
    }
  } else if (Array.isArray(orderDB.lines)) {
    console.log("   Order DB lines:", JSON.stringify(orderDB.lines, null, 2).substring(0, 500));
  }
  
  // 2. Get order from API
  console.log("\n2️⃣ Getting Order from API:");
  const orderAPI = await getOrderFromAPI(orderId);
  console.log("   Order API items type:", typeof orderAPI.items);
  console.log("   Order API items isArray:", Array.isArray(orderAPI.items));
  console.log("   Order API items:", JSON.stringify(orderAPI.items || [], null, 2).substring(0, 500));
  
  // 3. Build lines for issueInvoice
  console.log("\n3️⃣ Building lines for issueInvoice:");
  const items = Array.isArray(orderAPI.items) ? orderAPI.items : [];
  const lines = items.map(it => ({
    type: 'item',
    product_id: it.product_id || it.id,
    name: it.name || '',
    qty: Number(it.qty || it.quantity || 0),
    price: Number(it.price || 0),
    discount: Number(it.discount || 0)
  }));
  console.log("   Lines for issueInvoice:", JSON.stringify(lines, null, 2).substring(0, 500));
  console.log("   Lines types:", lines.map(l => typeof l));
  console.log("   Each line is object?", lines.every(l => typeof l === 'object' && l !== null));
  
  // 4. Try issueInvoice
  console.log("\n4️⃣ Attempting issueInvoice:");
  try {
    const res = await axios.post(
      `${API}/pos/issueInvoice`,
      {
        order_id: orderId,
        branch: orderAPI.branch || 'china_town',
        table: orderAPI.table_code || '99',
        lines: lines,
        subtotal: 250,
        discount_amount: 10,
        tax_amount: 36,
        total: 276,
        payment_method: 'CASH',
        status: 'posted'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("✅ Invoice issued:", res.data.id);
  } catch (err) {
    console.error("❌ Issue failed:");
    console.error("   Status:", err.response?.status);
    console.error("   Error:", err.response?.data?.error);
    console.error("   Details:", err.response?.data?.details);
    throw err;
  }
}

(async () => {
  try {
    await pgClient.connect();
    await login();
    const orderId = await createDraft();
    await testIssueInvoice(orderId);
    await pgClient.end();
    console.log("\n✅ Test completed");
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    await pgClient.end();
    process.exit(1);
  }
})();
