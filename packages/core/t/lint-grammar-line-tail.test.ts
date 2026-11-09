import lintGrammar from '../src/lint/grammar/lint.js'

type Diagnostic = { rule: string; location?: { start: { line: number; column: number } } }
type GrammarOptions = {
  diagnostics: Diagnostic[]
  lineFrom?: (from: number) => string
  closedEarly?: (rest: string, inHash: boolean) => boolean
}

const run = (input: string, extra: Partial<GrammarOptions> = {}): GrammarOptions => {
  const opts: GrammarOptions = { diagnostics: [], ...extra }
  lintGrammar.parse(input, opts)
  return opts
}

// UTF-16 code units in the results of slice and in the strings split cuts;
// substring, indexOf and other regular expressions are not counted
const unitsInSliceAndSplit = (input: string): { units: number; messages: number } => {
  const slice = String.prototype.slice
  const split = String.prototype.split
  let units = 0
  let opts: GrammarOptions = { diagnostics: [] }
  const wrap = (name: 'slice' | 'split', count: (receiver: string, result: string | string[]) => number) =>
    Object.defineProperty(String.prototype, name, {
      configurable: true,
      writable: true,
      value: function (this: string, ...args: unknown[]) {
        const result = Reflect.apply(name === 'slice' ? slice : split, this, args)
        units += count(this, result)
        return result
      },
    })
  wrap('slice', (_, result) => result.length)
  wrap('split', receiver => receiver.length)
  try {
    opts = run(input)
  } finally {
    Object.defineProperty(String.prototype, 'slice', { configurable: true, writable: true, value: slice })
    Object.defineProperty(String.prototype, 'split', { configurable: true, writable: true, value: split })
  }
  return { units, messages: opts.diagnostics.length }
}

const growth = (line: string) => {
  const small = unitsInSliceAndSplit(line.repeat(200))
  const large = unitsInSliceAndSplit(line.repeat(400))
  return { small, large, ratio: large.units / small.units }
}

describe('lint grammar reads the rest of a line after an attribute', () => {
  it('units in slice and split grow linearly with the lines after an angle value', () => {
    const { small, large, ratio } = growth('=for para :caption<a> x>\n')
    expect(small.messages).toBe(200)
    expect(large.messages).toBe(400)
    expect(ratio).toBeLessThanOrEqual(2.5)
  })

  it('units in slice and split grow linearly with the lines after a quoted value in angles', () => {
    const { small, large, ratio } = growth("=for para :caption<'a'> x>\n")
    expect(small.messages).toBe(200)
    expect(large.messages).toBe(400)
    expect(ratio).toBeLessThanOrEqual(2.5)
  })

  it('lineFrom returns what splitting the rest of the input returned', () => {
    const alphabet = ['a', '>', '\r', '\n']
    const inputs = ['']
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].length < 5) for (const c of alphabet) inputs.push(inputs[i] + c)
    }
    const mismatches: Array<{ input: string; from: number }> = []
    for (const input of inputs) {
      for (let from = 0; from <= input.length + 1; from++) {
        const opts = run(input)
        if (opts.lineFrom?.(from) !== input.slice(from).split(/\r?\n/)[0]) mismatches.push({ input, from })
      }
    }
    expect(mismatches).toEqual([])
  })

  describe.each([':caption<a>', ":caption<'a'>"])('after %s', attr => {
    const original = run('').closedEarly
    const rests = (input: string): string[] => {
      const seen: string[] = []
      run(input, {
        closedEarly: (rest, inHash) => {
          seen.push(rest)
          return original ? original(rest, inHash) : false
        },
      })
      return seen
    }

    it('keeps a carriage return that ends the file', () => {
      expect(rests(`=for para ${attr} x\r`)).toEqual([' x\r'])
    })

    it('drops the carriage return of a line break', () => {
      expect(rests(`=for para ${attr} x\r\ny`)).toEqual([' x'])
    })

    it('reads past a lone carriage return to the line break', () => {
      expect(rests(`=for para ${attr} x\ry\n`)).toEqual([' x\ry'])
    })

    it('gives an empty rest when the attribute ends the file', () => {
      expect(rests(`=for para ${attr}`)).toEqual([''])
    })

    it('flags a > after a lone carriage return on the same line', () => {
      const found = run(`=for para ${attr} x\r>\n`).diagnostics
      expect(found).toHaveLength(1)
      expect(found[0].location?.start).toMatchObject({ line: 1, column: 11 })
    })

    it('flags a > on the last line of a file without a line break', () => {
      const found = run(`=for para ${attr} x>`).diagnostics
      expect(found).toHaveLength(1)
      expect(found[0].location?.start).toMatchObject({ line: 1, column: 11 })
    })

    it('reports the same place after a CRLF and after a LF', () => {
      const lf = run(`=for para ${attr} x>\nnext`).diagnostics
      const crlf = run(`=for para ${attr} x>\r\nnext`).diagnostics
      expect(lf).toHaveLength(1)
      expect(crlf.map(d => [d.rule, d.location?.start])).toEqual(lf.map(d => [d.rule, d.location?.start]))
    })
  })
})
