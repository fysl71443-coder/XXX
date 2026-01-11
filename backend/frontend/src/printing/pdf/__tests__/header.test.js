jest.mock('../../services/api', () => ({
  __esModule: true,
  settings: {}, journal: {}, accounts: {}, reports: {}, invoices: {}, payments: {}
}), { virtual: true })
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: () => ({ interceptors: { request: { use: () => {} }, response: { use: () => {} } } }) }
}))
jest.mock('pdfmake/build/pdfmake', () => ({}), { virtual: true })
jest.mock('pdfmake/build/vfs_fonts', () => ({ pdfMake: { vfs: {} } }), { virtual: true })

const { _test_header: headerAuto } = require('../autoReports')
const { _test_header: headerReport } = require('../reportPdf')

describe('PDF header logo handling', () => {
  const company = { name: 'ACME Co', name_en: 'ACME Co', phone: '555', address: 'Main St', vat_number: '123' }

  test('skips non-dataURL logo strings', async () => {
    const branding = { logo: 'https://example.com/logo.png' }
    const out = await headerAuto(company, branding, 'Title', 'Sub')
    expect(out.find(x => x && x.image)).toBeUndefined()
  })

  test('skips data:application non-image URLs', async () => {
    const branding = { logo: 'data:application/pdf;base64,AAA' }
    const out = await headerReport(company, branding, 'Title', 'Sub')
    expect(out.find(x => x && x.image)).toBeUndefined()
  })

  test('accepts data:image/png logos', async () => {
    const branding = { logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA' }
    const out = await headerAuto(company, branding, 'Title', 'Sub')
    expect(out.find(x => x && x.image)).toBeDefined()
  })
})