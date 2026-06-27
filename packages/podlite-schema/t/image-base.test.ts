import { applyImageBase } from '../src/image-base'

const BASE = 'https://cdn.example.com/media'

describe('applyImageBase', () => {
  it('prefixes a bare relative name', () => {
    expect(applyImageBase('demo.png', BASE)).toBe('https://cdn.example.com/media/demo.png')
  })

  it('prefixes a relative file: reference and drops the scheme', () => {
    expect(applyImageBase('file:demo.png', BASE)).toBe('https://cdn.example.com/media/demo.png')
  })

  it('prefixes a relative subpath', () => {
    expect(applyImageBase('img/logo.png', BASE)).toBe('https://cdn.example.com/media/img/logo.png')
  })

  it('leaves a dot-relative path relative under the base', () => {
    expect(applyImageBase('../logo.png', BASE)).toBe('https://cdn.example.com/media/../logo.png')
  })

  it('passes through an absolute path', () => {
    expect(applyImageBase('/local/x.png', BASE)).toBe('/local/x.png')
  })

  it('passes through an absolute file: reference', () => {
    expect(applyImageBase('file:/local/x.png', BASE)).toBe('file:/local/x.png')
  })

  it('passes through an https reference', () => {
    expect(applyImageBase('https://other.com/i.jpg', BASE)).toBe('https://other.com/i.jpg')
  })

  it('passes through a data reference', () => {
    expect(applyImageBase('data:Logo', BASE)).toBe('data:Logo')
  })

  it('returns the source unchanged without a base', () => {
    expect(applyImageBase('demo.png')).toBe('demo.png')
    expect(applyImageBase('demo.png', '')).toBe('demo.png')
  })

  it('collapses a trailing slash on the base', () => {
    expect(applyImageBase('demo.png', 'https://cdn.example.com/media/')).toBe('https://cdn.example.com/media/demo.png')
  })
})
