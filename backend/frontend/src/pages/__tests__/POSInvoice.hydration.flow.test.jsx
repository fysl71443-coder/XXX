import React from 'react'
import { render, waitFor, act } from '@testing-library/react'

jest.mock('react-router-dom', () => {
  let route = { branch: 'china_town', table: '40', order: null }
  const setRoute = (r) => { route = { ...route, ...r } }
  const nav = jest.fn()
  return {
    __esModule: true,
    useParams: () => ({ branch: route.branch, table: route.table }),
    useSearchParams: () => [new URLSearchParams(route.order ? `?order=${route.order}` : ''), jest.fn()],
    useNavigate: () => nav,
    __setRoute: setRoute,
    __getNavigate: () => nav,
  }
}, { virtual: true })

jest.mock('../../services/api', () => {
  const productsList = [
    { id: 'p1', name: 'منتج 1', category: 'عام', sale_price: 10 },
  ]
  return {
    __esModule: true,
    default: { defaults: { baseURL: 'http://localhost:4000/api' } },
    partners: { list: jest.fn(() => Promise.resolve([])) },
    products: { list: jest.fn(() => Promise.resolve(productsList)) },
    orders: {
      list: jest.fn(() => Promise.resolve([{ id: 4040, status: 'DRAFT', lines: JSON.stringify([{ type: 'meta', branch: 'china_town', table: 40 }, { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 }]) }])),
      get: jest.fn((id) => Promise.resolve({ id, lines: JSON.stringify([{ type: 'meta', branch: 'china_town', table: 40 }, { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 }]) })),
      create: jest.fn(), update: jest.fn(), remove: jest.fn(),
    },
    invoices: { nextNumber: jest.fn(() => Promise.resolve({ next: 'INV-HDR' })), create: jest.fn() },
    payments: { create: jest.fn() },
    pos: {
      tablesLayout: { get: jest.fn(() => Promise.resolve({ rows: [] })), save: jest.fn() },
      tableState: jest.fn(() => Promise.resolve({ busy: ['40'] })),
      verifyCancel: jest.fn(() => Promise.resolve(true)),
      saveDraft: jest.fn(),
    },
    settings: { get: jest.fn(() => Promise.resolve(null)) },
    auth: {},
  }
})

jest.mock('../services/api', () => require('../../services/api'), { virtual: true })

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 1, name: 'Tester', role: 'admin' }, canScreen: () => true })
}), { virtual: true })

const POSInvoice = require('../POSInvoice').default

function renderPOSPath(path){
  const m = path.match(/^\/pos\/([^/]+)\/tables\/(\d+)(?:\?order=(\d+))?$/)
  const branch = m ? m[1] : 'china_town'
  const table = m ? m[2] : '40'
  const order = m ? m[3] : null
  const { __setRoute } = require('react-router-dom')
  __setRoute({ branch, table, order })
  return render(<POSInvoice />)
}

test('ترطيب المسودة تلقائيًا عند فتح الطاولة بدون ?order إذا كانت مشغولة', async () => {
  window.localStorage.setItem('lang','ar')
  renderPOSPath('/pos/china_town/tables/40')
  await act(async () => { await Promise.resolve(); await new Promise(res => setTimeout(res, 0)) })
  await waitFor(() => expect(require('../../services/api').pos.tableState).toHaveBeenCalledWith('china_town'))
  await waitFor(() => expect(require('../../services/api').orders.list).toHaveBeenCalled())
  await act(async () => { await new Promise(res => setTimeout(res, 0)) })
  await act(async () => { await new Promise(res => setTimeout(res, 0)) })
  const { __getNavigate } = require('react-router-dom')
  await waitFor(() => expect(__getNavigate()).toHaveBeenCalled())
})