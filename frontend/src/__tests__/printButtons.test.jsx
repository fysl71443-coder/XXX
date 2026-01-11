import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: '' }),
  useParams: () => ({}),
}))

import SalesOrders from '../pages/SalesOrders'
import PurchaseOrders from '../pages/PurchaseOrders'
import Suppliers from '../pages/Suppliers'
import ClientsCards from '../pages/ClientsCards'
import SuppliersCards from '../pages/SuppliersCards'
import GeneralLedger from '../components/GeneralLedger'
import ExpensesInvoices from '../pages/ExpensesInvoices'
import Employees from '../pages/Employees'
import PayrollDues from '../pages/PayrollDues'

function makeDoc(){
  const fn = jest.fn
  return {
    setFontSize: fn(), text: fn(), rect: fn(), setFillColor: fn(), setTextColor: fn(), addPage: fn(), line: fn(), addImage: fn(),
    setTextDirection: fn(), setR2L: fn(), setFont: fn(), getFont: fn(() => ({ fontName: 'Cairo' })), getTextWidth: fn(() => 10),
    internal: { pageSize: { getWidth: () => 595 } },
    output: fn(() => 'bloburl'),
    save: fn(),
  }
}
// Use global-prefixed variable to satisfy Jest's mock scoping rules
global.mockDoc = makeDoc()

jest.mock('../utils/pdfUtils', () => ({
  createPDF: jest.fn(async () => global.mockDoc),
}))

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}))

jest.mock('../services/api', () => ({
  settings: {
    get: jest.fn(async (key) => {
      if (String(key).includes('branding')) return { logo: '' }
      if (String(key).includes('footer')) return { text: '' }
      return { name_ar: 'شركة', name_en: 'Company', vat_number: '123456789' }
    })
  },
  orders: {
    list: jest.fn(async () => [{ id: 1, order_number: 'SO-1', date: new Date().toISOString(), customer: { name: 'Cust' }, status: 'DRAFT' }]),
    create: jest.fn(async () => ({ id: 2 })),
    remove: jest.fn(async () => ({})),
  },
  purchaseOrders: {
    list: jest.fn(async () => [{ id: 1, order_number: 'PO-1', date: '2025-01-01', partner: { name: 'Supp' }, status: 'draft', total: 100 }]),
    create: jest.fn(async () => ({ id: 10 })),
  },
  partners: {
    list: jest.fn(async () => [
      { id: 1, type: 'مورد', name: 'Supplier', email: 's@example.com', phone: '050', status: 'active', vendor_type: 'main', addr_city: 'Riyadh' },
      { id: 2, type: 'عميل', name: 'Client', email: 'c@example.com', phone: '051' },
    ]),
    remove: jest.fn(async () => ({})),
  },
  supplierInvoices: {
    list: jest.fn(async () => ({ items: [] })),
    get: jest.fn(async (id) => ({ invoice: { id, invoice_number: id, date: '2025-01-01', total: 0, tax: 0 }, items: [] })),
  },
  payments: { list: jest.fn(async () => ({ items: [] })) },
  products: { list: jest.fn(async () => []) },
  employees: { list: jest.fn(async () => [{ id: 1, full_name: 'Emp1', department: 'HR' }]) },
  payroll: {
    runs: jest.fn(async () => [{ id: 1, status: 'posted', period: '2025-11' }]),
    previousDues: jest.fn(async () => []),
    outstanding: jest.fn(async () => []),
  },
  journal: { list: jest.fn(async () => ({ items: [] })) },
}))

describe('Print buttons', () => {
  beforeEach(() => {
    global.mockDoc.save.mockClear()
    try { localStorage.setItem('lang', 'ar') } catch {}
  })

  test('SalesOrders print PDF', async () => {
    render(<SalesOrders/>)
    const btns = await screen.findAllByRole('button', { name: /PDF/i })
    for (const b of btns) await userEvent.click(b)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('PurchaseOrders print PDF', async () => {
    render(<PurchaseOrders/>)
    const btns = await screen.findAllByRole('button', { name: /PDF/i })
    for (const b of btns) await userEvent.click(b)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('Suppliers list print PDF', async () => {
    render(<Suppliers/>)
    const btns = await screen.findAllByRole('button', { name: /PDF/i })
    for (const b of btns) await userEvent.click(b)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('ClientsCards print', async () => {
    render(<ClientsCards/>)
    const btn = await screen.findByRole('button', { name: /طباعة|Print/i })
    await userEvent.click(btn)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('SuppliersCards print', async () => {
    render(<SuppliersCards/>)
    const btn = await screen.findByRole('button', { name: /طباعة|Print/i })
    await userEvent.click(btn)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('GeneralLedger print PDF', async () => {
    render(<GeneralLedger/>)
    const btn = await screen.findByRole('button', { name: /PDF/i })
    await userEvent.click(btn)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('ExpensesInvoices print PDF', async () => {
    render(<ExpensesInvoices/>)
    const btns = await screen.findAllByRole('button', { name: /PDF/i })
    for (const b of btns) await userEvent.click(b)
    expect(global.mockDoc.save).toHaveBeenCalled()
  })

  test('Employees print PDF', async () => {
    render(<Employees/>)
    const btns = await screen.findAllByRole('button', { name: /PDF/i })
    for (const b of btns) await userEvent.click(b)
    expect(doc.save).toHaveBeenCalled()
  })

  test('PayrollDues print PDF', async () => {
    render(<PayrollDues/>)
    const btn = await screen.findByRole('button', { name: /PDF/i })
    await userEvent.click(btn)
    await waitFor(() => expect(global.mockDoc.save).toHaveBeenCalled())
  })
})
