import { build, BuildOptions } from 'esbuild'
var esbuild = require('esbuild')
const opt: BuildOptions = {
  tsconfig: 'tsconfig-esm.json',
}
esbuild
  .build({
    bundle: true,
    entryPoints: ['src/index.tsx'],
    external: ['react', 'react-dom', 'codemirror', 'react-codemirror2'],
    minify: false,
    format: 'esm',
    target: 'es2019',
    platform: 'browser',
    sourcemap: true,
    outfile: 'lib/index.esm.js',
    ...opt,
  })
  .catch(e => {
    console.log('Build not successful', e.message)
    process.exit(1)
  })
