import { render, screen, fireEvent, waitFor } from '@testing-library/react'
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true })
jest.mock('../services/api', () => {
  const makeThenable = (data) => ({
    then: (fn) => {
      try { fn(data) } catch {}
      return {
        catch: () => ({ finally: (cb) => { try { cb() } catch {} } })
      }
    }
  })
  const partners = {
    list: jest.fn(() => makeThenable([{ id: 1, name: 'Test Customer' }])),
    create: jest.fn((data) => Promise.resolve({ id: 2, name: data.name }))
  }
  const products = {
    list: jest.fn(() => makeThenable([
      { id: 1, name: 'Meal A', sale_price: 100 },
      { id: 2, name: 'Meal B', sale_price: 50 },
    ]))
  }
  const invoices = {
    list: jest.fn(() => makeThenable([])),
    create: jest.fn((data) => Promise.resolve({ id: 10, ...data }))
  }
  return { __esModule: true, default: { partners, products, invoices }, partners, products, invoices }
})
import Sales from './Sales'

function setup() {
  localStorage.setItem('lang', 'ar')
  return render(<Sales />)
}

test('يحساب السطر بالضريبة 15% ويحفظ الفاتورة', async () => {
  setup()
  const addBtn = await screen.findByRole('button', { name: /إضافة وجبة/i })
  fireEvent.click(addBtn)

  const mealSelect = screen.getByRole('combobox', { name: /الوجبة/i })
  fireEvent.change(mealSelect, { target: { value: '1' } })

  const qtyInput = screen.getByRole('spinbutton', { name: /الكمية/i })
  fireEvent.change(qtyInput, { target: { value: '2' } })

  const priceInput = screen.getByRole('textbox', { name: /السعر/i })
  const taxInput = screen.getByRole('textbox', { name: /الضريبة/i })
  const totalInput = screen.getByRole('textbox', { name: /الإجمالي/i })
  expect(priceInput).toHaveValue('200.00')
  expect(taxInput).toHaveValue('30.00')
  expect(totalInput).toHaveValue('230.00')

  const customerInput = screen.getByRole('textbox', { name: /العميل/i })
  fireEvent.change(customerInput, { target: { value: 'HUNGER' } })
  await waitFor(() => expect(screen.getByLabelText(/نسبة خصم العميل/i)).toBeInTheDocument())

  const discountCustomerInput = screen.getByLabelText(/نسبة خصم العميل/i)
  fireEvent.change(discountCustomerInput, { target: { value: '10' } })
  const rowDiscountInput = screen.getByRole('spinbutton', { name: /الخصم/i })
  fireEvent.change(rowDiscountInput, { target: { value: '0' } })

  expect(screen.getByRole('textbox', { name: /الضريبة/i })).toHaveValue('27.00')
  expect(screen.getByRole('textbox', { name: /الإجمالي/i })).toHaveValue('207.00')

  const saveBtn = screen.getByRole('button', { name: /حفظ وإنشاء/i })
  fireEvent.click(saveBtn)
})

test('يطبع أمر غير نهائي ويستدعي نافذة الطباعة', async () => {
  setup()
  const addBtn = await screen.findByRole('button', { name: /إضافة وجبة/i })
  fireEvent.click(addBtn)
  const mealSelect = screen.getByRole('combobox', { name: /الوجبة/i })
  fireEvent.change(mealSelect, { target: { value: '1' } })
  const qtyInput = screen.getByRole('spinbutton', { name: /الكمية/i })
  fireEvent.change(qtyInput, { target: { value: '1' } })

  const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {
    return {
      document: { open: jest.fn(), write: jest.fn(), close: jest.fn() },
      focus: jest.fn(),
      print: jest.fn(),
    }
  })
  const printBtn = screen.getByRole('button', { name: /طباعة الطلب/i })
  fireEvent.click(printBtn)
  expect(openSpy).toHaveBeenCalledTimes(1)
  openSpy.mockRestore()
})
