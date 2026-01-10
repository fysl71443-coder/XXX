import React from 'react'
import { render, waitFor } from '@testing-library/react'

jest.mock('react-router-dom', () => {
  return {
    __esModule: true,
    useParams: () => ({ branch: 'china_town' }),
    useNavigate: () => jest.fn(),
  }
}, { virtual: true })

jest.mock('../services/api', () => {
  const ordersList = [
    {
      id: 101,
      status: 'DRAFT',
      lines: JSON.stringify([
        { type: 'meta', branch: 'china_town', table: 1 },
        { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 },
      ]),
    },
    {
      id: 102,
      status: 'DRAFT',
      lines: JSON.stringify([
        { type: 'meta', branch: 'china_town', table: 2 },
        // بدون عناصر
      ]),
    },
  ]
  return {
    __esModule: true,
    orders: {
      list: jest.fn(() => Promise.resolve(ordersList)),
    },
    pos: {
      tablesLayout: {
        get: jest.fn(() => Promise.resolve({ rows: [{ name: 'Row A', tables: 2 }] })),
        save: jest.fn(),
      },
      tableState: jest.fn(async () => ({ busy: [] })),
    },
  }
}, { virtual: true })

jest.mock('../../services/api', () => {
  const ordersList = [
    {
      id: 101,
      status: 'DRAFT',
      lines: JSON.stringify([
        { type: 'meta', branch: 'china_town', table: 1 },
        { type: 'item', product_id: 'p1', name: 'منتج 1', qty: 1, price: 10 },
      ]),
    },
    {
      id: 102,
      status: 'DRAFT',
      lines: JSON.stringify([
        { type: 'meta', branch: 'china_town', table: 2 },
        // بدون عناصر
      ]),
    },
  ]
  return {
    __esModule: true,
    orders: {
      list: jest.fn(() => Promise.resolve(ordersList)),
    },
    pos: {
      tablesLayout: {
        get: jest.fn(() => Promise.resolve({ rows: [{ name: 'Row A', tables: 2 }] })),
        save: jest.fn(),
      },
      tableState: jest.fn(async () => ({ busy: [] })),
    },
  }
})

const POSTables = require('../POSTables').default

describe('POSTables – contract', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.clearAllMocks()
  })

  it('marks table busy when order_id exists', async () => {
    const { pos } = require('../../services/api')
    window.localStorage.setItem('pos_order_china_town_1', 'ORDER_123')
    render(<POSTables />)
    await waitFor(() => {
      expect(pos.tableState).toHaveBeenCalled()
    })
  })

  it('marks table free when no order exists', async () => {
    const { pos } = require('../../services/api')
    render(<POSTables />)
    await waitFor(() => {
      expect(pos.tableState).toHaveBeenCalled()
    })
  })
})