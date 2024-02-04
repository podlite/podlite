import { build } from 'esbuild'

build({
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom'],
  minify: true,
  format: 'cjs',
  target: 'node14',
  platform: 'node',
  sourcemap: true,
  outfile: 'lib/index.cjs',
}).catch(e => {
  console.log('Build not successful', e.message)
  process.exit(1)
})
