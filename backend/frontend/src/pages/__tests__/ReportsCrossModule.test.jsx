import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
  Link: ({ children }) => (<span>{children}</span>),
}), { virtual: true })

jest.mock('../../services/api', () => {
  const salesByBranchData = {
    items: [ { branch: 'kitchen', gross_total: 100, net_total: 80, tax_total: 20, discount_total: 0 } ],
    totals: { gross_total: 100, net_total: 80, tax_total: 20, discount_total: 0 }
  }
  const expensesByBranchData = {
    items: [ { branch: 'food', total: 120 } ],
    total: 120
  }
  return {
    __esModule: true,
    reports: {
      salesByBranch: jest.fn(() => Promise.resolve(salesByBranchData)),
      expensesByBranch: jest.fn(() => Promise.resolve(expensesByBranchData)),
    },
    settings: { get: jest.fn(() => Promise.resolve(null)) },
  }
}, { virtual: true })

jest.mock('../services/api', () => require('../../services/api'), { virtual: true })

jest.mock('lucide-react', () => {
  const Stub = () => null
  return new Proxy({ __esModule: true }, { get: () => Stub })
}, { virtual: true })

jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ canScreen: () => true, loading: false, isLoggedIn: true })
}), { virtual: true })

// Import after mocks to ensure they take effect
const Reports = require('../Reports').default

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: () => ({ interceptors: { request: { use: () => {} }, response: { use: () => {} } } }) }
}))

test('تطبيق تقرير المبيعات حسب الفروع يعمل ويعرض الجدول', async () => {
  window.localStorage.setItem('lang','ar')
  render(<Reports />)
  const apply = await screen.findByTestId('apply-sales-by-branch')
  fireEvent.click(apply)
  await waitFor(() => expect(require('../../services/api').reports.salesByBranch).toHaveBeenCalled())
  expect(await screen.findByText('ملخص: المبيعات حسب الفروع')).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('تطبيق تقرير المصروفات حسب الفروع يعمل ويعرض الجدول', async () => {
  window.localStorage.setItem('lang','ar')
  render(<Reports />)
  const apply = await screen.findByTestId('apply-expenses-by-branch')
  fireEvent.click(apply)
  await waitFor(() => expect(require('../../services/api').reports.expensesByBranch).toHaveBeenCalled())
  expect(await screen.findByText('ملخص: المصروفات حسب الفروع')).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
})