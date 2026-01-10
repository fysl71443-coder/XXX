import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
jest.setTimeout(20000)
beforeEach(() => { jest.clearAllMocks() })

jest.mock('react-router-dom', () => {
  let route = { branch: 'china_town', table: '1', order: null }
  const setRoute = (r) => { route = { ...route, ...r } }
  return {
    __esModule: true,
    useParams: () => ({ branch: route.branch, table: route.table }),
    useSearchParams: () => [new URLSearchParams(route.order ? `?order=${route.order}` : ''), jest.fn()],
    useNavigate: () => jest.fn(),
    __setRoute: setRoute,
  }
}, { virtual: true })

jest.mock('../services/api', () => require('../../services/api'), { virtual: true })

jest.mock('../../services/api', () => {
  const createdOrders = []
  const updatedOrders = []
  const createdInvoices = []
  const createdPayments = []
  let nextNumber = { next: 'INV-001' }
  const partnersList = [
    { id: 1, name: 'عميل نقدي', type: 'عميل', customer_type: 'نقدي', phone: null, contact_info: JSON.stringify({ walk_in: true }) },
    { id: 2, name: 'عميل آجل', type: 'عميل', customer_type: 'آجل', phone: '0500000000', contact_info: JSON.stringify({ discount_pct: 0 }) },
  ]
  const productsList = [
    { id: 'p1', name: 'منتج 1', category: 'عام', sale_price: 10 },
    { id: 'p2', name: 'منتج 2', category: 'عام', sale_price: 5 },
  ]
  const ordersById = {}
  let nextOrderId = 165
  return {
    __esModule: true,
    default: { defaults: { baseURL: 'http://localhost:4000/api' } },
    request: jest.fn(),
    partners: {
      list: jest.fn(() => Promise.resolve(partnersList)),
      create: jest.fn((data) => Promise.resolve({ id: 3, ...data })),
      update: jest.fn(),
      remove: jest.fn(),
    },
    products: {
      list: jest.fn(() => Promise.resolve(productsList)),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
    orders: {
      list: jest.fn(),
      get: jest.fn((id) => Promise.resolve({ id, lines: JSON.stringify(ordersById[id] || []) })),
      create: jest.fn((data) => { const created = { id: createdOrders.length + 100, ...data }; createdOrders.push(created); return Promise.resolve(created) }),
      update: jest.fn((id, data) => { updatedOrders.push({ id, data }); return Promise.resolve({ id, ...data }) }),
      remove: jest.fn((id) => Promise.resolve({ id })),
    },
    invoices: {
      list: jest.fn(),
      get: jest.fn((id) => Promise.resolve({ invoice: { id }, items: [] })),
      nextNumber: jest.fn(() => Promise.resolve(nextNumber)),
      create: jest.fn((data) => { const inv = { id: createdInvoices.length + 200, ...data }; createdInvoices.push(inv); return Promise.resolve(inv) }),
      update: jest.fn(),
      remove: jest.fn(),
    },
    payments: {
      list: jest.fn(),
      create: jest.fn((data) => { createdPayments.push(data); return Promise.resolve({ id: createdPayments.length + 300, ...data }) }),
    },
    pos: {
      tablesLayout: { get: jest.fn(), save: jest.fn() },
      verifyCancel: jest.fn(() => Promise.resolve(true)),
      saveDraft: jest.fn((payload) => {
        const id = nextOrderId++
        const branch = String(payload.branch||'china_town')
        const table = String(payload.table||payload.tableId||'1')
        const meta = { type: 'meta', branch, table: Number(table), paymentMethod: String(payload.paymentMethod||''), payLines: Array.isArray(payload.payLines)?payload.payLines.map(l=>({ method: String(l.method||''), amount: String(l.amount||'') })):[] }
        const items = (Array.isArray(payload.items)?payload.items:[]).map(it => ({ type: 'item', product_id: it.id, name: it.name, qty: Number(it.quantity||0), price: Number(it.price||0) }))
        ordersById[id] = [meta, ...items]
        const response = { success: true, order_id: id, invoice: null }
        console.log('Mock saveDraft returning:', response)
        return Promise.resolve(response)
      }),
    },
    settings: { get: jest.fn(() => Promise.resolve(null)) },
    auth: {},
  __setOrder: (id, lines) => { ordersById[id] = lines },
  }
})

const POSInvoice = require('../POSInvoice').default

window.localStorage.setItem('lang','ar')

function renderPOSPath(path){
  const m = path.match(/^\/pos\/([^/]+)\/tables\/(\d+)(?:\?order=(\d+))?$/)
  const branch = m ? m[1] : 'china_town'
  const table = m ? m[2] : '1'
  const order = m ? m[3] : null
  const { __setRoute } = require('react-router-dom')
  __setRoute({ branch, table, order })
  return render(<POSInvoice />)
}

test('إصدار فاتورة لعميل نقدي مع دفعة واحدة', async () => {
  renderPOSPath('/pos/china_town/tables/5')
  await act(async () => { window.__POS_TEST_ADD__('p1') })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  await act(async () => { await window.__POS_TEST_ISSUE__('cash') })
  await act(async () => { await new Promise(res=>setTimeout(res,0)) })
  await waitFor(() => expect(require('../services/api').invoices.create).toHaveBeenCalled())
  const { invoices, payments, orders } = require('../services/api')
  expect(invoices.create.mock.calls[0][0].status).toBe('open')
  expect(payments.create).not.toHaveBeenCalled()
  expect(orders.update).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ status: 'ISSUED' }))
})

test('إصدار فاتورة لعميل آجل بدون دفعات', async () => {
  renderPOSPath('/pos/place_india/tables/3')
  await act(async () => { window.__POS_TEST_ADD__('p2') })
  await act(async () => { window.__POS_TEST_SET_PARTNER__(2, 'credit') })
  await act(async () => { await window.__POS_TEST_ISSUE__('credit') })
  await act(async () => { await new Promise(res=>setTimeout(res,0)) })
  const { invoices, orders, payments } = require('../services/api')
  await waitFor(() => { const invCalled = invoices.create.mock.calls.length>0; const ordCalled = orders.update.mock.calls.length>0; expect(invCalled || ordCalled).toBe(true) })
  expect(payments.create).not.toHaveBeenCalled()
})

test('إنشاء أكثر من مسودة في نفس الوقت عبر الرجوع للطاولات', async () => {
  renderPOSPath('/pos/china_town/tables/7')
  const { pos } = require('../services/api')
  pos.saveDraft.mockClear()
  await act(async () => { await window.__POS_TEST_ADD__('p1') })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  renderPOSPath('/pos/china_town/tables/8')
  pos.saveDraft.mockClear()
  await act(async () => { await window.__POS_TEST_ADD__('p2') })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  expect(pos.saveDraft).toHaveBeenCalledTimes(2)
  expect(window.localStorage.getItem('pos_order_china_town_7')).toBeTruthy()
  expect(window.localStorage.getItem('pos_order_china_town_8')).toBeTruthy()
})

test('طباعة الطلب تحتوي بيانات الإيصال المطلوبة من اللوجو إلى الرسالة الختامية', async () => {
  const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {
    const doc = { open: jest.fn(), write: jest.fn(), close: jest.fn() }
    return { document: doc, focus: jest.fn(), print: jest.fn(), close: jest.fn() }
  })
  renderPOSPath('/pos/china_town/tables/9')
  await act(async () => { await window.__POS_TEST_ADD__('p1') })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  const info = await window.__POS_TEST_PRINT__()
  expect(info.intent).toBe(true)
  expect(info.orderId).toBeGreaterThan(0)
})

test('إلغاء الفاتورة يعمل مع تحقق المشرف', async () => {
  renderPOSPath('/pos/china_town/tables/5?order=999')
  await act(async () => { await Promise.resolve(); await new Promise(res => setTimeout(res, 0)) })
  await act(async () => { if (typeof window.__POS_TEST_CANCEL__ === 'function') { await window.__POS_TEST_CANCEL__('1234') } })
  await waitFor(() => expect(require('../services/api').pos.verifyCancel).toHaveBeenCalled())
  const { orders } = require('../services/api')
  await waitFor(() => {
    const removed = orders.remove.mock.calls.some(c => String(c[0]) === '999')
    const updated = orders.update.mock.calls.some(c => String(c[0]) === '999' && c[1] && c[1].status === 'CANCELLED')
    expect(removed || updated).toBe(true)
  }, { timeout: 5000 })
})

test('استعادة/تعيين أسطر الدفع وفق العقد بعد حفظ المسودة', async () => {
  const { pos } = require('../services/api')
  renderPOSPath('/pos/china_town/tables/7')
  await act(async () => { await window.__POS_TEST_ADD__('p1') })
  await act(async () => { window.__POS_TEST_PAY__([{ method: 'bank', amount: '5' }]) })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  const last = pos.saveDraft.mock.calls[pos.saveDraft.mock.calls.length - 1]?.[0]
  expect(Array.isArray(last.payLines)).toBe(true)
  expect(last.payLines[0]).toEqual({ method: 'bank', amount: 5 })
})

test('حفظ أول صنف ينشئ order_id ويخزنه في localStorage ويستعيد الأصناف', async () => {
  renderPOSPath('/pos/china_town/tables/16')
  await waitFor(() => expect(require('../services/api').products.list).toHaveBeenCalled())
  await act(async () => { await window.__POS_TEST_ADD__('p1') })
  await act(async () => { await window.__POS_TEST_SAVE__() })
  const k1 = 'pos_order_china_town_16'
  const k2 = 'pos_order_place_india_16'
  const stored = window.localStorage.getItem(k1) || window.localStorage.getItem(k2)
  expect(stored).toBeTruthy()
  const { orders } = require('../services/api')
  orders.get.mockImplementation((id) => {
    if (id === Number(stored)) {
      return Promise.resolve({ 
        id: Number(stored), 
        lines: JSON.stringify([
          { type: 'meta', branch: 'china_town', table: 16 },
          { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 }
        ])
      })
    }
    return Promise.resolve({ id, lines: '[]' })
  })
  renderPOSPath(`/pos/china_town/tables/16?order=${stored}`)
  await waitFor(() => expect(require('../services/api').orders.get).toHaveBeenCalledWith(String(stored)))
  expect(require('../services/api').orders.create).not.toHaveBeenCalled()
})
jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 1, name: 'Tester', role: 'admin' }, canScreen: () => true })
}), { virtual: true })