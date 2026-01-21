import { render, screen } from '@testing-library/react'
import App from './App'

jest.mock('./App', () => () => {
  return 'ERP'
})

test('renders dashboard title', () => {
  render(<App />)
  expect(screen.getByText(/ERP/i)).toBeInTheDocument()
})
