import { nanoid } from 'nanoid'
import { mkBlock } from '../src'

describe('the ids of new blocks', () => {
  it('stay apart after another caller asks nanoid for a fractional size', () => {
    // a fractional size used to stall the pool nanoid shares across the process
    nanoid(1.5)
    const first = mkBlock({ name: 'para' }, []).id
    const second = mkBlock({ name: 'para' }, []).id
    expect(first).not.toBe(second)
    expect(first).toMatch(/^[A-Za-z0-9_-]{21}$/)
  })
})
