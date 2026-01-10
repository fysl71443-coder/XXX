const API = 'http://localhost:4000/api'

async function login() {
  const email = 'admin@example.com'
  const password = 'Admin123!'
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Login failed')
  console.log('[LOGIN] Success, token received')
  return data.token
}

async function api(token) {
  return {
    get: async (path, { params } = {}) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
      const r = await fetch(`${API}${path}${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (!r.ok) {
        console.error(`[API GET] Failed ${path}`, r.status, data)
        return { ok: false, status: r.status, ...data }
      }
      return data
    },
    post: async (path, body) => {
      const r = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body || {})
      })
      const data = await r.json()
      if (!r.ok) {
        console.error(`[API POST] Failed ${path}`, r.status, data)
        return { ok: false, status: r.status, ...data }
      }
      return data
    }
  }
}

;(async () => {
  try {
    const token = await login()
    const c = await api(token)

    // 1️⃣ جلب الرقم التالي للفواتير
    console.log('\n[STEP 1] Get next invoice number')
    const nextInvoice = await c.get('/invoices/next-number', { params: { branch_id: 1 } })
    console.log('Next invoice number:', nextInvoice)

    // 2️⃣ حفظ مسودة order
    console.log('\n[STEP 2] Save draft order')
  const draftPayload = {
    branchId: 1,
    tableId: 5,
    items: [
      { id: 212, quantity: 1, price: 26.09 },
      { id: 213, quantity: 2, price: 15.5 }
    ]
  }
  const draft = await c.post('/pos/saveDraft', draftPayload)
    console.log('Draft saved:', draft)

    // تكيف مع شكل الـ API الحالي: يستخدم `order_id`
    const orderId = Number(draft?.order_id || 0)
    if (!orderId) {
      throw new Error('Draft save failed: missing order_id')
    }

    // 3️⃣ استرجاع order بعد الحفظ للتأكد من الأصناف
    console.log('\n[STEP 3] Load order to verify items')
    const order = await c.get(`/orders/${orderId}`)
    const loadedItems = Array.isArray(order?.items)
      ? order.items
      : (Array.isArray(order?.lines)
        ? order.lines.filter(x => x && x.type === 'item').map(i => ({ product_id: i.product_id, name: i.name, qty: i.qty, price: i.price }))
        : [])
    console.log('Loaded order:', {
      orderId: order.id,
      tableId: (function(){ try { const meta=(order.lines||[]).find(x=>x&&x.type==='meta'); return meta?.table||null } catch { return null } })(),
      items: loadedItems.map(i => ({ id: i.product_id, name: i.name, quantity: i.qty, price: i.price }))
    })

    // 4️⃣ التحقق الصارم من تطابق الأصناف
    const savedIds = draftPayload.items.map(i => i.id).sort()
    const loadedIds = loadedItems.map(i => i.product_id).sort()
    const allMatch = JSON.stringify(savedIds) === JSON.stringify(loadedIds)
    console.log('\n[CHECK] Items match after reload:', allMatch ? '✅ PASS' : '❌ FAIL')

    if (!allMatch) process.exit(1)

    // 5️⃣ التحقق من قائمة الأوامر حسب الطاولة والحالة (BUSY/DRAFT)
    console.log('\n[STEP 4] List orders for table to verify items presence')
    const list = await c.get('/orders', { params: { branch: 'china_town', table: '5', status: 'DRAFT,OPEN' } })
    const first = Array.isArray(list) ? list.find(o => Number(o.id) === orderId) || list[0] : null
    console.log('Orders list sample:', first ? { id: first.id, status: first.status, table: first.table, itemsCount: Array.isArray(first.items) ? first.items.length : 0 } : 'none')
  if (!first || !Array.isArray(first.items) || first.items.length === 0) {
    throw new Error('Orders list did not include items for busy table')
  }

    // 5️⃣ إصدار الفاتورة مع خصم منصّة 2% (اختبار الخصم)
    console.log('\n[STEP 5] Issue invoice with discount')
    const issuePayload = {
      branchId: 1,
      tableId: 5,
      branch: 'china_town',
      items: draftPayload.items.map(i => ({ ...i })),
      customerId: null,
      paymentType: '',
      discountPct: 2,
      taxPct: 15
    }
    const issueRes = await c.post('/pos/issueInvoice', issuePayload)
    if (!issueRes || !issueRes.success) throw new Error('Issue invoice failed')
    const inv = issueRes.invoice || {}
    console.log('Issued invoice:', { id: inv.id, number: inv.invoice_number, discount_total: inv.discount_total, total: inv.total, tax: inv.tax })

    // 6️⃣ التحقق من وجود قيد خصم (حساب 4190)
    console.log('\n[STEP 6] Verify journal posting includes discount (4190)')
    const journal = await c.get('/journal', { params: { search: String(inv.invoice_number||inv.id||'') } })
    const entry = (journal.items||[]).find(e => e.related_type==='invoice' && e.related_id===inv.id)
    if (!entry) throw new Error('No journal entry found for invoice')
    const entryFull = await c.get(`/journal/${entry.id}`)
    const postings = entryFull.postings || []
    const drDisc = postings.find(p => String(p.account?.account_code||'')==='4190' && Number(p.debit||0)>0)
    console.log('Discount posting:', drDisc ? { account: drDisc.account?.account_code, debit: drDisc.debit } : 'none')
    if (!drDisc || Number(drDisc.debit||0) <= 0) throw new Error('Discount not posted to 4190')
  } catch (e) {
    console.error('[TEST FAILED]', e.message || e)
    process.exit(1)
  }
})()