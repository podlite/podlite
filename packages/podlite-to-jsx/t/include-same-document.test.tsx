import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TestPodlite } from '../src/index'

// Specification.pod6, Include directive: an =include with no source needs no file to
// resolve, so it is resolved when the host gives no reader as well
let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())

const render = (src: string, props: any = {}) => renderToStaticMarkup(<TestPodlite {...props}>{src}</TestPodlite>)
const count = (html: string, part: string) => html.split(part).length - 1

describe('an include with no source in JSX', () => {
  it('is resolved without a reader, and the includes of files are left alone, as before', () => {
    const html = render('=include VERSION\n\n=VERSION 1.0.0\n\n=include file:missing.podlite\n')
    expect(count(html, '1.0.0')).toBe(2)
    expect(warn).not.toHaveBeenCalled()
  })

  it('reads the same with a reader', () => {
    const html = render('=include VERSION\n\n=include file:meta.podlite\n\n=VERSION 1.0.0\n', {
      includeReader: (path: string) => (path === 'meta.podlite' ? '=VERSION 2.0.0\n' : null),
    })
    expect([count(html, '1.0.0'), count(html, '2.0.0')]).toEqual([2, 2])
  })
})
