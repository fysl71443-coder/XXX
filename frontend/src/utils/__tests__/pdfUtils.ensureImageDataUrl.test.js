import { ensureImageDataUrl } from '../../utils/pdfUtils'

describe('ensureImageDataUrl', () => {
  beforeEach(()=>{
    global.window = { location: { origin: 'http://localhost:3001' } }
  })

  test('converts relative URL to data URL via fetch', async () => {
    const b64 = 'iVBORw0KGgoAAA';
    const blob = new Blob([Uint8Array.from([1,2,3])], { type: 'image/png' })
    const origFetch = global.fetch
    global.fetch = jest.fn(async ()=>({ ok:true, blob: async ()=>blob }))
    const res = await ensureImageDataUrl('/logo.png')
    expect(res).toMatch(/^data:image\/png;base64,/)
    global.fetch = origFetch
  })
})