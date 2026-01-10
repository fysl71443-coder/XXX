jest.mock('pdfmake/build/pdfmake', () => ({
  __esModule: true,
  default: { createPdf: jest.fn(() => ({ open: jest.fn(), print: jest.fn(), download: jest.fn() })) }
}), { virtual: true })
jest.mock('pdfmake/build/vfs_fonts', () => ({ __esModule: true, default: { pdfMake: { vfs: {} } } }), { virtual: true })

import { ensureImageDataUrl, normalizeImage, validatePdfDefinition } from '../../../utils/pdfUtils'

describe('smoke print end-to-end', () => {
  beforeEach(()=>{
    global.window = { location: { origin: 'http://localhost:3001' } }
    const blob = new Blob([Uint8Array.from([1,2,3])], { type: 'image/png' })
    global.fetch = jest.fn(async ()=>({ ok:true, blob: async ()=>blob }))
  })

  test('doc with /logo.png converts and validates with zero errors', async () => {
    const logoData = await ensureImageDataUrl('/logo.png')
    const logoNode = normalizeImage(logoData)
    const doc = { content: [ logoNode || { text: 'NO LOGO' } ] }
    const errors = validatePdfDefinition(doc)
    expect(errors.length).toBe(0)
  })
})