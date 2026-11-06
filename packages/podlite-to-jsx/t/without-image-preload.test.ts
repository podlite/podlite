import { withoutImagePreload } from './without-image-preload'

describe('the preload links React 19 adds before images', () => {
  it('are taken off the start of the markup when an image of that address follows', () => {
    expect(
      withoutImagePreload('<link rel="preload" as="image" href="a.png"/><div><img src="a.png" alt=""/></div>'),
    ).toBe('<div><img src="a.png" alt=""/></div>')
    expect(
      withoutImagePreload(
        '<link rel="preload" as="image" href="a.png"/><link rel="preload" as="image" href="b.png"/><img src="a.png"/><img src="b.png"/>',
      ),
    ).toBe('<img src="a.png"/><img src="b.png"/>')
  })

  it('stay when no image of that address follows', () => {
    const html = '<link rel="preload" as="image" href="a.png"/><img src="b.png"/>'
    expect(withoutImagePreload(html)).toBe(html)
  })

  it('stay anywhere but at the start', () => {
    const html = '<div><link rel="preload" as="image" href="a.png"/><img src="a.png"/></div>'
    expect(withoutImagePreload(html)).toBe(html)
  })

  it('leave markup without them as it is', () => {
    expect(withoutImagePreload('<img src="a.png" title="Tip"/>')).toBe('<img src="a.png" title="Tip"/>')
  })
})
