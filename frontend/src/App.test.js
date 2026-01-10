import { render, screen } from '@testing-library/react'

jest.mock('./App', () => () => {
  return 'ERP'
})
import App from './App'

test('renders dashboard title', () => {
  render(<App />)
  expect(screen.getByText(/ERP/i)).toBeInTheDocument()
})
