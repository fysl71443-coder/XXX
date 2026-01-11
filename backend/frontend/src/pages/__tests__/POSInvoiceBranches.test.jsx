import React from 'react'
import { render, waitFor, act } from '@testing-library/react'

jest.mock('react-router-dom', () => {
  let route = { branch: 'china_town', table: '3', order: null }
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
  const partnersList = [
    { id: 1, name: 'عميل نقدي', type: 'عميل', customer_type: 'نقدي', phone: null, contact_info: JSON.stringify({ walk_in: true }) },
  ]
  const productsList = [
    { id: 'p1', name: 'منتج 1', category: 'عام', sale_price: 10 },
    { id: 'p2', name: 'منتج 2', category: 'عام', sale_price: 5 },
  ]
  return {
    __esModule: true,
    default: { defaults: { baseURL: 'http://localhost:4000/api' } },
    partners: { list: jest.fn(() => Promise.resolve(partnersList)) },
    products: { list: jest.fn(() => Promise.resolve(productsList)) },
    orders: {
      list: jest.fn(() => Promise.resolve([])),
      get: jest.fn((id) => Promise.resolve({ id, lines: JSON.stringify(ordersById[id] || []) })),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
    invoices: { nextNumber: jest.fn(() => Promise.resolve({ next: 'INV-TEST' })), create: jest.fn() },
    payments: { create: jest.fn() },
    pos: { tablesLayout: { get: jest.fn(), save: jest.fn() }, verifyCancel: jest.fn(() => Promise.resolve(true)) },
    settings: { get: jest.fn(() => Promise.resolve(null)) },
    auth: {},
    __setOrder: (id, lines) => { ordersById[id] = lines },
  }
}, { virtual: true })
jest.mock('../services/api', () => require('../../services/api'), { virtual: true })

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 1, name: 'Tester', role: 'admin' }, canScreen: () => true })
}), { virtual: true })

const POSInvoice = require('../POSInvoice').default

function renderPOSPath(path){
  const m = path.match(/^\/pos\/([^/]+)\/tables\/(\d+)(?:\?order=(\d+))?$/)
  const branch = m ? m[1] : 'china_town'
  const table = m ? m[2] : '3'
  const order = m ? m[3] : null
  const { __setRoute } = require('react-router-dom')
  __setRoute({ branch, table, order })
  return render(<POSInvoice />)
}

test('استعادة الأصناف من المسودة للفرع China Town', async () => {
  const { __setOrder } = require('../../services/api')
  __setOrder(701, [
    { type: 'meta', branch: 'china_town', table: 3 },
    { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 },
  ])
  window.localStorage.setItem('pos_order_china_town_3','701')
  renderPOSPath('/pos/china_town/tables/3?order=701')
  await act(async () => { await Promise.resolve(); await new Promise(res => setTimeout(res, 0)) })
  expect(require('../../services/api').orders.create).not.toHaveBeenCalled()
})

test('استعادة الأصناف من المسودة للفرع Place India مع اختلاف التسمية', async () => {
  const { __setOrder } = require('../../services/api')
  __setOrder(702, [
    { type: 'meta', branch: 'palace_india', table: 3 },
    { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 },
  ])
  window.localStorage.setItem('pos_order_place_india_3','702')
  renderPOSPath('/pos/place_india/tables/3?order=702')
  await act(async () => { await Promise.resolve(); await new Promise(res => setTimeout(res, 0)) })
  expect(require('../../services/api').orders.create).not.toHaveBeenCalled()
})