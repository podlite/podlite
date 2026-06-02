import { runLint } from '../src/lint'

describe('runLint stub', () => {
  it('returns exit code 0', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    expect(runLint(['fake.podlite'], { strict: false, format: 'text' })).toBe(0)
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('accepts strict + json + configPath options', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    expect(runLint(['fake.podlite'], { strict: true, format: 'json', configPath: '.podlitelintrc.json' })).toBe(0)
    log.mockRestore()
  })
})
