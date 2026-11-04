import { nanoid } from 'nanoid'
import { mkBlock } from '../src'

describe('the ids of new blocks', () => {
  it('stay apart after another caller asks nanoid for a fractional size', () => {
    // nanoid keeps one pool for the process; before 3.3.8 a fractional size left it
    // handing the same id to every next call
    nanoid(1.5)
    const first = mkBlock({ name: 'para' }, []).id
    const second = mkBlock({ name: 'para' }, []).id
    expect(first).not.toBe(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]{21}$/)
  })
})
