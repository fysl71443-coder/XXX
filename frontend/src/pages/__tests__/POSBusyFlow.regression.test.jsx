import React from 'react'
import { render, waitFor, act } from '@testing-library/react'

jest.mock('react-router-dom', () => {
  let route = { branch: 'china_town', table: '5', order: null }
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

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 1, name: 'Tester', role: 'admin' }, canScreen: () => true })
}), { virtual: true })

jest.mock('../../services/api', () => {
  const productsList = [
    { id: 'p1', name: 'منتج 1', category: 'عام', sale_price: 10 },
    { id: 'p2', name: 'منتج 2', category: 'عام', sale_price: 5 },
  ]
  const ordersById = {}
  let nextOrderId = 800
  return {
    __esModule: true,
    products: {
      list: jest.fn(() => Promise.resolve(productsList)),
    },
    orders: {
      get: jest.fn((id) => Promise.resolve({ id, lines: JSON.stringify(ordersById[id] || []) })),
      list: jest.fn((q) => {
        const branch = String(q?.branch||'china_town').trim().toLowerCase()
        const table = Number(q?.table||0)
        const out = []
        for (const [id, lines] of Object.entries(ordersById)) {
          try {
            const arr = Array.isArray(lines) ? lines : JSON.parse(lines||'[]')
            const meta = arr.find(x => x && x.type==='meta') || {}
            const items = arr.filter(x => x && x.type==='item')
            const norm = (v)=> String(v||'').trim().toLowerCase().replace(/\s+/g,'_')
            if (norm(meta.branch)===norm(branch) && Number(meta.table||0)===Number(table) && items.length>0) {
              out.push({ id: Number(id), status: 'DRAFT', lines: JSON.stringify(arr) })
            }
          } catch {}
        }
        return Promise.resolve(out)
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
    pos: {
      tablesLayout: { get: jest.fn(() => Promise.resolve({ rows: [{ name: 'Row A', tables: 12 }] })), save: jest.fn() },
      tableState: jest.fn((branch) => {
        const b = String(branch||'china_town').trim().toLowerCase().replace(/\s+/g,'_')
        const busy = new Set()
        for (const lines of Object.values(ordersById)) {
          try {
            const arr = Array.isArray(lines) ? lines : JSON.parse(lines||'[]')
            const meta = arr.find(x => x && x.type==='meta') || {}
            const items = arr.filter(x => x && x.type==='item')
            const norm = (v)=> String(v||'').trim().toLowerCase().replace(/\s+/g,'_')
            if (norm(meta.branch)===b && items.length>0) busy.add(String(meta.table||''))
          } catch {}
        }
        return Promise.resolve({ busy: Array.from(busy) })
      }),
      saveDraft: jest.fn((payload) => {
        const id = nextOrderId++
        const branch = String(payload.branch||payload.branchId||'china_town')
        const table = String(payload.table||payload.tableId||'5')
        const meta = { type: 'meta', branch, table: Number(table), paymentMethod: String(payload.paymentMethod||''), payLines: Array.isArray(payload.payLines)?payload.payLines.map(l=>({ method: String(l.method||''), amount: String(l.amount||'') })):[] }
        const items = (Array.isArray(payload.items)?payload.items:[]).map(it => ({ type: 'item', product_id: it.id, name: it.name, qty: Number(it.quantity||0), price: Number(it.price||0) }))
        ordersById[id] = [meta, ...items]
        return Promise.resolve({ success: true, order_id: id, invoice: null })
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
  const table = m ? m[2] : '5'
  const order = m ? m[3] : null
  const { __setRoute } = require('react-router-dom')
  __setRoute({ branch, table, order })
  return render(<POSInvoice />)
}

test('POS Busy Flow – contract: creates draft → stores order_id → restores on return', async () => {
  const { pos, orders } = require('../services/api')
  pos.saveDraft.mockResolvedValueOnce({ success: true, order_id: 'ORDER_1', invoice: null })
  orders.get.mockResolvedValueOnce({ id: 'ORDER_1', lines: JSON.stringify([{ type: 'meta', branch: 'china_town', table: 5 }, { type: 'item', product_id: 'p1', qty: 1 }]) })

  renderPOSPath('/pos/china_town/tables/5')
  await act(async () => { await window.__POS_TEST_ADD__('p1') })
  const orderId = await window.__POS_TEST_SAVE__()
  expect(orderId).toBeTruthy()
  expect(String(orderId)).toBe('ORDER_1')
  expect(window.localStorage.getItem('pos_order_china_town_5')).toBe('ORDER_1')

  renderPOSPath('/pos/china_town/tables/5')
  await waitFor(() => { expect(orders.get).toHaveBeenCalledWith('ORDER_1') })
})