// mermaid ships as ESM-only; the SSR unit tests never render, so a stub keeps
// the import resolvable under the CommonJS jest runner.
module.exports = {
  initialize: () => {},
  render: () => Promise.resolve({ svg: '' }),
  parse: () => Promise.resolve(true),
}
