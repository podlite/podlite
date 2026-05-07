import { runLint } from '../src/lint'

describe('runLint stub', () => {
  it('returns exit code 0', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    expect(runLint(['fake.podlite'])).toBe(0)
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
