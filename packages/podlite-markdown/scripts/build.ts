import { build, BuildOptions } from 'esbuild'
import { join } from 'path'

// The file `require` loads. React and the schema stay outside: the schema is the one the
// application installed, so a fix in it reaches this entry without a new build of this
// package. Remark and unified are bundled, being modules only `import` can load.
export const cjsOptions: BuildOptions = {
  absWorkingDir: join(__dirname, '..'),
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom', '@podlite/schema'],
  minify: true,
  format: 'cjs',
  target: 'node14',
  platform: 'node',
  sourcemap: true,
  outfile: 'lib/index.cjs',
}

if (require.main === module)
  build(cjsOptions).catch(e => {
    console.log('Build not successful', e.message)
    process.exit(1)
  })
