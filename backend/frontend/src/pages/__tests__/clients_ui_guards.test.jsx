import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Clients from '../Clients'

jest.mock('react-router-dom', () => {
  return {
    __esModule: true,
    useLocation: () => ({ pathname: '/clients' }),
    useNavigate: () => jest.fn(),
  }
}, { virtual: true })

jest.mock('../../services/api', () => {
  const partnersList = [
    { id: 1, name: 'عميل أ', type: 'customer' },
    { id: 2, name: 'مورد ب', type: 'supplier' },
  ]
  const invoicesList = [
    { id: 11, invoice_number: 'INV-11', type: 'sale', partner_id: 1, date: '2025-01-01', total: 100, tax: 15, status: 'posted' },
    { id: 12, invoice_number: 'PI-12', type: 'purchase', partner_id: 2, date: '2025-01-01', total: 80, tax: 12, status: 'issued' },
    { id: 13, invoice_number: 'INV-13', type: 'sale', partner_id: 1, date: '2025-01-10', total: 50, tax: 7.5, status: 'draft' },
  ]
  return {
    __esModule: true,
    partners: { list: jest.fn((q)=> Promise.resolve(q?.type==='customer' ? partnersList.filter(p=>p.type==='customer') : partnersList)) },
    invoices: { list: jest.fn((q)=> Promise.resolve({ items: invoicesList.filter(i => !q?.type || i.type===q.type) })) },
    payments: { list: jest.fn(()=> Promise.resolve({ items: [] })) },
  }
}, { virtual: true })

test('لا يظهر المورد ضمن العملاء ويظهر فقط العملاء', async () => {
  render(<Clients />)
  await waitFor(() => expect(require('../../services/api').partners.list).toHaveBeenCalled())
  const vend = screen.queryByText('مورد ب')
  expect(vend).toBeNull()
})

// تم حذف أقسام الفواتير وأعمار الديون من شاشة العملاء، لذلك لا تنطبق اختبارات التبويبات بعد الآن.