const API = 'http://localhost:4000/api'
const BRANCH = 'china_town'
const BRANCH_ID = 1
const TABLE_ID = 5

const TEST_ITEMS = [
  { id: 212, quantity: 1, price: 26.09 },
  { id: 213, quantity: 2, price: 15.5 },
]

let TOKEN = ''

function fatal(msg, data) {
  console.error('\n❌ TEST FAILED:', msg)
  if (data) {
    try { console.error(JSON.stringify(data, null, 2)) } catch { console.error(data) }
  }
  process.exit(1)
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers || {}),
    },
  })
  let json = null
  try { json = await res.json() } catch { json = null }
  if (!res.ok) fatal(`API error on ${path}`, json)
  return json
}

;(async () => {
  console.log('🔐 LOGIN')
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' }),
  })
  TOKEN = login && login.token
  if (!TOKEN) fatal('No token received', login)

  console.log('📝 SAVE DRAFT ORDER')
  const draft = await request('/pos/saveDraft', {
    method: 'POST',
    body: JSON.stringify({ branchId: BRANCH_ID, tableId: TABLE_ID, items: TEST_ITEMS }),
  })

  const orderId = draft.order_id || draft.orderId
  if (!orderId) fatal('Draft saved but no order_id returned', draft)
  console.log(`✅ Draft saved (order_id=${orderId})`)

  console.log('📦 LOAD ORDER BY ID')
  const byId = await request(`/orders/${orderId}`)
  if (!Array.isArray(byId.items) || byId.items.length === 0) fatal('GET /orders/:id returned EMPTY items', byId)
  console.log(`✅ GET /orders/:id items count = ${byId.items.length}`)

  console.log('📋 LOAD ORDERS BY TABLE')
  const list = await request(`/orders?branch=${encodeURIComponent(BRANCH)}&table=${encodeURIComponent(String(TABLE_ID))}&status=${encodeURIComponent('DRAFT,OPEN')}`)
  const order = Array.isArray(list) ? list.find(o => Number(o.id) === Number(orderId)) : null
  if (!order) fatal('Order not found in GET /orders list', list)
  if (!Array.isArray(order.items)) fatal('Order.items missing in GET /orders', order)
  if (order.items.length === 0) fatal('Order.items EMPTY in GET /orders (REGRESSION!)', order)
  console.log(`✅ GET /orders items count = ${order.items.length}`)

  const savedIds = TEST_ITEMS.map(i => i.id).sort()
  const loadedIds = order.items.map(i => i.product_id).sort()
  if (JSON.stringify(savedIds) !== JSON.stringify(loadedIds)) fatal('Saved items do not match loaded items', { savedIds, loadedIds })
  console.log('🎯 ITEMS MATCH EXACTLY')

  console.log('\n✅✅ REGRESSION TEST PASSED')
  console.log('Draft items are SAFE and visible on busy tables.')
  process.exit(0)
})()