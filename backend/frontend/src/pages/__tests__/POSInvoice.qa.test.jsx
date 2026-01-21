import React from 'react'
import { render, act, waitFor } from '@testing-library/react'

// remove secondary mock

import POSInvoice from '../POSInvoice'

jest.mock('react-router-dom', () => {
  let route = { branch: 'place_india', table: '2', order: null }
  const setRoute = (r) => { route = { ...route, ...r } }
  return {
    __esModule: true,
    useParams: () => ({ branch: route.branch, table: route.table }),
    useSearchParams: () => [new URLSearchParams(route.order ? `?order=${route.order}` : ''), jest.fn()],
    useNavigate: () => jest.fn(),
    __setRoute: setRoute,
  }
}, { virtual: true })

jest.mock('../../services/api', () => {
  const ordersById = {}
  let nextOrderId = 900
  return {
    __esModule: true,
    default: { defaults: { baseURL: 'http://localhost:4000/api' } },
    partners: { list: jest.fn(() => Promise.resolve([])), create: jest.fn() },
    products: { list: jest.fn(() => Promise.resolve([
      { id: 'p1', name: 'منتج 1', category: 'عام', sale_price: 10 },
      { id: 'p2', name: 'منتج 2', category: 'عام', sale_price: 5 },
    ])) },
    orders: {
      list: jest.fn(async () => Object.entries(ordersById).map(([id, lines]) => ({ id: Number(id), lines: JSON.stringify(lines), status: 'DRAFT' }))),
      get: jest.fn((id) => Promise.resolve({ id, lines: JSON.stringify(ordersById[id] || []) })),
      update: jest.fn((id, data) => Promise.resolve({ id, ...data })),
    },
    invoices: {
      list: jest.fn(() => Promise.resolve([])),
      items: jest.fn((id) => Promise.resolve({ items: [] })),
      create: jest.fn(),
      update: jest.fn(),
    },
    pos: {
      tablesLayout: { get: jest.fn(() => Promise.resolve({ rows: [] })), save: jest.fn() },
      tableState: jest.fn(async () => ({ busy: [] })),
      saveDraft: jest.fn(async (payload) => {
        const id = nextOrderId++
        const branch = String(payload.branch||'place_india')
        const table = String(payload.table||payload.tableId||'2')
        const meta = { type: 'meta', branch, table: Number(table), paymentMethod: String(payload.paymentMethod||''), payLines: Array.isArray(payload.payLines)?payload.payLines.map(l=>({ method: String(l.method||''), amount: String(l.amount||'') })):[] }
        const items = (Array.isArray(payload.items)?payload.items:[]).map(it => ({ type: 'item', product_id: it.id, name: it.name, qty: Number(it.quantity||0), price: Number(it.price||0) }))
        ordersById[id] = [meta, ...items]
        return Promise.resolve({ success: true, order_id: id, invoice: { id: 1001, invoice_number: 'INV-TEST' } })
      }),
      issueInvoice: jest.fn(async () => ({ success: true, invoice: { id: 1002, invoice_number: 'INV-ISSUED' } })),
    },
    settings: { get: jest.fn(() => Promise.resolve(null)) },
    auth: {},
    __setOrder: (id, lines) => { ordersById[id] = lines },
  }
})

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 1, name: 'Tester', role: 'admin' }, canScreen: () => true })
}), { virtual: true })
window.localStorage.setItem('lang','ar')

describe('POSInvoice QA Tests', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('Add first item to a new table and save draft', async () => {
    const { pos } = require('../../services/api')
    const { __setRoute } = require('react-router-dom')
    __setRoute({ branch: 'place_india', table: '2', order: null })
    render(<POSInvoice />)
    await act(async () => { await Promise.resolve(); await new Promise(res => setTimeout(res, 0)) })
    await act(async () => { window.__POS_TEST_ADD__('p1') })
    await act(async () => { await window.__POS_TEST_SAVE__() })
    await waitFor(() => expect(pos.saveDraft).toHaveBeenCalledTimes(1))
    const k = 'pos_order_place_india_2'
    const stored = window.localStorage.getItem(k)
    expect(stored).toBeTruthy()
    __setRoute({ branch: 'place_india', table: '2', order: stored })
    render(<POSInvoice />)
    await waitFor(() => expect(require('../../services/api').orders.get).toHaveBeenCalled())
  })
})