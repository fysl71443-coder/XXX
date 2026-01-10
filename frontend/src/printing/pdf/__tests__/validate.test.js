jest.mock('pdfmake/build/pdfmake', () => ({}), { virtual: true })
jest.mock('pdfmake/build/vfs_fonts', () => ({ pdfMake: { vfs: {} } }), { virtual: true })

const { validatePdfDefinition } = require('../../../utils/pdfUtils')

describe('validatePdfDefinition', () => {
  test('detects invalid image URL', () => {
    const doc = { content: [ { image: '/logo.png' } ] }
    const errors = validatePdfDefinition(doc)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/Invalid image/)
    // Print sample errors for inspection
    console.group('🚨 PDF VALIDATION FAILED (test)')
    errors.slice(0,3).forEach(e => console.error(e))
    console.groupEnd()
  })

  test('passes with valid data URL image', () => {
    const doc = { content: [ { image: 'data:image/png;base64,iVBORw0KGgoAAA' } ] }
    const errors = validatePdfDefinition(doc)
    expect(errors.length).toBe(0)
  })

  test('detects invalid table body', () => {
    const doc = { content: [ { table: { body: { not: 'an array' } } } ] }
    const errors = validatePdfDefinition(doc)
    expect(errors.some(e => /Table body is invalid/.test(e))).toBe(true)
  })
})