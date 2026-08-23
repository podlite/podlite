import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { podlite } = require('../lib/index.js')
const { lintFile, lintSource, resolveConfig } = require('../lib/lint/index.js')

const section = i =>
  [
    `=head1 Section ${i}`,
    '',
    'Prose with C<code>, a link L<text|#Section 1> and B<bold>.',
    '',
    '=for para :id<p' + i + '>',
    'A paragraph carrying an id.',
    '',
  ].join('\n')

const document = ['=pod', '', ...Array.from({ length: 60 }, (_, i) => section(i))].join('\n')

const dir = mkdtempSync(join(tmpdir(), 'podlite-bench-'))
const file = join(dir, 'doc.podlite')
writeFileSync(file, document)

const config = resolveConfig([file], { strict: false, format: 'text' })
const core = podlite({ importPlugins: true })

export default [
  { name: 'core: check one document', run: () => lintSource(document, 'doc.podlite', config) },
  { name: 'core: check a file from disk', run: () => lintFile(file, config) },
  { name: 'core: parse through the plugin chain', run: () => core.toAst(core.parse(document, { podMode: 1 })) },
]
