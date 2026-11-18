// The JSON is written from the built grammar, so the two cannot drift apart
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { podliteGrammar } = createRequire(import.meta.url)(join(root, 'lib', 'index.js'))
writeFileSync(join(root, 'lib', 'podlite.tmLanguage.json'), JSON.stringify(podliteGrammar, null, 2) + '\n')
