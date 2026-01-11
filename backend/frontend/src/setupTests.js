// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
jest.mock('lucide-react', () => {
  const Stub = () => null
  return new Proxy({ __esModule: true }, { get: () => Stub })
}, { virtual: true })
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: () => ({ interceptors: { request: { use: () => {} }, response: { use: () => {} } }, get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }) }
}))
