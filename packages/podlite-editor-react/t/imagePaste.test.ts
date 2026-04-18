import { extractImagesFromDataTransfer, SUPPORTED_PASTE_MIME, SUPPORTED_DROP_MIME } from '../src/imagePaste'

type FileLike = { name: string; type: string }

function mkDt(files: FileLike[], kinds?: Array<'file' | 'string'>): DataTransfer {
  const items = files.map((f, i) => ({
    kind: kinds?.[i] ?? 'file',
    type: f.type,
    getAsFile: () => (kinds?.[i] === 'string' ? null : (f as unknown as File)),
  }))
  const realFiles = files.filter((_, i) => (kinds?.[i] ?? 'file') === 'file')
  return {
    items: Object.assign(items, { length: items.length }) as unknown as DataTransferItemList,
    files: Object.assign([...realFiles], { length: realFiles.length }) as unknown as FileList,
  } as DataTransfer
}

it('returns empty array for null DataTransfer', () => {
  const result = extractImagesFromDataTransfer(null, SUPPORTED_PASTE_MIME)
  expect(result.length).toBe(0)
})

it('extracts PNG from clipboard items', () => {
  const dt = mkDt([{ name: 'x.png', type: 'image/png' }])
  const out = extractImagesFromDataTransfer(dt, SUPPORTED_PASTE_MIME)
  expect(out.length).toBe(1)
  expect((out[0] as unknown as FileLike).type).toBe('image/png')
})

it('rejects non-image MIME for paste', () => {
  const dt = mkDt([{ name: 'x.txt', type: 'text/plain' }])
  expect(extractImagesFromDataTransfer(dt, SUPPORTED_PASTE_MIME).length).toBe(0)
})

it('rejects SVG for paste but accepts for drop', () => {
  const dt1 = mkDt([{ name: 'x.svg', type: 'image/svg+xml' }])
  const dt2 = mkDt([{ name: 'x.svg', type: 'image/svg+xml' }])
  expect(extractImagesFromDataTransfer(dt1, SUPPORTED_PASTE_MIME).length).toBe(0)
  expect(extractImagesFromDataTransfer(dt2, SUPPORTED_DROP_MIME).length).toBe(1)
})

it('skips non-file items (string type)', () => {
  const dt = mkDt([{ name: 'x.png', type: 'image/png' }], ['string'])
  expect(extractImagesFromDataTransfer(dt, SUPPORTED_PASTE_MIME).length).toBe(0)
})

it('falls back to files list when items empty', () => {
  const png = { name: 'x.png', type: 'image/png' } as unknown as File
  const dt = {
    items: { length: 0 } as unknown as DataTransferItemList,
    files: Object.assign([png], { length: 1 }) as unknown as FileList,
  } as DataTransfer
  expect(extractImagesFromDataTransfer(dt, SUPPORTED_PASTE_MIME).length).toBe(1)
})

it('extracts multiple images in order', () => {
  const dt = mkDt([
    { name: 'a.png', type: 'image/png' },
    { name: 'b.jpg', type: 'image/jpeg' },
  ])
  const out = extractImagesFromDataTransfer(dt, SUPPORTED_PASTE_MIME)
  expect(out.length).toBe(2)
  expect((out[0] as unknown as FileLike).name).toBe('a.png')
  expect((out[1] as unknown as FileLike).name).toBe('b.jpg')
})
