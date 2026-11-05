import { build, BuildOptions } from 'esbuild'
import { join } from 'path'

// the schema stays outside so the installed one is used; remark is ESM only and stays inside
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
